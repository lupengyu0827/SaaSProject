/** 退款领域规则：校验申请、审核动作与状态迁移。 */
import { ConflictException } from '@nestjs/common';
import type { CreateRefundRequest, RefundStatus, ReviewRefundRequest } from '@saas/contracts';

const MAX_IDEMPOTENCY_KEY_LENGTH = 100;
const MAX_REASON_LENGTH = 500;

/** 校验退款申请命令。 */
export function assertCreateRefund(input: CreateRefundRequest): void {
  if (!input.idempotencyKey?.trim() || input.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH)
    throw new ConflictException('A valid refund idempotency key is required');
  if (!input.reason?.trim() || input.reason.trim().length > MAX_REASON_LENGTH)
    throw new ConflictException('A valid refund reason is required');
  if (!input.items.length) throw new ConflictException('Refund must contain at least one item');
  const orderItemIds = new Set<string>();
  for (const item of input.items) {
    if (!item.orderItemId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new ConflictException('Each refund item requires an order item and quantity');
    if (orderItemIds.has(item.orderItemId))
      throw new ConflictException('Duplicate order item in refund');
    orderItemIds.add(item.orderItemId);
  }
}

/** 校验退款审核命令。 */
export function assertReviewRefund(input: ReviewRefundRequest): void {
  if (typeof input.approved !== 'boolean')
    throw new ConflictException('Refund review decision is required');
  if (input.note && input.note.trim().length > MAX_REASON_LENGTH)
    throw new ConflictException('Refund review note is too long');
}

/** 校验退款状态迁移。 */
export function assertRefundTransition(current: RefundStatus, next: RefundStatus): void {
  const allowed: Record<RefundStatus, RefundStatus[]> = {
    pending_review: ['approved', 'rejected'],
    approved: ['succeeded', 'failed'],
    rejected: [],
    succeeded: [],
    failed: [],
  };
  if (!allowed[current].includes(next))
    throw new ConflictException(`Refund cannot transition from ${current} to ${next}`);
}

/** 校验申请数量不超过订单剩余可退数量。 */
export function assertRefundableQuantity(requested: number, remaining: number): void {
  if (remaining <= 0) throw new ConflictException('Order item has already been fully refunded');
  if (requested > remaining)
    throw new ConflictException('Refund quantity exceeds the remaining order quantity');
}
