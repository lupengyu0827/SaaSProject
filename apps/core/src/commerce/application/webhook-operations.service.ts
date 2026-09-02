/** 回调运营服务：聚合支付/退款死信，并提供经过审计的人工重放用例。 */
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  ReplayWebhookResponse,
  WebhookDeadLetterResponse,
  WebhookEventKind,
} from '@saas/contracts';

import { PaymentWebhookInboxService } from './payment-webhook-inbox.service.js';
import { RefundWebhookInboxService } from './refund-webhook-inbox.service.js';

@Injectable()
export class WebhookOperationsService {
  constructor(
    @Inject(PaymentWebhookInboxService) private readonly payments: PaymentWebhookInboxService,
    @Inject(RefundWebhookInboxService) private readonly refunds: RefundWebhookInboxService,
  ) {}

  /** 查询当前租户支付与退款回调死信。 */
  async listDeadLetters(tenantId: string): Promise<WebhookDeadLetterResponse[]> {
    const [payments, refunds] = await Promise.all([
      this.payments.listDeadLetters(tenantId),
      this.refunds.listDeadLetters(tenantId),
    ]);
    return [...payments, ...refunds].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  /** 人工重放一个死信事件。 */
  async replay(
    tenantId: string,
    actorId: string,
    kind: WebhookEventKind,
    rawId: string,
  ): Promise<ReplayWebhookResponse> {
    if (!/^\d+$/.test(rawId)) throw new ConflictException('A valid dead letter ID is required');
    const id = BigInt(rawId);
    if (kind === 'payment') await this.payments.replay(tenantId, actorId, id);
    else if (kind === 'refund') await this.refunds.replay(tenantId, actorId, id);
    else throw new ConflictException('Unsupported webhook event kind');
    return { replayed: true, id: rawId, kind };
  }
}
