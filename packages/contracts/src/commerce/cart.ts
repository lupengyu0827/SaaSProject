/**
 * 购物车契约。
 *
 * 注意：首期采用私域成交，购物车/在线订单链路当前仅做前端视觉还原，
 * 数据源与结算逻辑属后端主开发职责，本契约先落最小类型供前端编译，
 * 待 F05 联系购买链路准入后由后端补齐真实实现。
 */

/** 购物车条目；金额一律字符串，前端不做浮点计算。 */
export interface CartItemResponse {
  /** 购物车条目 ID。 */
  id: string;
  /** 商品公开读模型 ID。 */
  productId: string;
  /** 规格（variant）ID。 */
  variantId: string;
  /** 商品名称。 */
  productName: string;
  /** 系列/材质标签，用于卡片副标题。 */
  seriesLabel: string | null;
  /** SKU 规格文本。 */
  specsText: string;
  /** 主图 URL。 */
  imageUrl: string | null;
  /** 单价（现价）。 */
  unitPrice: string;
  /** 划线价（原价），可选。 */
  originalPrice: string | null;
  /** 数量。 */
  quantity: number;
  /** 是否被勾选参与结算。 */
  selected: boolean;
  /** 行小计 = unitPrice * quantity（后端计算，前端仅展示）。 */
  lineTotal: string;
}

/** 购物车汇总。 */
export interface CartSummaryResponse {
  /** 勾选商品件数。 */
  selectedCount: number;
  /** 勾选商品合计（不含运费/优惠）。 */
  selectedTotal: string;
  /** 是否全选。 */
  allSelected: boolean;
}

/** 购物车读模型。 */
export interface CartResponse {
  items: CartItemResponse[];
  summary: CartSummaryResponse;
}

/** 加入购物车请求。 */
export interface AddCartItemRequest {
  variantId: string;
  quantity: number;
}

/** 更新购物车条目数量请求。 */
export interface UpdateCartItemRequest {
  quantity: number;
}

/** 批量变更选中态请求。 */
export interface UpdateCartSelectionRequest {
  /** 全量设置选中的条目 ID；空数组表示全不选。 */
  selectedItemIds: string[];
}
