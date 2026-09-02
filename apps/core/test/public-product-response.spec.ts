/** 消费者商品读模型测试：确保成本、内部备注和版本信息不会越过公开边界。 */
import type { ProductResponse } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import { toPublicProductResponse } from '../src/commerce/application/product.service.js';

describe('public product response', () => {
  it('keeps display fields and removes merchant-only fields', () => {
    const result = toPublicProductResponse(product());
    const serialized = JSON.stringify(result);

    expect(result.minimumPrice).toBe('12800.00');
    expect(result.attributes.appraisalCertificateNo).toBe('CERT-001');
    expect(serialized).not.toContain('costPrice');
    expect(serialized).not.toContain('internal note');
    expect(serialized).not.toContain('serialNumber');
    expect(serialized).not.toContain('version');
    expect(serialized).not.toContain('deletedAt');
  });
});

function product(): ProductResponse {
  return {
    id: 'product-1',
    code: 'OBJ-001',
    name: '典藏手袋',
    description: '公开说明',
    categoryId: null,
    brandId: null,
    attributes: {
      conditionGrade: 'excellent',
      authenticityStatus: 'authenticated',
      serialNumber: 'PRIVATE-SERIAL',
      remarks: 'internal note',
      appraisalCertificateNo: 'CERT-001',
    },
    seoSlug: null,
    status: 'active',
    version: 3,
    variants: [
      {
        id: 'variant-1',
        sku: 'PRIVATE-SKU',
        specs: { color: 'black' },
        price: '12800.00',
        costPrice: '7000.00',
        weightG: null,
        version: 2,
        stockQty: 1,
        availableStockQty: 1,
      },
    ],
    images: [],
    primaryImage: null,
    stockQty: 1,
    availableStockQty: 1,
    minimumPrice: '12800.00',
    maximumPrice: '12800.00',
    deletedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T01:00:00.000Z',
  };
}
