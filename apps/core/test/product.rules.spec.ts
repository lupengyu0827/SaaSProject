import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertCreateProduct,
  assertMoney,
  assertStatusTransition,
} from '../src/commerce/domain/product.rules.js';

describe('product domain rules', () => {
  it('requires at least one unique SKU', () => {
    expect(() =>
      assertCreateProduct({
        code: 'P-1',
        name: 'Product',
        variants: [
          { sku: 'SKU-1', price: '10.00' },
          { sku: 'SKU-1', price: '20.00' },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it('rejects floating point formats that exceed database money precision', () => {
    expect(() => assertMoney('12.345', 'price')).toThrow(ConflictException);
    expect(() => assertMoney('-1.00', 'price')).toThrow(ConflictException);
  });

  it('does not allow an archived product to return to active', () => {
    expect(() => assertStatusTransition('archived', 'active')).toThrow(ConflictException);
  });
});
