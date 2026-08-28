/** 小程序商品 Mock：用于无后端环境下完整演示首页、搜索与商品详情。 */
import type { ProductPageResponse, ProductResponse } from '@saas/contracts';

const MOCK_CREATED_AT = '2026-08-20T08:00:00.000Z';

export const MOCK_PRODUCTS: ProductResponse[] = [
  createMockProduct({
    id: 'mock-diamond-ring',
    code: 'OBJ-2608-001',
    name: '祖母绿切割钻石铂金戒指',
    description: '主石采用经典祖母绿切割，阶梯式刻面呈现清澈光影，适合日常珍藏与重要纪念。',
    image: '/static/images/mock/diamond-ring.jpg',
    price: '128000.00',
    category: '高级珠宝',
    condition: '臻品 · 近新',
  }),
  createMockProduct({
    id: 'mock-vintage-watch',
    code: 'OBJ-2608-018',
    name: '黄金方形手动上链古董腕表',
    description: '复古比例的黄金方形表壳，搭配深棕皮革表带，保留温润自然的岁月质感。',
    image: '/static/images/mock/vintage-watch.jpg',
    price: '46500.00',
    category: '典藏腕表',
    condition: '中古 · 优良',
  }),
  createMockProduct({
    id: 'mock-black-handbag',
    code: 'OBJ-2608-027',
    name: '黑色粒面皮革金扣手提包',
    description: '克制利落的廓形，粒面皮革搭配哑光金色五金，兼顾收藏价值与日常使用。',
    image: '/static/images/mock/black-handbag.jpg',
    price: '32800.00',
    category: '经典箱包',
    condition: '臻品 · 轻微使用',
  }),
];

/** 按关键词返回 Mock 商品列表。 */
export function listMockProducts(search?: string): ProductPageResponse {
  const keyword = search?.trim().toLocaleLowerCase();
  const items = keyword
    ? MOCK_PRODUCTS.filter((product) =>
        [product.name, product.code, product.description ?? ''].some((value) =>
          value.toLocaleLowerCase().includes(keyword),
        ),
      )
    : MOCK_PRODUCTS;
  return { items, nextCursor: null };
}

/** 根据 ID 读取 Mock 商品。 */
export function getMockProduct(productId: string): ProductResponse | null {
  return MOCK_PRODUCTS.find((product) => product.id === productId) ?? null;
}

interface MockProductInput {
  id: string;
  code: string;
  name: string;
  description: string;
  image: string;
  price: string;
  category: string;
  condition: string;
}

function createMockProduct(input: MockProductInput): ProductResponse {
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description,
    categoryId: null,
    brandId: null,
    attributes: {
      primaryImage: input.image,
      category: input.category,
      condition: input.condition,
      images: [input.image],
    },
    seoSlug: null,
    status: 'active',
    version: 1,
    variants: [
      {
        id: `${input.id}-default`,
        sku: `${input.code}-01`,
        specs: { 品相: input.condition },
        price: input.price,
        costPrice: '0.00',
        weightG: null,
      },
    ],
    createdAt: MOCK_CREATED_AT,
    updatedAt: MOCK_CREATED_AT,
  };
}
