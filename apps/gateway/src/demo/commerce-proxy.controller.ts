import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
  ProductPublishValidationResponse,
  PublishProductDraftResponse,
  DeleteProductDraftResponse,
  BrandModelResponse,
  BrandDirectoryGroupResponse,
  BrandSeriesResponse,
  IntakeEmployeeResponse,
  IntakeCategoryResponse,
  IntakeBrandResponse,
  ProductIntakeResponse,
  RecyclingTypeResponse,
} from '@saas/contracts';

import { CoreProxyService } from '../infrastructure/core-proxy.service.js';
import {
  EnforceQuota,
  MeterUsage,
  RequireFeature,
  RequirePermission,
} from '../pipeline/pipeline.metadata.js';
import type { SaasRequest } from '../pipeline/request-context.js';
import {
  BindProductDraftMediaDto,
  CreateProductDraftDto,
  DeleteProductDraftDto,
  DuplicateProductDraftDto,
  ProductDraftListQueryDto,
  PublishProductDraftDto,
  SaveProductDraftDto,
} from '../http/dto/product-draft.dto.js';
import { ProductLifecycleCommandDto } from '../http/dto/product-lifecycle.dto.js';
import {
  CreateBrandModelDto,
  CreateBrandSeriesDto,
  CreateProductIntakeDto,
  BrandDirectoryQueryDto,
  BrandModelListQueryDto,
  UpdateBrandModelDto,
  UpdateBrandSeriesDto,
} from '../http/dto/product-intake.dto.js';

@Controller('commerce')
@ApiTags('商品与入库')
@RequireFeature('products.basic')
@EnforceQuota('api_calls')
@MeterUsage('api_calls')
export class CommerceProxyController {
  constructor(@Inject(CoreProxyService) private readonly core: CoreProxyService) {}

  @Get('intake-options/categories')
  @RequirePermission('products.read')
  intakeCategories(@Req() req: SaasRequest): Promise<IntakeCategoryResponse[]> {
    return this.core.request('/intake-options/categories', this.context(req));
  }

  @Get('intake-options/brands')
  @RequirePermission('products.read')
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'keyword', required: false, type: String, maxLength: 100 })
  intakeBrands(
    @Req() req: SaasRequest,
    @Query() query: BrandDirectoryQueryDto,
  ): Promise<IntakeBrandResponse[]> {
    const suffix = brandQueryString(query);
    return this.core.request(`/intake-options/brands${suffix}`, this.context(req));
  }

  @Get('intake-options/brand-directory')
  @RequirePermission('products.read')
  @ApiQuery({ name: 'categoryId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'keyword', required: false, type: String, maxLength: 100 })
  @ApiOkResponse({
    description: '按 A-Z 通讯录分组的品牌目录，可按 categoryId 过滤',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['initial', 'brands'],
        properties: {
          initial: { type: 'string', example: 'C' },
          brands: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'englishName', 'initial', 'categoryIds', 'logoUrl'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: '卡地亚' },
                englishName: { type: 'string', nullable: true, example: 'Cartier' },
                initial: { type: 'string', example: 'C' },
                categoryIds: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' },
                },
                logoUrl: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  })
  intakeBrandDirectory(
    @Req() req: SaasRequest,
    @Query() query: BrandDirectoryQueryDto,
  ): Promise<BrandDirectoryGroupResponse[]> {
    const suffix = brandQueryString(query);
    return this.core.request(`/intake-options/brand-directory${suffix}`, this.context(req));
  }

  @Get('intake-options/employees')
  @RequirePermission('products.read')
  intakeEmployees(@Req() req: SaasRequest): Promise<IntakeEmployeeResponse[]> {
    return this.core.request('/intake-options/employees', this.context(req));
  }

  @Get('intake-options/recycling-types')
  @RequirePermission('products.read')
  intakeRecyclingTypes(@Req() req: SaasRequest): Promise<RecyclingTypeResponse[]> {
    return this.core.request('/intake-options/recycling-types', this.context(req));
  }

  @Get('intake-options/brands/:brandId/series')
  @RequirePermission('products.read')
  listBrandSeries(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
  ): Promise<BrandSeriesResponse[]> {
    return this.core.request(`/intake-options/brands/${brandId}/series`, this.context(req));
  }

  @Post('intake-options/brands/:brandId/series')
  @RequirePermission('products.write')
  @ApiBody({ type: CreateBrandSeriesDto })
  createBrandSeries(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Body() input: CreateBrandSeriesDto,
  ): Promise<BrandSeriesResponse> {
    return this.core.request(`/intake-options/brands/${brandId}/series`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Patch('intake-options/brands/:brandId/series/:id')
  @RequirePermission('products.write')
  @ApiBody({ type: UpdateBrandSeriesDto })
  updateBrandSeries(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() input: UpdateBrandSeriesDto,
  ): Promise<BrandSeriesResponse> {
    return this.core.request(`/intake-options/brands/${brandId}/series/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Get('intake-options/brands/:brandId/models')
  @RequirePermission('products.read')
  @ApiParam({ name: 'brandId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'seriesId', required: false, type: String, format: 'uuid' })
  listBrandModels(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Query() query: BrandModelListQueryDto,
  ): Promise<BrandModelResponse[]> {
    const suffix = query.seriesId ? `?seriesId=${encodeURIComponent(query.seriesId)}` : '';
    return this.core.request(
      `/intake-options/brands/${brandId}/models${suffix}`,
      this.context(req),
    );
  }

  @Get('intake-options/brands/:brandId/series/:seriesId/models')
  @RequirePermission('products.read')
  @ApiParam({ name: 'brandId', type: String, format: 'uuid' })
  @ApiParam({ name: 'seriesId', type: String, format: 'uuid' })
  listSeriesModels(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Param('seriesId') seriesId: string,
  ): Promise<BrandModelResponse[]> {
    return this.core.request(
      `/intake-options/brands/${brandId}/series/${seriesId}/models`,
      this.context(req),
    );
  }

  @Post('intake-options/brands/:brandId/models')
  @RequirePermission('products.write')
  @ApiBody({ type: CreateBrandModelDto })
  createBrandModel(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Body() input: CreateBrandModelDto,
  ): Promise<BrandModelResponse> {
    return this.core.request(`/intake-options/brands/${brandId}/models`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Patch('intake-options/brands/:brandId/models/:id')
  @RequirePermission('products.write')
  @ApiBody({ type: UpdateBrandModelDto })
  updateBrandModel(
    @Req() req: SaasRequest,
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Body() input: UpdateBrandModelDto,
  ): Promise<BrandModelResponse> {
    return this.core.request(`/intake-options/brands/${brandId}/models/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Post('product-intakes')
  @RequirePermission('products.write')
  @ApiBody({ type: CreateProductIntakeDto })
  @ApiCreatedResponse({
    description: '商品入库成功；包含完整的内部入库档案',
    schema: {
      type: 'object',
      required: ['code', 'message', 'data', 'traceId'],
      properties: {
        code: { type: 'number', example: 0 },
        message: { type: 'string', example: 'ok' },
        traceId: { type: 'string', format: 'uuid' },
        data: {
          type: 'object',
          required: [
            'id',
            'productId',
            'action',
            'status',
            'title',
            'description',
            'condition',
            'categoryId',
            'brandId',
            'productCode',
            'stockQuantity',
            'inventoryAgeWarningDays',
            'totalCostPrice',
            'peerPrice',
            'agentPrice',
            'salePrice',
            'appraiser',
            'recycledAt',
            'warrantyCard',
            'productImages',
            'stockedAt',
            'media',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            action: { type: 'string', enum: ['stock_only', 'stock_and_publish'] },
            status: { type: 'string', enum: ['stocked', 'published'] },
            title: { type: 'string' },
            description: { type: 'string' },
            customTips: { type: 'string', nullable: true },
            condition: { type: 'string', enum: ['unused', 'preowned'] },
            categoryId: { type: 'string', format: 'uuid' },
            brandId: { type: 'string', format: 'uuid' },
            series: { type: 'object', nullable: true },
            model: { type: 'object', nullable: true },
            material: { type: 'string', nullable: true },
            size: { type: 'string', nullable: true },
            officialGuidePrice: { type: 'string', example: '0.00' },
            productCode: { type: 'string' },
            ownershipType: {
              type: 'string',
              enum: ['owned', 'consigned', 'pledged', 'other'],
              nullable: true,
            },
            stockQuantity: { type: 'integer' },
            inventoryAgeWarningDays: { type: 'integer', example: 90 },
            totalCostPrice: { type: 'string' },
            peerPrice: { type: 'string' },
            agentPrice: { type: 'string' },
            salePrice: { type: 'string' },
            appraiser: { type: 'object' },
            recyclingType: { type: 'object', nullable: true },
            recyclingEmployee: { type: 'object', nullable: true },
            recyclingNotes: { type: 'string', nullable: true },
            recycledAt: { type: 'string', format: 'date-time' },
            audience: { type: 'string', nullable: true },
            warrantyCard: { type: 'string', enum: ['present', 'absent'] },
            warrantyCardYear: { type: 'integer', nullable: true },
            uniqueCode: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            accessories: { type: 'array', items: { type: 'string' } },
            internalNotes: { type: 'string', nullable: true },
            productImages: { type: 'array', items: { type: 'object' } },
            stockedAt: { type: 'string', format: 'date-time' },
            media: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  })
  createProductIntake(
    @Req() req: SaasRequest,
    @Body() input: CreateProductIntakeDto,
  ): Promise<ProductIntakeResponse> {
    return this.core.request('/product-intakes', this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  /** 查询租户支付与退款回调死信。 */
  @Get('webhook-dead-letters')
  @RequireFeature('orders.basic')
  @RequirePermission('webhooks.replay')
  listWebhookDeadLetters(@Req() req: SaasRequest): Promise<WebhookDeadLetterResponse[]> {
    return this.core.request('/webhook-dead-letters', this.context(req));
  }

  /** 人工重放死信；Core 会再次执行租户校验并记录审计。 */
  @Post('webhook-dead-letters/:kind/:id/replay')
  @RequireFeature('orders.basic')
  @RequirePermission('webhooks.replay')
  replayWebhookDeadLetter(
    @Req() req: SaasRequest,
    @Param('kind') kind: WebhookEventKind,
    @Param('id') id: string,
  ): Promise<ReplayWebhookResponse> {
    return this.core.request(`/webhook-dead-letters/${kind}/${id}/replay`, this.context(req), {
      method: 'POST',
    });
  }

  @Post('categories')
  @RequirePermission('products.write')
  category(
    @Req() req: SaasRequest,
    @Body() input: CreateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.core.request('/categories', this.context(req), { method: 'POST', body: input });
  }

  @Get('categories')
  @RequirePermission('products.read')
  categories(
    @Req() req: SaasRequest,
    @Query() query: CatalogListQuery,
  ): Promise<CategoryResponse[]> {
    const suffix = query.includeDeleted ? '?includeDeleted=true' : '';
    return this.core.request(`/categories${suffix}`, this.context(req));
  }

  @Delete('categories/:id')
  @RequirePermission('products.write')
  deleteCategory(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<DeleteCatalogItemResponse> {
    return this.core.request(`/categories/${id}`, this.context(req), { method: 'DELETE' });
  }

  @Post('categories/:id/restore')
  @RequirePermission('products.write')
  restoreCategory(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<RestoreCatalogItemResponse> {
    return this.core.request(`/categories/${id}/restore`, this.context(req), { method: 'POST' });
  }

  @Patch('categories/:id')
  @RequirePermission('products.write')
  updateCategory(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: UpdateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.core.request(`/categories/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Post('brands')
  @RequirePermission('products.write')
  brand(@Req() req: SaasRequest, @Body() input: CreateBrandRequest): Promise<BrandResponse> {
    return this.core.request('/brands', this.context(req), { method: 'POST', body: input });
  }

  @Get('brands')
  @RequirePermission('products.read')
  brands(@Req() req: SaasRequest, @Query() query: CatalogListQuery): Promise<BrandResponse[]> {
    const suffix = query.includeDeleted ? '?includeDeleted=true' : '';
    return this.core.request(`/brands${suffix}`, this.context(req));
  }

  @Delete('brands/:id')
  @RequirePermission('products.write')
  deleteBrand(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<DeleteCatalogItemResponse> {
    return this.core.request(`/brands/${id}`, this.context(req), { method: 'DELETE' });
  }

  @Post('brands/:id/restore')
  @RequirePermission('products.write')
  restoreBrand(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<RestoreCatalogItemResponse> {
    return this.core.request(`/brands/${id}/restore`, this.context(req), { method: 'POST' });
  }

  @Patch('brands/:id')
  @RequirePermission('products.write')
  updateBrand(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: UpdateBrandRequest,
  ): Promise<BrandResponse> {
    return this.core.request(`/brands/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Post('products')
  @RequirePermission('products.write')
  create(@Req() req: SaasRequest, @Body() input: CreateProductRequest): Promise<ProductResponse> {
    return this.core.request('/products', this.context(req), { method: 'POST', body: input });
  }

  @Post('product-drafts')
  @RequirePermission('products.write')
  createProductDraft(
    @Req() req: SaasRequest,
    @Body() input: CreateProductDraftDto,
  ): Promise<ProductResponse> {
    return this.core.request('/product-drafts', this.context(req), { method: 'POST', body: input });
  }

  @Get('product-drafts')
  @RequirePermission('products.read')
  listProductDrafts(
    @Req() req: SaasRequest,
    @Query() query: ProductDraftListQueryDto,
  ): Promise<ProductPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return this.core.request(`/product-drafts${suffix}`, this.context(req));
  }

  @Get('product-drafts/:id')
  @RequirePermission('products.read')
  getProductDraft(@Req() req: SaasRequest, @Param('id') id: string): Promise<ProductResponse> {
    return this.core.request(`/product-drafts/${id}`, this.context(req));
  }

  @Delete('product-drafts/:id')
  @RequirePermission('products.write')
  deleteProductDraft(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: DeleteProductDraftDto,
  ): Promise<DeleteProductDraftResponse> {
    return this.core.request(`/product-drafts/${id}`, this.context(req), {
      method: 'DELETE',
      body: input,
    });
  }

  @Post('product-drafts/:id/duplicate')
  @RequirePermission('products.write')
  duplicateProductDraft(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: DuplicateProductDraftDto,
  ): Promise<ProductResponse> {
    return this.core.request(`/product-drafts/${id}/duplicate`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Patch('product-drafts/:id')
  @RequirePermission('products.write')
  saveProductDraft(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: SaveProductDraftDto,
  ): Promise<ProductResponse> {
    return this.core.request(`/product-drafts/${id}`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Patch('product-drafts/:id/media')
  @RequirePermission('products.write')
  bindProductDraftMedia(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: BindProductDraftMediaDto,
  ): Promise<ProductResponse> {
    return this.core.request(`/product-drafts/${id}/media`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Get('product-drafts/:id/publish-validation')
  @RequirePermission('products.read')
  validateProductDraft(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<ProductPublishValidationResponse> {
    return this.core.request(`/product-drafts/${id}/publish-validation`, this.context(req));
  }

  @Post('product-drafts/:id/publish')
  @RequirePermission('products.write')
  publishProductDraft(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: PublishProductDraftDto,
  ): Promise<PublishProductDraftResponse> {
    return this.core.request(`/product-drafts/${id}/publish`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('products/batch')
  @RequirePermission('products.write')
  batchProducts(
    @Req() req: SaasRequest,
    @Body() input: BatchUpdateProductsRequest,
  ): Promise<BatchUpdateProductsResponse> {
    return this.core.request('/products/batch', this.context(req), { method: 'POST', body: input });
  }

  @Get('products')
  list(@Req() req: SaasRequest, @Query() query: ProductListQuery): Promise<ProductPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) search.set(key, String(value));
    return this.core.request(`/products?${search.toString()}`, this.context(req));
  }

  /** 消费者商品目录；Core 仅返回公开字段白名单。 */
  @Get('public/products')
  listPublicProducts(
    @Req() req: SaasRequest,
    @Query() query: PublicProductListQuery,
  ): Promise<PublicProductPageResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    return this.core.request(`/public/products?${search.toString()}`, this.context(req));
  }

  @Get('public/products/:id')
  getPublicProduct(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<PublicProductResponse> {
    return this.core.request(`/public/products/${id}`, this.context(req));
  }

  @Get('products/:id')
  get(@Req() req: SaasRequest, @Param('id') id: string): Promise<ProductResponse> {
    return this.core.request(`/products/${id}`, this.context(req));
  }

  @Post('products/:id/unlist')
  @RequirePermission('products.write')
  unlistProduct(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: ProductLifecycleCommandDto,
  ): Promise<ProductResponse> {
    return this.core.request(`/products/${id}/unlist`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Post('products/:id/relist')
  @RequirePermission('products.write')
  relistProduct(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: ProductLifecycleCommandDto,
  ): Promise<ProductResponse> {
    return this.core.request(`/products/${id}/relist`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Get('products/:id/lifecycle-events')
  @RequirePermission('products.read')
  listProductLifecycleEvents(
    @Req() req: SaasRequest,
    @Param('id') id: string,
  ): Promise<ProductLifecycleEventResponse[]> {
    return this.core.request(`/products/${id}/lifecycle-events`, this.context(req));
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

  @Post('products/:id/images')
  @RequirePermission('products.write')
  addProductImage(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: CreateProductImageRequest,
  ): Promise<ProductImageResponse> {
    return this.core.request(`/products/${id}/images`, this.context(req), {
      method: 'POST',
      body: input,
    });
  }

  @Patch('products/:id/images/sort')
  @RequirePermission('products.write')
  sortProductImages(
    @Req() req: SaasRequest,
    @Param('id') id: string,
    @Body() input: SortProductImagesRequest,
  ): Promise<{ sorted: true }> {
    return this.core.request(`/products/${id}/images/sort`, this.context(req), {
      method: 'PATCH',
      body: input,
    });
  }

  @Delete('products/:productId/images/:imageId')
  @RequirePermission('products.write')
  deleteProductImage(
    @Req() req: SaasRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): Promise<{ deleted: true }> {
    return this.core.request(`/products/${productId}/images/${imageId}`, this.context(req), {
      method: 'DELETE',
    });
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

function brandQueryString(query: BrandDirectoryQueryDto): string {
  const parameters = new URLSearchParams();
  if (query.categoryId) parameters.set('categoryId', query.categoryId);
  if (query.keyword?.trim()) parameters.set('keyword', query.keyword.trim());
  const value = parameters.toString();
  return value ? `?${value}` : '';
}
