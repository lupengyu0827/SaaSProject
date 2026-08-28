/** 商品契约到视图文本的纯转换工具。 */
import type { ProductResponse, ProductVariantResponse } from '@saas/contracts';

/** 格式化人民币金额，避免浮点数转换。 */
export function formatCurrency(amount: string): string {
  const [integerPart = '0', decimalPart = '00'] = amount.split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `¥ ${groupedInteger}.${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

/** 获取最低规格价格。 */
export function getLowestPrice(product: ProductResponse): string | null {
  return product.variants.reduce<string | null>((lowestPrice, variant) => {
    if (lowestPrice === null) return variant.price;
    return compareDecimal(variant.price, lowestPrice) < 0 ? variant.price : lowestPrice;
  }, null);
}

/** 从扩展属性安全读取主图。 */
export function getPrimaryImage(product: ProductResponse): string | null {
  if (!isRecord(product.attributes)) return null;
  const directImage = product.attributes.primaryImage ?? product.attributes.imageUrl;
  if (typeof directImage === 'string' && directImage.length > 0) return directImage;
  const images = product.attributes.images;
  return Array.isArray(images) && typeof images[0] === 'string' ? images[0] : null;
}

/** 将 SKU specs 转成短文本。 */
export function getVariantSpecText(variant: ProductVariantResponse): string {
  if (!isRecord(variant.specs)) return variant.sku;
  const values = Object.values(variant.specs)
    .filter((value): value is string | number => ['string', 'number'].includes(typeof value))
    .slice(0, 3);
  return values.length > 0 ? values.join(' · ') : variant.sku;
}

function compareDecimal(left: string, right: string): number {
  const normalizedLeft = normalizeDecimal(left);
  const normalizedRight = normalizeDecimal(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  return normalizedLeft.localeCompare(normalizedRight);
}

function normalizeDecimal(value: string): string {
  const [integerPart = '0', decimalPart = ''] = value.replace(/^\+/, '').split('.');
  return `${integerPart.replace(/^0+(?=\d)/, '')}${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
