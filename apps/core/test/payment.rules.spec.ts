import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertPaidAmount,
  assertPaymentChannel,
  assertPaymentTransition,
} from '../src/commerce/domain/payment.rules.js';

describe('payment domain rules', () => {
  it('accepts supported provider channels', () => {
    expect(() => assertPaymentChannel('wechat_pay')).not.toThrow();
  });

  it('allows a pending payment to succeed', () => {
    expect(() => assertPaymentTransition('pending', 'succeeded')).not.toThrow();
  });

  it('rejects changing a terminal payment', () => {
    expect(() => assertPaymentTransition('succeeded', 'failed')).toThrow(ConflictException);
  });

  it('rejects a callback with a mismatched amount', () => {
    expect(() => assertPaidAmount('99.00', '98.00')).toThrow(ConflictException);
  });
});
