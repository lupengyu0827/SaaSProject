/** 退款领域规则单元测试。 */
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertCreateRefund,
  assertRefundableQuantity,
  assertRefundTransition,
  assertReviewRefund,
} from '../src/commerce/domain/refund.rules.js';

describe('refund domain rules', () => {
  it('accepts a valid refund request', () => {
    expect(() =>
      assertCreateRefund({
        idempotencyKey: 'refund-1',
        reason: '商品与描述不符',
        items: [{ orderItemId: 'item-a', quantity: 1 }],
      }),
    ).not.toThrow();
  });

  it('rejects duplicate order items', () => {
    expect(() =>
      assertCreateRefund({
        idempotencyKey: 'refund-1',
        reason: '重复明细测试',
        items: [
          { orderItemId: 'item-a', quantity: 1 },
          { orderItemId: 'item-a', quantity: 1 },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it('allows pending review to be approved', () => {
    expect(() => assertRefundTransition('pending_review', 'approved')).not.toThrow();
  });

  it('rejects reviewing an already rejected refund', () => {
    expect(() => assertRefundTransition('rejected', 'approved')).toThrow(ConflictException);
  });

  it('rejects quantities over the refundable balance', () => {
    expect(() => assertRefundableQuantity(2, 1)).toThrow(ConflictException);
  });

  it('requires an explicit review decision', () => {
    expect(() => assertReviewRefund({ approved: undefined as unknown as boolean })).toThrow(
      ConflictException,
    );
  });
});
