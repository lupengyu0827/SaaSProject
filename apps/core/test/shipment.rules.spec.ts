/** 发货领域规则单元测试。 */
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertCreateShipment,
  assertShippableQuantity,
} from '../src/commerce/domain/shipment.rules.js';

describe('shipment domain rules', () => {
  it('accepts a full-shipment command without explicit items', () => {
    expect(() =>
      assertCreateShipment({
        carrierCode: 'SF',
        carrierName: '顺丰速运',
        trackingNo: 'SF1234567890',
      }),
    ).not.toThrow();
  });

  it('rejects duplicate order items in one shipment', () => {
    expect(() =>
      assertCreateShipment({
        carrierCode: 'SF',
        carrierName: '顺丰速运',
        trackingNo: 'SF1234567890',
        items: [
          { orderItemId: 'item-a', quantity: 1 },
          { orderItemId: 'item-a', quantity: 1 },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it('rejects a quantity greater than the remaining quantity', () => {
    expect(() => assertShippableQuantity(3, 2)).toThrow(ConflictException);
  });

  it('accepts a partial quantity within the remaining quantity', () => {
    expect(() => assertShippableQuantity(1, 2)).not.toThrow();
  });
});
