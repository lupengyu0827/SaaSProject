import { createHash, randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CancelOrderRequest,
  CreateOrderRequest,
  ExpireOrdersResponse,
  OrderListQuery,
  OrderPageResponse,
  OrderResponse,
  OrderStatus,
} from '@saas/contracts';

import {
  Prisma,
  type Order,
  type OrderItem,
  type Product,
  type ProductVariant,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { assertInventoryCommand, calculateInventoryBalance } from '../domain/inventory.rules.js';
import { assertCreateOrder, assertOrderTransition } from '../domain/order.rules.js';
import { assertMoney } from '../domain/product.rules.js';

type OrderWithItems = Order & { items: OrderItem[] };
type VariantSnapshot = ProductVariant & { product: Product };

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    actorId: string,
    input: CreateOrderRequest,
  ): Promise<OrderResponse> {
    assertCreateOrder(input);
    assertMoney(input.shippingFee ?? '0', 'shippingFee');
    assertMoney(input.discount ?? '0', 'discount');
    const orderId = randomUUID();
    const requestFingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const orderNo = `O${Date.now()}${orderId.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
    const variantIds = input.items.map((item) => item.variantId).sort();
    const configuredTimeout = Number(process.env.ORDER_PAYMENT_TIMEOUT_MINUTES ?? 30);
    const timeoutMinutes = Number.isFinite(configuredTimeout)
      ? Math.min(Math.max(configuredTimeout, 1), 1440)
      : 30;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60_000);

    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:order-idempotency:${input.idempotencyKey}`);
        const existing = await tx.order.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          include: { items: true },
        });
        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint)
            throw new ConflictException('Idempotency key was already used for another order');
          return this.response(existing);
        }

        for (const variantId of variantIds) await this.lock(tx, `${tenantId}:${variantId}`);
        const variants = await tx.productVariant.findMany({
          where: { tenantId, id: { in: variantIds }, product: { status: 'active' } },
          include: { product: true },
        });
        if (variants.length !== input.items.length)
          throw new NotFoundException('One or more active SKUs were not found');
        const byId = new Map(variants.map((variant) => [variant.id, variant]));

        for (const item of input.items) {
          const entries = await tx.inventoryTransaction.findMany({
            where: { tenantId, variantId: item.variantId },
            select: { type: true, qtyChange: true },
          });
          assertInventoryCommand(
            'lock',
            item.quantity,
            calculateInventoryBalance(item.variantId, entries),
          );
        }

        const subtotal = input.items.reduce((sum, item) => {
          const variant = byId.get(item.variantId) as VariantSnapshot;
          return sum.plus(variant.price.mul(item.quantity));
        }, new Prisma.Decimal(0));
        const discount = new Prisma.Decimal(input.discount ?? '0');
        const shippingFee = new Prisma.Decimal(input.shippingFee ?? '0');
        const total = subtotal.minus(discount).plus(shippingFee);
        if (total.isNegative()) throw new ConflictException('Order total cannot be negative');

        const order = await tx.order.create({
          data: {
            id: orderId,
            tenantId,
            orderNo,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint,
            expiresAt,
            customer: (input.customer ?? {}) as Prisma.InputJsonValue,
            shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
            subtotal,
            discount,
            shippingFee,
            total,
            remark: input.remark,
            createdBy: actorId,
            items: {
              create: input.items.map((item) => {
                const variant = byId.get(item.variantId) as VariantSnapshot;
                return {
                  tenantId,
                  variantId: variant.id,
                  productName: variant.product.name,
                  sku: variant.sku,
                  specs: variant.specs as Prisma.InputJsonValue,
                  unitPrice: variant.price,
                  quantity: item.quantity,
                  lineTotal: variant.price.mul(item.quantity),
                };
              }),
            },
          },
          include: { items: true },
        });
        await tx.inventoryTransaction.createMany({
          data: input.items.map((item) => ({
            tenantId,
            variantId: item.variantId,
            type: 'lock',
            qtyChange: -item.quantity,
            referenceType: 'order',
            referenceId: orderId,
            reason: 'Locked when order was created',
            operatorId: actorId,
          })),
        });
        return this.response(order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  async get(tenantId: string, id: string): Promise<OrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const order = await tx.order.findFirst({ where: { id, tenantId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      return this.response(order);
    });
  }

  async list(tenantId: string, query: OrderListQuery): Promise<OrderPageResponse> {
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const orders = await tx.order.findMany({
        where: { tenantId, status: query.status },
        include: { items: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
        take: limit + 1,
      });
      const hasMore = orders.length > limit;
      const items = orders.slice(0, limit);
      return {
        items: items.map((order) => this.response(order)),
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      };
    });
  }

  async cancel(
    tenantId: string,
    actorId: string,
    id: string,
    input: CancelOrderRequest,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:order:${id}`);
        const order = await tx.order.findFirst({
          where: { id, tenantId },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Order not found');
        assertOrderTransition(order.status as OrderStatus, 'canceled');
        for (const variantId of order.items.map((item) => item.variantId).sort())
          await this.lock(tx, `${tenantId}:${variantId}`);
        await tx.inventoryTransaction.createMany({
          data: order.items.map((item) => ({
            tenantId,
            variantId: item.variantId,
            type: 'unlock',
            qtyChange: item.quantity,
            referenceType: 'order',
            referenceId: order.id,
            reason: 'Released when order was canceled',
            operatorId: actorId,
          })),
        });
        return this.response(
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'canceled',
              canceledAt: new Date(),
              canceledBy: actorId,
              cancelReason: input.reason,
            },
            include: { items: true },
          }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  async expirePending(tenantId: string, requestedLimit?: number): Promise<ExpireOrdersResponse> {
    const limit = Math.min(Math.max(Number(requestedLimit ?? 100), 1), 100);
    const now = new Date();
    const candidates = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.order.findMany({
        where: { tenantId, status: 'pending', expiresAt: { lte: now } },
        select: { id: true },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: limit,
      });
    });
    const orderIds: string[] = [];
    for (const candidate of candidates) {
      if (await this.expireOne(tenantId, candidate.id, now)) orderIds.push(candidate.id);
    }
    return { scanned: candidates.length, expired: orderIds.length, orderIds };
  }

  private expireOne(tenantId: string, id: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:order:${id}`);
        const order = await tx.order.findFirst({
          where: { id, tenantId },
          include: { items: true },
        });
        if (!order || order.status !== 'pending' || order.expiresAt > now) return false;
        assertOrderTransition('pending', 'expired');
        for (const variantId of order.items.map((item) => item.variantId).sort())
          await this.lock(tx, `${tenantId}:${variantId}`);
        const updated = await tx.order.updateMany({
          where: { id, tenantId, status: 'pending', expiresAt: { lte: now } },
          data: { status: 'expired', expiredAt: now },
        });
        if (updated.count !== 1) return false;
        await tx.inventoryTransaction.createMany({
          data: order.items.map((item) => ({
            tenantId,
            variantId: item.variantId,
            type: 'unlock',
            qtyChange: item.quantity,
            referenceType: 'order',
            referenceId: order.id,
            reason: 'Released when payment window expired',
          })),
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  private setTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }

  private async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  private response(order: OrderWithItems): OrderResponse {
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status as OrderStatus,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      shippingFee: order.shippingFee.toFixed(2),
      total: order.total.toFixed(2),
      remark: order.remark,
      cancelReason: order.cancelReason,
      canceledAt: order.canceledAt?.toISOString() ?? null,
      expiresAt: order.expiresAt.toISOString(),
      expiredAt: order.expiredAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        specs: item.specs,
        unitPrice: item.unitPrice.toFixed(2),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toFixed(2),
      })),
    };
  }
}
