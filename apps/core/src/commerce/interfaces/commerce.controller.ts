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
  UpdateCategoryRequest,
  CategoryResponse,
  UpdateBrandRequest,
  BrandResponse,
  CatalogListQuery,
  DeleteCatalogItemResponse,
  RestoreCatalogItemResponse,
  CreateProductRequest,
  ProductListQuery,
  ProductPageResponse,
  ProductResponse,
  ProductLifecycleCommandRequest,
  ProductLifecycleEventResponse,
  UpdateProductRequest,
  CreateProductVariantRequest,
  UpdateProductVariantRequest,
  ProductVariantResponse,
  BatchUpdateProductsRequest,
  BatchUpdateProductsResponse,
  CreateProductImageRequest,
  ProductImageResponse,
  SortProductImagesRequest,
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
  ReplayWebhookResponse,
  WebhookDeadLetterResponse,
  WebhookEventKind,
  PublicProductListQuery,
  PublicProductPageResponse,
  PublicProductResponse,
  BindProductDraftMediaRequest,
  CreateProductDraftRequest,
  DeleteProductDraftRequest,
  DeleteProductDraftResponse,
  DuplicateProductDraftRequest,
  ProductDraftListQuery,
  ProductPublishValidationResponse,
  PublishProductDraftRequest,
  PublishProductDraftResponse,
  SaveProductDraftRequest,
  BrandModelResponse,
  BrandDirectoryGroupResponse,
  BrandSeriesResponse,
  CreateBrandModelRequest,
  CreateBrandSeriesRequest,
  CreateProductIntakeRequest,
  IntakeBrandResponse,
  IntakeCategoryResponse,
  IntakeEmployeeResponse,
  ProductIntakeResponse,
  RecyclingTypeResponse,
  UpdateBrandModelRequest,
  UpdateBrandSeriesRequest,
} from '@saas/contracts';

import { CatalogService } from '../application/catalog.service.js';
import { ProductService } from '../application/product.service.js';
import { InventoryService } from '../application/inventory.service.js';
import { OrderService } from '../application/order.service.js';
import { PaymentService } from '../application/payment.service.js';
import { ShipmentService } from '../application/shipment.service.js';
import { RefundService } from '../application/refund.service.js';
import { WebhookOperationsService } from '../application/webhook-operations.service.js';
import { ProductIntakeService } from '../application/product-intake.service.js';

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
    @Inject(WebhookOperationsService)
    private readonly webhookOperations: WebhookOperationsService,
    @Inject(ProductIntakeService)
    private readonly productIntakes: ProductIntakeService,
  ) {}

  @Get('intake-options/categories')
  intakeCategories(@Headers('x-tenant-id') tenantId: string): Promise<IntakeCategoryResponse[]> {
    return this.productIntakes.categories(tenantId);
  }

  @Get('intake-options/brands')
  intakeBrands(
    @Headers('x-tenant-id') tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
  ): Promise<IntakeBrandResponse[]> {
    return this.productIntakes.brands(tenantId, categoryId, keyword);
  }

  @Get('intake-options/brand-directory')
  intakeBrandDirectory(
    @Headers('x-tenant-id') tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
  ): Promise<BrandDirectoryGroupResponse[]> {
    return this.productIntakes.brandDirectory(tenantId, categoryId, keyword);
  }

  @Get('intake-options/employees')
  intakeEmployees(@Headers('x-tenant-id') tenantId: string): Promise<IntakeEmployeeResponse[]> {
    return this.productIntakes.employees(tenantId);
  }

  @Get('intake-options/recycling-types')
  intakeRecyclingTypes(@Headers('x-tenant-id') tenantId: string): Promise<RecyclingTypeResponse[]> {
    return this.productIntakes.recyclingTypes(tenantId);
  }

  @Get('intake-options/brands/:brandId/series')
  listBrandSeries(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
  ): Promise<BrandSeriesResponse[]> {
    return this.productIntakes.listSeries(tenantId, brandId);
  }

  @Post('intake-options/brands/:brandId/series')
  createBrandSeries(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Body() input: CreateBrandSeriesRequest,
  ): Promise<BrandSeriesResponse> {
    return this.productIntakes.createSeries(tenantId, brandId, input);
  }

  @Patch('intake-options/brands/:brandId/series/:id')
  updateBrandSeries(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() input: UpdateBrandSeriesRequest,
  ): Promise<BrandSeriesResponse> {
    return this.productIntakes.updateSeries(tenantId, brandId, id, input);
  }

  @Get('intake-options/brands/:brandId/models')
  listBrandModels(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Query('seriesId') seriesId?: string,
  ): Promise<BrandModelResponse[]> {
    return this.productIntakes.listModels(tenantId, brandId, seriesId);
  }

  @Get('intake-options/brands/:brandId/series/:seriesId/models')
  listSeriesModels(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Param('seriesId') seriesId: string,
  ): Promise<BrandModelResponse[]> {
    return this.productIntakes.listModels(tenantId, brandId, seriesId);
  }

  @Post('intake-options/brands/:brandId/models')
  createBrandModel(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Body() input: CreateBrandModelRequest,
  ): Promise<BrandModelResponse> {
    return this.productIntakes.createModel(tenantId, brandId, input);
  }

  @Patch('intake-options/brands/:brandId/models/:id')
  updateBrandModel(
    @Headers('x-tenant-id') tenantId: string,
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() input: UpdateBrandModelRequest,
  ): Promise<BrandModelResponse> {
    return this.productIntakes.updateModel(tenantId, brandId, id, input);
  }

  @Post('product-intakes')
  createProductIntake(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateProductIntakeRequest,
  ): Promise<ProductIntakeResponse> {
    return this.productIntakes.create(tenantId, actorId, input);
  }

  /** 查询支付与退款回调死信。 */
  @Get('webhook-dead-letters')
  listWebhookDeadLetters(
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<WebhookDeadLetterResponse[]> {
    return this.webhookOperations.listDeadLetters(tenantId);
  }

  /** 人工重放指定回调死信。 */
  @Post('webhook-dead-letters/:kind/:id/replay')
  replayWebhookDeadLetter(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('kind') kind: WebhookEventKind,
    @Param('id') id: string,
  ): Promise<ReplayWebhookResponse> {
    return this.webhookOperations.replay(tenantId, actorId, kind, id);
  }

  @Post('categories')
  createCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: CreateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.catalog.createCategory(tenantId, input);
  }

  @Get('categories')
  listCategories(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: CatalogListQuery,
  ): Promise<CategoryResponse[]> {
    return this.catalog.listCategories(tenantId, String(query.includeDeleted) === 'true');
  }

  @Delete('categories/:id')
  async deleteCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<DeleteCatalogItemResponse> {
    await this.catalog.deleteCategory(tenantId, id);
    return { deleted: true };
  }

  @Post('categories/:id/restore')
  async restoreCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<RestoreCatalogItemResponse> {
    await this.catalog.restoreCategory(tenantId, id);
    return { restored: true };
  }

  @Patch('categories/:id')
  updateCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() input: UpdateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.catalog.updateCategory(tenantId, id, input);
  }

  @Post('brands')
  createBrand(
    @Headers('x-tenant-id') tenantId: string,
    @Body() input: CreateBrandRequest,
  ): Promise<BrandResponse> {
    return this.catalog.createBrand(tenantId, input);
  }

  @Get('brands')
  listBrands(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: CatalogListQuery,
  ): Promise<BrandResponse[]> {
    return this.catalog.listBrands(tenantId, String(query.includeDeleted) === 'true');
  }

  @Delete('brands/:id')
  async deleteBrand(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<DeleteCatalogItemResponse> {
    await this.catalog.deleteBrand(tenantId, id);
    return { deleted: true };
  }

  @Post('brands/:id/restore')
  async restoreBrand(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<RestoreCatalogItemResponse> {
    await this.catalog.restoreBrand(tenantId, id);
    return { restored: true };
  }

  @Patch('brands/:id')
  updateBrand(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() input: UpdateBrandRequest,
  ): Promise<BrandResponse> {
    return this.catalog.updateBrand(tenantId, id, input);
  }

  @Post('products')
  createProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateProductRequest,
  ): Promise<ProductResponse> {
    return this.products.create(tenantId, actorId, input);
  }

  @Post('product-drafts')
  createProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: CreateProductDraftRequest,
  ): Promise<ProductResponse> {
    return this.products.createDraft(tenantId, actorId, input);
  }

  @Get('product-drafts')
  listProductDrafts(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ProductDraftListQuery,
  ): Promise<ProductPageResponse> {
    return this.products.listDrafts(tenantId, {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Get('product-drafts/:id')
  getProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<ProductResponse> {
    return this.products.getDraft(tenantId, id);
  }

  @Delete('product-drafts/:id')
  async deleteProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: DeleteProductDraftRequest,
  ): Promise<DeleteProductDraftResponse> {
    await this.products.deleteDraft(tenantId, actorId, id, input.version);
    return { deleted: true };
  }

  @Post('product-drafts/:id/duplicate')
  duplicateProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: DuplicateProductDraftRequest,
  ): Promise<ProductResponse> {
    return this.products.duplicateDraft(tenantId, actorId, id, input.version);
  }

  @Patch('product-drafts/:id')
  saveProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: SaveProductDraftRequest,
  ): Promise<ProductResponse> {
    return this.products.saveDraft(tenantId, actorId, id, input);
  }

  @Patch('product-drafts/:id/media')
  bindProductDraftMedia(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: BindProductDraftMediaRequest,
  ): Promise<ProductResponse> {
    return this.products.bindDraftMedia(tenantId, actorId, id, input);
  }

  @Get('product-drafts/:id/publish-validation')
  validateProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<ProductPublishValidationResponse> {
    return this.products.validateDraftPublish(tenantId, id);
  }

  @Post('product-drafts/:id/publish')
  publishProductDraft(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: PublishProductDraftRequest,
  ): Promise<PublishProductDraftResponse> {
    return this.products.publishDraft(tenantId, actorId, id, input.version);
  }

  @Get('products')
  listProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ProductListQuery,
  ): Promise<ProductPageResponse> {
    return this.products.list(tenantId, {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      includeDeleted: String(query.includeDeleted) === 'true',
    });
  }

  @Get('products/:id')
  getProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<ProductResponse> {
    return this.products.get(tenantId, id);
  }

  @Post('products/:id/unlist')
  unlistProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: ProductLifecycleCommandRequest,
  ): Promise<ProductResponse> {
    return this.products.unlist(tenantId, actorId, id, input);
  }

  @Post('products/:id/relist')
  relistProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() input: ProductLifecycleCommandRequest,
  ): Promise<ProductResponse> {
    return this.products.relist(tenantId, actorId, id, input);
  }

  @Get('products/:id/lifecycle-events')
  listProductLifecycleEvents(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<ProductLifecycleEventResponse[]> {
    return this.products.listLifecycleEvents(tenantId, id);
  }

  @Get('public/products')
  listPublicProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: PublicProductListQuery,
  ): Promise<PublicProductPageResponse> {
    return this.products.listPublic(tenantId, {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Get('public/products/:id')
  getPublicProduct(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ): Promise<PublicProductResponse> {
    return this.products.getPublic(tenantId, id);
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

  @Post('products/batch')
  batchProducts(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Body() input: BatchUpdateProductsRequest,
  ): Promise<BatchUpdateProductsResponse> {
    return this.products.batchUpdate(tenantId, actorId, input);
  }

  @Post('products/:id/variants')
  addVariant(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') productId: string,
    @Body() input: CreateProductVariantRequest,
  ): Promise<ProductVariantResponse> {
    return this.products.addVariant(tenantId, actorId, productId, input);
  }

  @Post('products/:id/images')
  addProductImage(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') productId: string,
    @Body() input: CreateProductImageRequest,
  ): Promise<ProductImageResponse> {
    return this.products.addImage(tenantId, productId, input);
  }

  @Patch('products/:id/images/sort')
  async sortProductImages(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') productId: string,
    @Body() input: SortProductImagesRequest,
  ): Promise<{ sorted: true }> {
    await this.products.sortImages(tenantId, productId, input);
    return { sorted: true };
  }

  @Delete('products/:productId/images/:imageId')
  async deleteProductImage(
    @Headers('x-tenant-id') tenantId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): Promise<{ deleted: true }> {
    await this.products.deleteImage(tenantId, productId, imageId);
    return { deleted: true };
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
