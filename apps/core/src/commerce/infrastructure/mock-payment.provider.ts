import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  CreateProviderPaymentInput,
  CreateProviderRefundInput,
  CreateProviderRefundResult,
  PaymentProvider,
  QueryProviderPaymentInput,
  QueryProviderPaymentResult,
  ProviderTradeBillEntry,
} from './payment-provider.js';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly channel = 'mock' as const;

  createPayment(input: CreateProviderPaymentInput): Promise<Record<string, string>> {
    const secret = process.env.MOCK_PAYMENT_SECRET ?? 'local-mock-payment-secret';
    const token = createHmac('sha256', secret).update(input.paymentNo).digest('hex');
    return Promise.resolve({
      type: 'mock',
      paymentNo: input.paymentNo,
      token,
      expiresAt: input.expiresAt.toISOString(),
    });
  }

  /** 本地渠道同步完成退款，便于开发与 E2E 验证完整闭环。 */
  createRefund(input: CreateProviderRefundInput): Promise<CreateProviderRefundResult> {
    const digest = createHmac(
      'sha256',
      process.env.MOCK_PAYMENT_SECRET ?? 'local-mock-payment-secret',
    )
      .update(input.refundNo)
      .digest('hex');
    return Promise.resolve({
      providerRefundNo: `mock-refund-${digest.slice(0, 24)}`,
      eventId: `mock-refund-event-${digest.slice(0, 24)}`,
      status: 'succeeded',
    });
  }

  /** Mock 支付默认保持待支付，测试可通过真实回调推进状态。 */
  queryPayment(input: QueryProviderPaymentInput): Promise<QueryProviderPaymentResult> {
    void input;
    return Promise.resolve({ status: 'pending' });
  }

  downloadTradeBill(billDate: string): Promise<ProviderTradeBillEntry[]> {
    void billDate;
    return Promise.resolve([]);
  }
}
