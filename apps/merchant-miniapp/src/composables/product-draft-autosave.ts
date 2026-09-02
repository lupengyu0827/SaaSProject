/** 商品草稿自动保存规则：以稳定快照识别真实用户修改，避免页面初始化误增版本。 */
export interface ProductDraftFormState {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  conditionGrade: string;
  material: string;
  color: string;
}

/** 生成字段顺序稳定的草稿快照，用于判断是否需要保存。 */
export function productDraftFingerprint(form: ProductDraftFormState): string {
  return JSON.stringify({
    name: form.name,
    description: form.description,
    categoryId: form.categoryId,
    price: form.price,
    conditionGrade: form.conditionGrade,
    material: form.material,
    color: form.color,
  });
}
