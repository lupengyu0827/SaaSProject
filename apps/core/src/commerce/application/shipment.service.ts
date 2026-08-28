/** 发货应用服务：在租户事务内创建物流单、记录明细并推进订单状态。 */
import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateShipmentRequest, ShipmentResponse, ShipmentStatus } from '@saas/contracts';

import {
  Prisma,
  type OrderItem,
  type Shipment,
  type ShipmentItem,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { assertOrderTransition } from '../domain/order.rules.js';
import { assertCreateShipment, assertShippableQuantity } from '../domain/shipment.rules.js';

type ShipmentWithItems = Shipment & { items: ShipmentItem[] };

@Injectable()
export class ShipmentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** 为已支付订单创建整单或部分物流单。 */
  async create(
    tenantId: string,
    actorId: string,
    orderId: string,
    input: CreateShipmentRequest,
  ): Promise<ShipmentResponse> {
    assertCreateShipment(input);
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:order:${orderId}`);
        const order = await tx.order.findFirst({
          where: { id: orderId, tenantId },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (order.status !== 'paid')
          throw new ConflictException('Only paid orders can create shipments');

        const shippedItems = await tx.shipmentItem.findMany({
          where: { tenantId, orderItem: { orderId } },
          select: { orderItemId: true, quantity: true },
        });
        const shippedByOrderItem = this.sumShippedQuantities(shippedItems);
        const requestedItems = this.resolveRequestedItems(
          order.items,
          shippedByOrderItem,
          input.items,
        );
        const shipmentId = randomUUID();
        const shipmentNo = `S${Date.now()}${shipmentId.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
        const shipment = await tx.shipment.create({
          data: {
            id: shipmentId,
            tenantId,
            orderId,
            shipmentNo,
            carrierCode: input.carrierCode.trim(),
            carrierName: input.carrierName.trim(),
            trackingNo: input.trackingNo.trim(),
            createdBy: actorId,
            items: {
              create: requestedItems.map((item) => ({
                tenantId,
                orderItemId: item.orderItemId,
                quantity: item.quantity,
              })),
            },
          },
          include: { items: true },
        });

        if (this.isOrderFullyShipped(order.items, shippedByOrderItem, requestedItems)) {
          assertOrderTransition('paid', 'fulfilled');
          const updated = await tx.order.updateMany({
            where: { id: orderId, tenantId, status: 'paid' },
            data: { status: 'fulfilled' },
          });
          if (updated.count !== 1) throw new ConflictException('Order is no longer shippable');
        }
        await this.recordAudit(tx, tenantId, actorId, shipment);
        await this.recordUsage(tx, tenantId);
        return this.response(shipment);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  /** 查询订单的全部物流单。 */
  list(tenantId: string, orderId: string): Promise<ShipmentResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      const shipments = await tx.shipment.findMany({
        where: { tenantId, orderId },
        include: { items: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return shipments.map((shipment) => this.response(shipment));
    });
  }

  private resolveRequestedItems(
    orderItems: OrderItem[],
    shippedByOrderItem: ReadonlyMap<string, number>,
    requested?: CreateShipmentRequest['items'],
  ): Array<{ orderItemId: string; quantity: number }> {
    const orderItemById = new Map(orderItems.map((item) => [item.id, item]));
    const items =
      requested ??
      orderItems
        .map((item) => ({
          orderItemId: item.id,
          quantity: item.quantity - (shippedByOrderItem.get(item.id) ?? 0),
        }))
        .filter((item) => item.quantity > 0);
    if (items.length === 0) throw new ConflictException('Order has no remaining items to ship');
    for (const item of items) {
      const orderItem = orderItemById.get(item.orderItemId);
      if (!orderItem) throw new NotFoundException('Shipment order item was not found');
      const remaining = orderItem.quantity - (shippedByOrderItem.get(orderItem.id) ?? 0);
      assertShippableQuantity(item.quantity, remaining);
    }
    return items;
  }

  private sumShippedQuantities(
    items: Array<{ orderItemId: string; quantity: number }>,
  ): Map<string, number> {
    const totals = new Map<string, number>();
    for (const item of items)
      totals.set(item.orderItemId, (totals.get(item.orderItemId) ?? 0) + item.quantity);
    return totals;
  }

  private isOrderFullyShipped(
    orderItems: OrderItem[],
    shippedByOrderItem: ReadonlyMap<string, number>,
    requested: Array<{ orderItemId: string; quantity: number }>,
  ): boolean {
    const current = new Map(requested.map((item) => [item.orderItemId, item.quantity]));
    return orderItems.every(
      (item) =>
        (shippedByOrderItem.get(item.id) ?? 0) + (current.get(item.id) ?? 0) === item.quantity,
    );
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    shipment: Shipment,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorType: 'admin',
        action: 'create',
        resourceType: 'shipment',
        resourceId: shipment.id,
        diff: {
          orderId: shipment.orderId,
          carrierCode: shipment.carrierCode,
          trackingNo: shipment.trackingNo,
        },
      },
    });
  }

  private async recordUsage(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);
    await tx.usageMetric.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey: 'shipments', periodStart } },
      create: { tenantId, metricKey: 'shipments', amount: 1, periodStart, periodEnd },
      update: { amount: { increment: 1 } },
    });
  }

  private setTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }

  private async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  private response(shipment: ShipmentWithItems): ShipmentResponse {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      shipmentNo: shipment.shipmentNo,
      carrierCode: shipment.carrierCode,
      carrierName: shipment.carrierName,
      trackingNo: shipment.trackingNo,
      status: shipment.status as ShipmentStatus,
      shippedAt: shipment.shippedAt.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      createdAt: shipment.createdAt.toISOString(),
      items: shipment.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
    };
  }
}
