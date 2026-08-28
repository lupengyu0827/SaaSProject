import { ConflictException } from '@nestjs/common';
import type { CreateProductRequest, ProductStatus } from '@saas/contracts';

export function assertCreateProduct(input: CreateProductRequest): void {
  if (!input.code.trim() || !input.name.trim())
    throw new ConflictException('Product code and name are required');
  if (input.variants.length === 0)
    throw new ConflictException('A product requires at least one SKU');
  const skus = input.variants.map(({ sku }) => sku.trim());
  if (new Set(skus).size !== skus.length) throw new ConflictException('SKU values must be unique');
  for (const variant of input.variants) {
    assertMoney(variant.price, 'price');
    if (variant.costPrice) assertMoney(variant.costPrice, 'costPrice');
  }
}

export function assertStatusTransition(current: ProductStatus, next: ProductStatus): void {
  const allowed: Record<ProductStatus, ProductStatus[]> = {
    draft: ['draft', 'active', 'archived'],
    active: ['active', 'archived'],
    archived: ['archived'],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictException(`Product status cannot transition from ${current} to ${next}`);
  }
}

export function assertMoney(value: string, field: string): void {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) {
    throw new ConflictException(`${field} must be a non-negative decimal with at most 2 digits`);
  }
}
