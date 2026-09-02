/** 商品视图转换工具单元测试。 */
import type { PublicProductResponse, PublicProductVariantResponse } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  getLowestPrice,
  getPrimaryImage,
  getVariantSpecText,
} from './product-view';

const BASE_PRODUCT: PublicProductResponse = {
  id: 'product-1',
  code: 'LUX-001',
  name: '测试藏品',
  description: null,
  categoryId: null,
  brandId: null,
  attributes: {},
  variants: [],
  images: [],
  primaryImage: null,
  availableStockQty: 0,
  minimumPrice: '0.00',
  maximumPrice: '0.00',
  createdAt: '2026-08-27T00:00:00.000Z',
};

describe('product view helpers', () => {
  it('formats currency without converting to floating point', () => {
    expect(formatCurrency('1280000.5')).toBe('¥ 1,280,000.50');
  });

  it('selects the exact lowest decimal price', () => {
    const product = {
      ...BASE_PRODUCT,
      variants: [createVariant('12000.00'), createVariant('9999.99')],
    };
    expect(getLowestPrice(product)).toBe('9999.99');
  });

  it('reads the first image from the public image list', () => {
    expect(
      getPrimaryImage({
        ...BASE_PRODUCT,
        images: [
          {
            id: 'image-1',
            url: 'https://image.test/1',
            altText: null,
            sortOrder: 0,
            isPrimary: true,
            sizeBytes: 1,
            mimeType: 'image/jpeg',
          },
        ],
      }),
    ).toBe('https://image.test/1');
  });

  it('converts primitive specification values to readable text', () => {
    const variant = { ...createVariant('100.00'), specs: { material: '18K金', size: 12 } };
    expect(getVariantSpecText(variant)).toBe('18K金 · 12');
  });
});

function createVariant(price: string): PublicProductVariantResponse {
  return {
    id: `variant-${price}`,
    specs: {},
    price,
    availableStockQty: 1,
  };
}
