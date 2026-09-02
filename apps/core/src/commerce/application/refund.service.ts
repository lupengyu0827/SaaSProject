/** 退款应用服务：创建退款申请、校验可退上限并执行人工审核。 */
import { createHash, randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConfirmRefundRequest,
  CreateRefundRequest,
  OrderStatus,
  PaymentChannel,
  RefundResponse,
  RefundStatus,
  ReviewRefundRequest,
} from '@saas/contracts';

import {
  Prisma,
  type Refund,
  type RefundItem,
  type RefundTransaction,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import {
  assertCreateRefund,
  assertRefundableQuantity,
  assertRefundTransition,
  assertReviewRefund,
} from '../domain/refund.rules.js';
import { assertMoney } from '../domain/product.rules.js';
import { PaymentProviderRegistry } from '../infrastructure/payment-provider.registry.js';

type RefundWithItems = Refund & {
  items: RefundItem[];
  transactions: RefundTransaction[];
};

@Injectable()
export class RefundService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentProviderRegistry) private readonly providers: PaymentProviderRegistry,
  ) {}

  /** 为已支付或已发货订单提交退款申请。 */
  async create(
    tenantId: string,
    actorId: string,
    orderId: string,
    input: CreateRefundRequest,
  ): Promise<RefundResponse> {
    assertCreateRefund(input);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:refund-idempotency:${input.idempotencyKey}`);
        const existing = await tx.refund.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          include: { items: true, transactions: true },
        });
        if (existing) {
          if (existing.requestFingerprint !== fingerprint)
            throw new ConflictException('Idempotency key was already used for another refund');
          return this.response(existing);
        }
        await this.lock(tx, `${tenantId}:order:${orderId}`);
        const order = await tx.order.findFirst({
          where: { id: orderId, tenantId },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (!['paid', 'fulfilled', 'partially_refunded'].includes(order.status))
          throw new ConflictException(
            'Only paid, fulfilled or partially refunded orders can request refunds',
          );

        const reservedItems = await tx.refundItem.findMany({
          where: {
            tenantId,
            orderItem: { orderId },
            refund: { status: { in: ['pending_review', 'approved', 'succeeded'] } },
          },
          select: { orderItemId: true, quantity: true },
        });
        const reservedByOrderItem = this.sumReservedQuantities(reservedItems);
        const orderItemById = new Map(order.items.map((item) => [item.id, item]));
        const refundItems = input.items.map((item) => {
          const orderItem = orderItemById.get(item.orderItemId);
          if (!orderItem) throw new NotFoundException('Refund order item was not found');
          const remaining = orderItem.quantity - (reservedByOrderItem.get(orderItem.id) ?? 0);
          assertRefundableQuantity(item.quantity, remaining);
          return {
            orderItemId: orderItem.id,
            quantity: item.quantity,
            amount: orderItem.unitPrice.mul(item.quantity),
          };
        });
        const amount = refundItems.reduce(
          (total, item) => total.plus(item.amount),
          new Prisma.Decimal(0),
        );
        if (amount.greaterThan(order.total))
          throw new ConflictException('Refund amount exceeds the order total');
        const reservedAmount = await tx.refund.aggregate({
          where: {
            tenantId,
            orderId,
            status: { in: ['pending_review', 'approved', 'succeeded'] },
          },
          _sum: { amount: true },
        });
        if (amount.plus(reservedAmount._sum.amount ?? 0).greaterThan(order.total))
          throw new ConflictException('Cumulative refund amount exceeds the order total');

        const refundId = randomUUID();
        const refundNo = `R${Date.now()}${refundId.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
        const refund = await tx.refund.create({
          data: {
            id: refundId,
            tenantId,
            orderId,
            refundNo,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            reason: input.reason.trim(),
            amount,
            createdBy: actorId,
            items: {
              create: refundItems.map((item) => ({
                tenantId,
                orderItemId: item.orderItemId,
                quantity: item.quantity,
                amount: item.amount,
              })),
            },
          },
          include: { items: true, transactions: true },
        });
        await this.recordAudit(tx, tenantId, actorId, 'create', refund);
        await this.recordUsage(tx, tenantId);
        return this.response(refund);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  /** 审核退款申请；通过后等待下一阶段调用支付渠道退款。 */
  async review(
    tenantId: string,
    actorId: string,
    refundId: string,
    input: ReviewRefundRequest,
  ): Promise<RefundResponse> {
    assertReviewRefund(input);
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:refund:${refundId}`);
        const refund = await tx.refund.findFirst({
          where: { id: refundId, tenantId },
          include: { items: true, transactions: true },
        });
        if (!refund) throw new NotFoundException('Refund not found');
        const next: RefundStatus = input.approved ? 'approved' : 'rejected';
        assertRefundTransition(refund.status as RefundStatus, next);
        const updated = await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: next,
            reviewNote: input.note?.trim() || null,
            reviewedBy: actorId,
            reviewedAt: new Date(),
            version: { increment: 1 },
          },
          include: { items: true, transactions: true },
        });
        await this.recordAudit(tx, tenantId, actorId, 'review', updated);
        return this.response(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  /** 通过原支付渠道发起退款；渠道由成功支付记录决定，客户端不可指定。 */
  async execute(tenantId: string, actorId: string, refundId: string): Promise<RefundResponse> {
    const context = await this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:refund:${refundId}`);
        const refund = await tx.refund.findFirst({
          where: { id: refundId, tenantId },
          include: {
            items: true,
            transactions: true,
            order: {
              include: {
                payments: { where: { status: 'succeeded' }, orderBy: { paidAt: 'desc' } },
              },
            },
          },
        });
        if (!refund) throw new NotFoundException('Refund not found');
        const existing = refund.transactions[0];
        if (existing) return { refund, transaction: existing, payment: null };
        if (refund.status !== 'approved')
          throw new ConflictException('Only approved refunds can be executed');
        const payment = refund.order.payments[0];
        if (!payment?.providerTradeNo)
          throw new ConflictException('A succeeded provider payment is required for refund');
        const transaction = await tx.refundTransaction.create({
          data: {
            tenantId,
            refundId: refund.id,
            channel: payment.channel,
            amount: refund.amount,
          },
        });
        await tx.providerCallbackRoute.upsert({
          where: {
            channel_resourceType_externalNo: {
              channel: payment.channel,
              resourceType: 'refund',
              externalNo: refund.refundNo,
            },
          },
          create: {
            tenantId,
            channel: payment.channel,
            resourceType: 'refund',
            externalNo: refund.refundNo,
            resourceId: refund.id,
          },
          update: { tenantId, resourceId: refund.id },
        });
        await this.recordAudit(tx, tenantId, actorId, 'execute', refund);
        return { refund, transaction, payment };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
    if (!context.payment) return this.get(tenantId, refundId);
    const providerTradeNo = context.payment.providerTradeNo;
    if (!providerTradeNo)
      throw new ConflictException('A succeeded provider payment is required for refund');
    const result = await this.providers
      .get(context.payment.channel as PaymentChannel)
      .createRefund({
        tenantId,
        refundId,
        refundNo: context.refund.refundNo,
        providerTradeNo,
        amount: context.refund.amount.toFixed(2),
        originalAmount: context.payment.amount.toFixed(2),
        reason: context.refund.reason,
      });
    if (result.status === 'succeeded') {
      return this.confirm(tenantId, actorId, refundId, {
        eventId: result.eventId,
        providerRefundNo: result.providerRefundNo,
        refundedAmount: context.refund.amount.toFixed(2),
        succeeded: true,
      });
    }
    await this.updatePendingTransaction(tenantId, context.transaction.id, result);
    return this.get(tenantId, refundId);
  }

  /** 幂等确认渠道退款，并在成功时回补库存、更新订单退款状态。 */
  async confirm(
    tenantId: string,
    actorId: string,
    refundId: string,
    input: ConfirmRefundRequest,
  ): Promise<RefundResponse> {
    if (!input.eventId?.trim() || !input.providerRefundNo?.trim())
      throw new ConflictException('Provider refund event and number are required');
    assertMoney(input.refundedAmount, 'refundedAmount');
    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:refund:${refundId}`);
        const refund = await tx.refund.findFirst({
          where: { id: refundId, tenantId },
          include: {
            items: { include: { orderItem: true } },
            transactions: true,
            order: { include: { items: true } },
          },
        });
        if (!refund) throw new NotFoundException('Refund not found');
        const transaction = refund.transactions[0];
        if (!transaction) throw new ConflictException('Refund has not been sent to a provider');
        if (transaction.status !== 'pending') {
          if (transaction.eventId === input.eventId) return this.getWithin(tx, refundId, tenantId);
          throw new ConflictException('Refund transaction has already reached a terminal state');
        }
        if (!refund.amount.equals(new Prisma.Decimal(input.refundedAmount)))
          throw new ConflictException('Provider refunded amount does not match the refund');
        const next: RefundStatus = input.succeeded ? 'succeeded' : 'failed';
        assertRefundTransition(refund.status as RefundStatus, next);
        await tx.refundTransaction.update({
          where: { id: transaction.id },
          data: {
            status: next,
            eventId: input.eventId,
            providerRefundNo: input.providerRefundNo,
            failureReason: input.succeeded
              ? null
              : (input.failureReason ?? 'Provider refund failed'),
          },
        });
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: next, version: { increment: 1 } },
        });
        if (input.succeeded) await this.restoreInventoryAndOrder(tx, tenantId, actorId, refund);
        await this.recordAudit(tx, tenantId, actorId, 'confirm', { ...refund, status: next });
        return this.getWithin(tx, refundId, tenantId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  /** 查询单笔退款及渠道流水。 */
  get(tenantId: string, refundId: string): Promise<RefundResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return this.getWithin(tx, refundId, tenantId);
    });
  }

  /** 查询订单的退款申请。 */
  list(tenantId: string, orderId: string): Promise<RefundResponse[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      const refunds = await tx.refund.findMany({
        where: { tenantId, orderId },
        include: { items: true, transactions: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return refunds.map((refund) => this.response(refund));
    });
  }

  private sumReservedQuantities(
    items: Array<{ orderItemId: string; quantity: number }>,
  ): Map<string, number> {
    const totals = new Map<string, number>();
    for (const item of items)
      totals.set(item.orderItemId, (totals.get(item.orderItemId) ?? 0) + item.quantity);
    return totals;
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    action: string,
    refund: Refund,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorType: 'admin',
        action,
        resourceType: 'refund',
        resourceId: refund.id,
        diff: { orderId: refund.orderId, status: refund.status, amount: refund.amount.toFixed(2) },
      },
    });
  }

  private async updatePendingTransaction(
    tenantId: string,
    transactionId: string,
    result: { providerRefundNo: string; eventId: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      await tx.refundTransaction.update({
        where: { id: transactionId },
        data: { providerRefundNo: result.providerRefundNo, eventId: result.eventId },
      });
    });
  }

  private async restoreInventoryAndOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    refund: Refund & {
      items: Array<RefundItem & { orderItem: { variantId: string } }>;
      order: { id: string; items: Array<{ id: string; quantity: number }> };
    },
  ): Promise<void> {
    for (const variantId of refund.items.map((item) => item.orderItem.variantId).sort())
      await this.lock(tx, `${tenantId}:${variantId}`);
    await tx.inventoryTransaction.createMany({
      data: refund.items.map((item) => ({
        tenantId,
        variantId: item.orderItem.variantId,
        type: 'refund',
        qtyChange: item.quantity,
        referenceType: 'refund',
        referenceId: refund.id,
        reason: 'Restored after successful refund',
        operatorId: actorId,
      })),
      skipDuplicates: true,
    });
    const succeededItems = await tx.refundItem.groupBy({
      by: ['orderItemId'],
      where: { tenantId, refund: { orderId: refund.orderId, status: 'succeeded' } },
      _sum: { quantity: true },
    });
    const refundedByItem = new Map(
      succeededItems.map((item) => [item.orderItemId, item._sum.quantity ?? 0]),
    );
    const fullyRefunded = refund.order.items.every(
      (item) => (refundedByItem.get(item.id) ?? 0) >= item.quantity,
    );
    const status: OrderStatus = fullyRefunded ? 'refunded' : 'partially_refunded';
    await tx.order.updateMany({
      where: {
        id: refund.orderId,
        tenantId,
        status: { in: ['paid', 'fulfilled', 'partially_refunded'] },
      },
      data: { status },
    });
  }

  private async getWithin(
    tx: Prisma.TransactionClient,
    refundId: string,
    tenantId: string,
  ): Promise<RefundResponse> {
    const refund = await tx.refund.findFirst({
      where: { id: refundId, tenantId },
      include: { items: true, transactions: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return this.response(refund);
  }

  private async recordUsage(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);
    await tx.usageMetric.upsert({
      where: { tenantId_metricKey_periodStart: { tenantId, metricKey: 'refunds', periodStart } },
      create: { tenantId, metricKey: 'refunds', amount: 1, periodStart, periodEnd },
      update: { amount: { increment: 1 } },
    });
  }

  private setTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }

  private async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  private response(refund: RefundWithItems): RefundResponse {
    return {
      id: refund.id,
      orderId: refund.orderId,
      refundNo: refund.refundNo,
      status: refund.status as RefundStatus,
      reason: refund.reason,
      amount: refund.amount.toFixed(2),
      reviewNote: refund.reviewNote,
      reviewedAt: refund.reviewedAt?.toISOString() ?? null,
      createdAt: refund.createdAt.toISOString(),
      items: refund.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        amount: item.amount.toFixed(2),
      })),
      transactions: refund.transactions.map((transaction) => ({
        id: transaction.id,
        channel: transaction.channel as PaymentChannel,
        status: transaction.status as 'pending' | 'succeeded' | 'failed',
        amount: transaction.amount.toFixed(2),
        providerRefundNo: transaction.providerRefundNo,
        failureReason: transaction.failureReason,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  }
}
