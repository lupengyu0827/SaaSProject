import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { assertCreateOrder, assertOrderTransition } from '../src/commerce/domain/order.rules.js';

describe('order domain rules', () => {
  it('accepts a valid order command', () => {
    expect(() =>
      assertCreateOrder({
        idempotencyKey: 'checkout-1',
        items: [{ variantId: 'variant-a', quantity: 2 }],
        shippingAddress: { city: 'Shanghai' },
      }),
    ).not.toThrow();
  });

  it('rejects duplicate SKUs because each SKU maps to one inventory lock', () => {
    expect(() =>
      assertCreateOrder({
        idempotencyKey: 'checkout-1',
        items: [
          { variantId: 'variant-a', quantity: 1 },
          { variantId: 'variant-a', quantity: 2 },
        ],
        shippingAddress: {},
      }),
    ).toThrow(ConflictException);
  });

  it('allows pending orders to be canceled', () => {
    expect(() => assertOrderTransition('pending', 'canceled')).not.toThrow();
  });

  it('allows pending orders to expire', () => {
    expect(() => assertOrderTransition('pending', 'expired')).not.toThrow();
  });

  it('rejects canceling a fulfilled order', () => {
    expect(() => assertOrderTransition('fulfilled', 'canceled')).toThrow(ConflictException);
  });
});
