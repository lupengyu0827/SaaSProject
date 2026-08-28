import { ConflictException } from '@nestjs/common';
import type { PaymentChannel, PaymentStatus } from '@saas/contracts';

export function assertPaymentChannel(channel: PaymentChannel): void {
  if (!['mock', 'wechat_pay', 'alipay', 'stripe'].includes(channel))
    throw new ConflictException('Unsupported payment channel');
}

export function assertPaymentTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (current !== 'pending' || !['succeeded', 'failed'].includes(next))
    throw new ConflictException(`Payment cannot transition from ${current} to ${next}`);
}

export function assertPaidAmount(expected: string, actual: string): void {
  if (expected !== actual) throw new ConflictException('Paid amount does not match order total');
}
