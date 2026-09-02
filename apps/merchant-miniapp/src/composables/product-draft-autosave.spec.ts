/** 商品草稿自动保存规则测试：初始化不产生脏状态，真实编辑才触发变化。 */
import { describe, expect, it } from 'vitest';

import { productDraftFingerprint, type ProductDraftFormState } from './product-draft-autosave';

const original: ProductDraftFormState = {
  name: '测试商品',
  description: '',
  categoryId: '',
  price: '10000.00',
  conditionGrade: 'excellent',
  material: '',
  color: '',
};

describe('productDraftFingerprint', () => {
  it('keeps initialization clean and detects a real edit', () => {
    const saved = productDraftFingerprint(original);
    expect(productDraftFingerprint({ ...original })).toBe(saved);
    expect(productDraftFingerprint({ ...original, name: '修改后的商品' })).not.toBe(saved);
  });
});
