/** 退款回调 Inbox：持久化已验签事件，并以指数退避方式幂等消费。 */
import { createHash } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { RefundService } from './refund.service.js';

export interface RefundWebhookPayload {
  refundId: string;
  providerRefundNo: string;
  refundedAmount: string;
  succeeded: boolean;
  failureReason?: string;
}

@Injectable()
export class RefundWebhookInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundService,
  ) {}

  /** 幂等写入已通过渠道验签的退款事件。 */
  enqueue(
    tenantId: string,
    channel: string,
    eventId: string,
    payload: RefundWebhookPayload,
  ): Promise<void> {
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:refund:${channel}:${eventId}`}, 0))`;
      const existing = await tx.refundWebhookEvent.findUnique({
        where: { tenantId_channel_eventId: { tenantId, channel, eventId } },
      });
      if (existing) {
        if (existing.payloadFingerprint !== fingerprint)
          throw new ConflictException('Refund webhook event ID was reused with different content');
        return;
      }
      await tx.refundWebhookEvent.create({
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

  /** 消费指定租户到期的退款事件。 */
  async processPending(tenantId: string, limit = 100): Promise<number> {
    const events = await this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.refundWebhookEvent.findMany({
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
      const payload = event.payload as unknown as RefundWebhookPayload;
      try {
        await this.refunds.confirm(tenantId, tenantId, payload.refundId, {
          eventId: event.eventId,
          providerRefundNo: payload.providerRefundNo,
          refundedAmount: payload.refundedAmount,
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

  private markProcessed(tenantId: string, id: bigint): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.refundWebhookEvent.updateMany({
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
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown refund error';
    return this.prisma.$transaction(async (tx) => {
      await this.setTenant(tx, tenantId);
      return tx.refundWebhookEvent.updateMany({
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
