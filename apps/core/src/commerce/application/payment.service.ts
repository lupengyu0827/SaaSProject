import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  CreatePaymentCheckoutRequest,
  PaymentChannel,
  PaymentCheckoutResponse,
  PaymentResponse,
  PaymentStatus,
} from '@saas/contracts';

import { Prisma, type Payment } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { assertOrderTransition } from '../domain/order.rules.js';
import {
  assertPaidAmount,
  assertPaymentChannel,
  assertPaymentTransition,
} from '../domain/payment.rules.js';
import { assertMoney } from '../domain/product.rules.js';
import { PaymentProviderRegistry } from '../infrastructure/payment-provider.registry.js';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  async create(
    tenantId: string,
    actorId: string,
    input: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    if (!input.idempotencyKey?.trim() || input.idempotencyKey.length > 100)
      throw new ConflictException('A valid idempotency key is required');
    assertPaymentChannel(input.channel);
    const paymentId = randomUUID();
    const paymentNo = `P${Date.now()}${paymentId.replaceAll('-', '').slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:payment-idempotency:${input.idempotencyKey}`);
        const existing = await tx.payment.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) {
          if (existing.orderId !== input.orderId || existing.channel !== input.channel)
            throw new ConflictException('Idempotency key was already used for another payment');
          return this.response(existing);
        }
        await this.lock(tx, `${tenantId}:order:${input.orderId}`);
        const order = await tx.order.findFirst({ where: { id: input.orderId, tenantId } });
        if (!order) throw new NotFoundException('Order not found');
        if (order.status !== 'pending')
          throw new ConflictException('Only pending orders can create a payment');
        return this.response(
          await tx.payment.create({
            data: {
              id: paymentId,
              tenantId,
              orderId: order.id,
              paymentNo,
              idempotencyKey: input.idempotencyKey,
              channel: input.channel,
              amount: order.total,
              createdBy: actorId,
            },
          }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  }

  async get(tenantId: string, id: string): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const payment = await tx.payment.findFirst({ where: { id, tenantId } });
      if (!payment) throw new NotFoundException('Payment not found');
      return this.response(payment);
    });
  }

  async checkout(
    tenantId: string,
    id: string,
    input: CreatePaymentCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    const context = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const payment = await tx.payment.findFirst({
        where: { id, tenantId },
        include: { order: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== 'pending')
        throw new ConflictException('Only pending payments can create checkout parameters');
      if (payment.order.status !== 'pending' || payment.order.expiresAt <= new Date())
        throw new ConflictException('Order is no longer payable');
      return {
        tenantId,
        paymentId: payment.id,
        paymentNo: payment.paymentNo,
        channel: payment.channel as PaymentChannel,
        amount: payment.amount.toFixed(2),
        description: `Order ${payment.order.orderNo}`,
        expiresAt: payment.order.expiresAt,
      };
    });
    const payload = await this.providers.get(context.channel).createPayment({
      ...context,
      openId: input.openId,
    });
    return { paymentId: context.paymentId, channel: context.channel, payload };
  }

  async confirm(
    tenantId: string,
    id: string,
    input: ConfirmPaymentRequest,
  ): Promise<PaymentResponse> {
    if (!input.eventId?.trim() || !input.providerTradeNo?.trim())
      throw new ConflictException('Provider event and trade number are required');
    assertMoney(input.paidAmount, 'paidAmount');

    return this.prisma.$transaction(
      async (tx) => {
        await this.setTenant(tx, tenantId);
        await this.lock(tx, `${tenantId}:payment:${id}`);
        const payment = await tx.payment.findFirst({
          where: { id, tenantId },
          include: { order: { include: { items: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.status !== 'pending') {
          if (
            payment.callbackEventId === input.eventId &&
            payment.providerTradeNo === input.providerTradeNo
          )
            return this.response(payment);
          throw new ConflictException('Payment has already reached a terminal state');
        }
        const next: PaymentStatus = input.succeeded ? 'succeeded' : 'failed';
        assertPaymentTransition(payment.status, next);
        if (!input.succeeded) {
          return this.response(
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: 'failed',
                callbackEventId: input.eventId,
                providerTradeNo: input.providerTradeNo,
                failureReason: input.failureReason ?? 'Provider reported payment failure',
              },
            }),
          );
        }

        assertPaidAmount(
          payment.amount.toFixed(2),
          new Prisma.Decimal(input.paidAmount).toFixed(2),
        );
        await this.lock(tx, `${tenantId}:order:${payment.orderId}`);
        assertOrderTransition(payment.order.status as 'pending', 'paid');
        for (const variantId of payment.order.items.map((item) => item.variantId).sort())
          await this.lock(tx, `${tenantId}:${variantId}`);
        await tx.inventoryTransaction.createMany({
          data: payment.order.items.flatMap((item) => [
            {
              tenantId,
              variantId: item.variantId,
              type: 'out',
              qtyChange: -item.quantity,
              referenceType: 'order',
              referenceId: payment.orderId,
              reason: 'Deducted after successful payment',
            },
            {
              tenantId,
              variantId: item.variantId,
              type: 'unlock',
              qtyChange: item.quantity,
              referenceType: 'order',
              referenceId: payment.orderId,
              reason: 'Released after successful inventory deduction',
            },
          ]),
        });
        const orderUpdate = await tx.order.updateMany({
          where: { id: payment.orderId, tenantId, status: 'pending' },
          data: { status: 'paid' },
        });
        if (orderUpdate.count !== 1)
          throw new ConflictException('Order is no longer awaiting payment');
        return this.response(
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'succeeded',
              callbackEventId: input.eventId,
              providerTradeNo: input.providerTradeNo,
              paidAt: new Date(),
              failureReason: null,
            },
          }),
        );
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

  private response(payment: Payment): PaymentResponse {
    return {
      id: payment.id,
      orderId: payment.orderId,
      paymentNo: payment.paymentNo,
      channel: payment.channel as PaymentChannel,
      status: payment.status as PaymentStatus,
      amount: payment.amount.toFixed(2),
      providerTradeNo: payment.providerTradeNo,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
