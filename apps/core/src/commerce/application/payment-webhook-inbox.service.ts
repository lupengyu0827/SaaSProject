import { createHash } from 'node:crypto';

import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { PaymentService } from './payment.service.js';
import type { WebhookDeadLetterResponse } from '@saas/contracts';

export interface PaymentWebhookPayload {
  paymentId: string;
  paymentNo: string;
  providerTradeNo: string;
  paidAmount: string;
  succeeded: boolean;
  failureReason?: string;
}

@Injectable()
export class PaymentWebhookInboxService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PaymentService)
    private readonly payments: PaymentService,
  ) {}

  enqueue(
    tenantId: string,
    channel: string,
    eventId: string,
    payload: PaymentWebhookPayload,
  ): Promise<void> {
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${channel}:${eventId}`}, 0))`;
      const existing = await tx.paymentWebhookEvent.findUnique({
        where: { tenantId_channel_eventId: { tenantId, channel, eventId } },
      });
      if (existing) {
        if (existing.payloadFingerprint !== fingerprint)
          throw new ConflictException('Webhook event ID was reused with different content');
        return;
      }
      await tx.paymentWebhookEvent.create({
        data: {
          tenantId,
          channel,
          eventId,
          payloadFingerprint: fingerprint,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async processPending(tenantId: string, limit = 100): Promise<number> {
    const events = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.paymentWebhookEvent.findMany({
        where: {
          tenantId,
          status: { in: ['pending', 'failed'] },
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
        take: Math.min(Math.max(limit, 1), 100),
      });
    });
    let processed = 0;
    for (const event of events) {
      const payload = event.payload as unknown as PaymentWebhookPayload;
      try {
        const payment = await this.payments.get(tenantId, payload.paymentId);
        if (payment.channel !== event.channel || payment.paymentNo !== payload.paymentNo)
          throw new ConflictException('Webhook does not match its payment');
        await this.payments.confirm(tenantId, payload.paymentId, {
          eventId: event.eventId,
          paidAmount: payload.paidAmount,
          providerTradeNo: payload.providerTradeNo,
          succeeded: payload.succeeded,
          failureReason: payload.failureReason,
        });
        await this.markProcessed(tenantId, event.id);
        processed += 1;
      } catch (error: unknown) {
        await this.markFailed(tenantId, event.id, event.attempts, error);
      }
    }
    return processed;
  }

  /** 查询支付回调死信摘要。 */
  async listDeadLetters(tenantId: string): Promise<WebhookDeadLetterResponse[]> {
    const events = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.paymentWebhookEvent.findMany({
        where: { tenantId, status: 'dead_letter' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
    return events.map((event) => ({
      id: event.id.toString(),
      kind: 'payment',
      channel: event.channel,
      eventId: event.eventId,
      attempts: event.attempts,
      lastError: event.lastError,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  /** 将指定支付死信恢复为待处理，并记录人工操作审计。 */
  async replay(tenantId: string, actorId: string, id: bigint): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      const updated = await tx.paymentWebhookEvent.updateMany({
        where: { id, tenantId, status: 'dead_letter' },
        data: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null },
      });
      if (updated.count !== 1) throw new ConflictException('Payment dead letter was not found');
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorType: 'admin',
          action: 'replay',
          resourceType: 'payment_webhook',
          resourceId: id.toString(),
          diff: { previousStatus: 'dead_letter', status: 'pending' },
        },
      });
    });
  }

  private markProcessed(tenantId: string, id: bigint): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.paymentWebhookEvent.updateMany({
        where: { id, tenantId, status: { in: ['pending', 'failed'] } },
        data: { status: 'processed', processedAt: new Date(), lastError: null },
      });
    });
  }

  private markFailed(
    tenantId: string,
    id: bigint,
    attempts: number,
    error: unknown,
  ): Promise<unknown> {
    const nextAttempts = attempts + 1;
    const delayMs = Math.min(2 ** nextAttempts * 1000, 60 * 60 * 1000);
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown webhook error';
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.paymentWebhookEvent.updateMany({
        where: { id, tenantId, status: { in: ['pending', 'failed'] } },
        data: {
          status: nextAttempts >= 10 ? 'dead_letter' : 'failed',
          attempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + delayMs),
          lastError: message,
        },
      });
    });
  }

  private setTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }
}
