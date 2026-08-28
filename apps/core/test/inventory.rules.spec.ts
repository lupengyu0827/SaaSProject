import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertInventoryCommand,
  calculateInventoryBalance,
} from '../src/commerce/domain/inventory.rules.js';

describe('inventory ledger rules', () => {
  it('derives on-hand, locked and available stock from immutable ledger entries', () => {
    expect(
      calculateInventoryBalance('variant-a', [
        { type: 'in', qtyChange: 10 },
        { type: 'lock', qtyChange: -3 },
      ]),
    ).toEqual({ variantId: 'variant-a', onHand: 10, locked: 3, available: 7 });
  });

  it('returns locks to zero after deduction and release', () => {
    expect(
      calculateInventoryBalance('variant-a', [
        { type: 'in', qtyChange: 10 },
        { type: 'lock', qtyChange: -3 },
        { type: 'out', qtyChange: -3 },
        { type: 'unlock', qtyChange: 3 },
      ]),
    ).toEqual({ variantId: 'variant-a', onHand: 7, locked: 0, available: 7 });
  });

  it('rejects a lock larger than available stock', () => {
    expect(() =>
      assertInventoryCommand('lock', 4, {
        variantId: 'variant-a',
        onHand: 10,
        locked: 7,
        available: 3,
      }),
    ).toThrow(ConflictException);
  });

  it('rejects adjustments that would cut into locked stock', () => {
    expect(() =>
      assertInventoryCommand('adjustment', -6, {
        variantId: 'variant-a',
        onHand: 10,
        locked: 5,
        available: 5,
      }),
    ).toThrow(ConflictException);
  });
});
