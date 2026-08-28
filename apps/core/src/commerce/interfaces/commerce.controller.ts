import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

import { CatalogService } from '../application/catalog.service.js';
import { ProductService } from '../application/product.service.js';
import { InventoryService } from '../application/inventory.service.js';
import { OrderService } from '../application/order.service.js';
import { PaymentService } from '../application/payment.service.js';
import { ShipmentService } from '../application/shipment.service.js';
import { RefundService } from '../application/refund.service.js';

@Controller('internal/commerce')
export class CommerceController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
    @Inject(ProductService)
    private readonly products: ProductService,
    @Inject(InventoryService)
    private readonly inventory: InventoryService,
    @Inject(OrderService)
    private readonly orders: OrderService,
    @Inject(PaymentService)
    private readonly payments: PaymentService,
    @Inject(ShipmentService)
    private readonly shipments: ShipmentService,
    @Inject(RefundService)
    private readonly refunds: RefundService,
  ) {}

  @Post('categories')
  createCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: CreateCategoryRequest,
  ): Promise<{ id: string; name: string }> {
    return this.catalog.createCategory(tenantId, input);
  }

  @Get('categories')
  listCategories(
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
    return this.catalog.listCategories(tenantId);
  }

  @Post('brands')
  createBrand(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: CreateBrandRequest,
  ): Promise<{ id: string; name: string }> {
    return this.catalog.createBrand(tenantId, input);
  }

  @Get('brands')
  listBrands(
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<Array<{ id: string; name: string; logoUrl: string | null }>> {
    return this.catalog.listBrands(tenantId);
  }

  @Post('products')
  createProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateProductRequest,
  ): Promise<ProductResponse> {
    return this.products.create(tenantId, actorId, input);
  }

  @Get('products')
  listProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ProductListQuery,
  ): Promise<ProductPageResponse> {
    return this.products.list(tenantId, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get('products/:id')
  getProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<ProductResponse> {
    return this.products.get(tenantId, id);
  }

  @Patch('products/:id')
  updateProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: UpdateProductRequest,
  ): Promise<ProductResponse> {
    return this.products.update(tenantId, actorId, id, input);
  }

  @Post('products/:id/variants')
  addVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') productId: string,
    @Body() input: CreateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    return this.products.addVariant(tenantId, productId, input);
  }

  @Patch('variants/:id')
  updateVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') variantId: string,
    @Body() input: UpdateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    return this.products.updateVariant(tenantId, variantId, input);
  }

  @Delete('variants/:id')
  async deleteVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') variantId: string,
  ): Promise<{ deleted: true }> {
    await this.products.deleteVariant(tenantId, variantId);
    return { deleted: true };
  }

  @Get('inventory/:variantId')
  getInventory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('variantId') variantId: string,
  ): Promise<InventoryBalanceResponse> {
    return this.inventory.getBalance(tenantId, variantId);
  }

  @Post('inventory/:operation')
  executeInventory(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('operation') operation: InventoryOperation,
    @Body() input: InventoryCommandRequest,
  ): Promise<InventoryTransactionResponse> {
    return this.inventory.execute(tenantId, actorId, operation, input);
  }

  @Post('orders')
  createOrder(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateOrderRequest,
  ): Promise<OrderResponse> {
    return this.orders.create(tenantId, actorId, input);
  }

  @Get('orders')
  listOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: OrderListQuery,
  ): Promise<OrderPageResponse> {
    return this.orders.list(tenantId, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get('orders/:id')
  getOrder(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    return this.orders.get(tenantId, id);
  }

  @Post('orders/:id/cancel')
  cancelOrder(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: CancelOrderRequest,
  ): Promise<OrderResponse> {
    return this.orders.cancel(tenantId, actorId, id, input);
  }

  /** 为已支付订单创建物流单。 */
  @Post('orders/:id/shipments')
  createShipment(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') orderId: string,
    @Body() input: CreateShipmentRequest,
  ): Promise<ShipmentResponse> {
    return this.shipments.create(tenantId, actorId, orderId, input);
  }

  /** 查询订单物流单。 */
  @Get('orders/:id/shipments')
  listShipments(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
  ): Promise<ShipmentResponse[]> {
    return this.shipments.list(tenantId, orderId);
  }

  /** 提交订单退款申请。 */
  @Post('orders/:id/refunds')
  createRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') orderId: string,
    @Body() input: CreateRefundRequest,
  ): Promise<RefundResponse> {
    return this.refunds.create(tenantId, actorId, orderId, input);
  }

  /** 查询订单退款申请。 */
  @Get('orders/:id/refunds')
  listRefunds(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') orderId: string,
  ): Promise<RefundResponse[]> {
    return this.refunds.list(tenantId, orderId);
  }

  /** 审核退款申请。 */
  @Post('refunds/:id/review')
  reviewRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') refundId: string,
    @Body() input: ReviewRefundRequest,
  ): Promise<RefundResponse> {
    return this.refunds.review(tenantId, actorId, refundId, input);
  }

  /** 通过订单原支付渠道发起退款。 */
  @Post('refunds/:id/execute')
  executeRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') refundId: string,
  ): Promise<RefundResponse> {
    return this.refunds.execute(tenantId, actorId, refundId);
  }

  /** 接收已验签的退款渠道结果。 */
  @Post('refunds/:id/confirm')
  confirmRefund(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') refundId: string,
    @Body() input: ConfirmRefundRequest,
  ): Promise<RefundResponse> {
    return this.refunds.confirm(tenantId, actorId, refundId, input);
  }

  @Post('orders/expire')
  expireOrders(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: ExpireOrdersRequest,
  ): Promise<ExpireOrdersResponse> {
    return this.orders.expirePending(tenantId, input.limit);
  }

  @Post('payments')
  createPayment(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    return this.payments.create(tenantId, actorId, input);
  }

  @Get('payments/:id')
  getPayment(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<PaymentResponse> {
    return this.payments.get(tenantId, id);
  }

  @Post('payments/:id/checkout')
  createPaymentCheckout(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() input: CreatePaymentCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    return this.payments.checkout(tenantId, id, input);
  }

  @Post('payments/:id/confirm')
  confirmPayment(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() input: ConfirmPaymentRequest,
  ): Promise<PaymentResponse> {
    return this.payments.confirm(tenantId, id, input);
  }
}
