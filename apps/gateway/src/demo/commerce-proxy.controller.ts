import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type {
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  ProductListQuery,
  ProductPageResponse,
  ProductResponse,
  UpdateProductRequest,
  CreateProductVariantRequest,
  UpdateProductVariantRequest,
  ProductVariantResponse,
  InventoryBalanceResponse,
  InventoryCommandRequest,
  InventoryOperation,
  InventoryTransactionResponse,
  CancelOrderRequest,
  CreateOrderRequest,
  OrderListQuery,
  OrderPageResponse,
  OrderResponse,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  PaymentResponse,
  ExpireOrdersRequest,
  ExpireOrdersResponse,
  CreatePaymentCheckoutRequest,
  PaymentCheckoutResponse,
  CreateShipmentRequest,
  ShipmentResponse,
  CreateRefundRequest,
  RefundResponse,
  ReviewRefundRequest,
  ConfirmRefundRequest,
} from '@saas/contracts';

import { CoreProxyService } from '../infrastructure/core-proxy.service.js';
import {
  EnforceQuota,
  MeterUsage,
  RequireFeature,
  RequirePermission,
} from '../pipeline/pipeline.metadata.js';
import type { SaasRequest } from '../pipeline/request-context.js';

@Controller('commerce')
@RequireFeature('products.basic')
@EnforceQuota('api_calls')
@MeterUsage('api_calls')
export class CommerceProxyController {
  constructor(private readonly core: CoreProxyService) {}

  @Post('categories')
  @RequirePermission('products.write')
  category(
    @Req() req: SaasRequest,
    @Body() input: CreateCategoryRequest,
  ): Promise<{ id: string; name: string }> {
    return this.core.request('/categories', this.context(req), { method: 'POST', body: input });
  }

  @Get('categories')
  @RequirePermission('products.read')
  categories(
    @Req() req: SaasRequest,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    return this.core.request('/categories', this.context(req));
  }

  @Post('brands')
  @RequirePermission('products.write')
  brand(
    @Req() req: SaasRequest,
    @Body() input: CreateBrandRequest,
  ): Promise<{ id: string; name: string }> {
    return this.core.request('/brands', this.context(req), { method: 'POST', body: input });
  }

  @Get('brands')
  @RequirePermission('products.read')
  brands(
    @Req() req: SaasRequest,
  ): Promise<Array<{ id: string; name: string; logoUrl: string | null }>> {
    return this.core.request('/brands', this.context(req));
  }

  @Post('products')
  @RequirePermission('products.write')
  create(@Req() req: SaasRequest, @Body() input: CreateProductRequest): Promise<ProductResponse> {
    return this.core.request('/products', this.context(req), { method: 'POST', body: input });
  }

  @Get('products')
  list(@Req() req: SaasRequest, @Query() query: ProductListQuery): Promise<ProductPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) search.set(key, String(value));
    return this.core.request(`/products?${search.toString()}`, this.context(req));
  }

  @Get('products/:id')
  get(@Req() req: SaasRequest, @Param('id') id: string): Promise<ProductResponse> {
    return this.core.request(`/products/${id}`, this.context(req));
  }

  @Patch('products/:id')
  @RequirePermission('products.write')
  update(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: UpdateProductRequest,
  ): Promise<ProductResponse> {
    return this.core.request(`/products/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Post('products/:id/variants')
  @RequirePermission('products.write')
  addVariant(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CreateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    return this.core.request(`/products/${id}/variants`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Patch('variants/:id')
  @RequirePermission('products.write')
  updateVariant(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: UpdateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    return this.core.request(`/variants/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Delete('variants/:id')
  @RequirePermission('products.write')
  deleteVariant(@Req() req: SaasRequest, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.core.request(`/variants/${id}`, this.context(req), { method: 'DELETE' });
  }

  @Get('inventory/:variantId')
  @RequirePermission('inventory.read')
  inventory(
    @Req() req: SaasRequest,
    @Param('variantId') variantId: string,
  ): Promise<InventoryBalanceResponse> {
    return this.core.request(`/inventory/${variantId}`, this.context(req));
  }

  @Post('inventory/:operation')
  @RequirePermission('inventory.write')
  inventoryCommand(
    @Req() req: SaasRequest,
    @Param('operation') operation: InventoryOperation,
    @Body() input: InventoryCommandRequest,
  ): Promise<InventoryTransactionResponse> {
    return this.core.request(`/inventory/${operation}`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('orders')
  @RequireFeature('orders.basic')
  @RequirePermission('orders.write')
  createOrder(@Req() req: SaasRequest, @Body() input: CreateOrderRequest): Promise<OrderResponse> {
    return this.core.request('/orders', this.context(req), { method: 'POST', body: input });
  }

  @Get('orders')
  @RequireFeature('orders.basic')
  @RequirePermission('orders.read')
  listOrders(@Req() req: SaasRequest, @Query() query: OrderListQuery): Promise<OrderPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) search.set(key, String(value));
    return this.core.request(`/orders?${search.toString()}`, this.context(req));
  }

  @Get('orders/:id')
  @RequireFeature('orders.basic')
  @RequirePermission('orders.read')
  getOrder(@Req() req: SaasRequest, @Param('id') id: string): Promise<OrderResponse> {
    return this.core.request(`/orders/${id}`, this.context(req));
  }

  @Post('orders/:id/cancel')
  @RequireFeature('orders.basic')
  @RequirePermission('orders.write')
  cancelOrder(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CancelOrderRequest,
  ): Promise<OrderResponse> {
    return this.core.request(`/orders/${id}/cancel`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  /** 创建订单物流单；Gateway 负责套餐、权限、配额和用量管道。 */
  @Post('orders/:id/shipments')
  @RequireFeature('orders.basic')
  @RequirePermission('shipments.write')
  createShipment(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CreateShipmentRequest,
  ): Promise<ShipmentResponse> {
    return this.core.request(`/orders/${id}/shipments`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  /** 查询订单物流单。 */
  @Get('orders/:id/shipments')
  @RequireFeature('orders.basic')
  @RequirePermission('shipments.read')
  listShipments(@Req() req: SaasRequest, @Param('id') id: string): Promise<ShipmentResponse[]> {
    return this.core.request(`/orders/${id}/shipments`, this.context(req));
  }

  /** 提交退款申请。 */
  @Post('orders/:id/refunds')
  @RequireFeature('orders.basic')
  @RequirePermission('refunds.write')
  createRefund(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CreateRefundRequest,
  ): Promise<RefundResponse> {
    return this.core.request(`/orders/${id}/refunds`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  /** 查询退款申请。 */
  @Get('orders/:id/refunds')
  @RequireFeature('orders.basic')
  @RequirePermission('refunds.read')
  listRefunds(@Req() req: SaasRequest, @Param('id') id: string): Promise<RefundResponse[]> {
    return this.core.request(`/orders/${id}/refunds`, this.context(req));
  }

  /** 审核退款申请。 */
  @Post('refunds/:id/review')
  @RequireFeature('orders.basic')
  @RequirePermission('refunds.review')
  reviewRefund(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: ReviewRefundRequest,
  ): Promise<RefundResponse> {
    return this.core.request(`/refunds/${id}/review`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  /** 通过原支付渠道执行审核通过的退款。 */
  @Post('refunds/:id/execute')
  @RequireFeature('orders.basic')
  @RequirePermission('refunds.execute')
  executeRefund(@Req() req: SaasRequest, @Param('id') id: string): Promise<RefundResponse> {
    return this.core.request(`/refunds/${id}/execute`, this.context(req), { method: 'POST' });
  }

  /** 管理端模拟渠道确认；生产渠道回调需先经过专用验签入口。 */
  @Post('refunds/:id/confirm')
  @RequireFeature('orders.basic')
  @RequirePermission('refunds.confirm')
  confirmRefund(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: ConfirmRefundRequest,
  ): Promise<RefundResponse> {
    return this.core.request(`/refunds/${id}/confirm`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('orders/expire')
  @RequireFeature('orders.basic')
  @RequirePermission('orders.write')
  expireOrders(
    @Req() req: SaasRequest,
    @Body() input: ExpireOrdersRequest,
  ): Promise<ExpireOrdersResponse> {
    return this.core.request('/orders/expire', this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('payments')
  @RequireFeature('orders.basic')
  @RequirePermission('payments.write')
  createPayment(
    @Req() req: SaasRequest,
    @Body() input: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    return this.core.request('/payments', this.context(req), { method: 'POST', body: input });
  }

  @Get('payments/:id')
  @RequireFeature('orders.basic')
  @RequirePermission('payments.read')
  getPayment(@Req() req: SaasRequest, @Param('id') id: string): Promise<PaymentResponse> {
    return this.core.request(`/payments/${id}`, this.context(req));
  }

  @Post('payments/:id/checkout')
  @RequireFeature('orders.basic')
  @RequirePermission('payments.write')
  createPaymentCheckout(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CreatePaymentCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    return this.core.request(`/payments/${id}/checkout`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('payments/:id/confirm')
  @RequireFeature('orders.basic')
  @RequirePermission('payments.write')
  confirmPayment(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: ConfirmPaymentRequest,
  ): Promise<PaymentResponse> {
    return this.core.request(`/payments/${id}/confirm`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  private context(req: SaasRequest): { tenantId: string; actorId: string } {
    if (!req.tenantId || !req.actor) throw new Error('Gateway request context is missing');
    return { tenantId: req.tenantId, actorId: req.actor.id };
  }
}
