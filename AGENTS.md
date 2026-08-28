# Codex AI 开发规范 (v1.0)

> 适用对象：Codex / AI 代码助手
> 项目定位：二手奢侈品交易多租户 SaaS 平台
> 生效日期：2026-08-26

---

## 一、核心铁律（Codex 必须无条件遵守）

### 1.1 先理解后动手，严禁未读上下文直接生成代码

Codex 执行任何代码生成任务前，必须按顺序执行：

```
Step 1: 读取 /Users/lupengyu/project/docs/多租户电商SaaS平台架构设计.md（至少前7节）
Step 2: 读取 /Users/lupengyu/project/.trae/rules/design_system.md（设计系统规范）
Step 3: 读取本文件（codex-ai-development-spec.md）
Step 4: 定位相关上下文（同目录文件、同模块最近修改文件）
Step 5: 确认理解后，方可生成代码
```

### 1.2 五大防腐层接口优先

参考 [项目架构设计文档的"五大防腐层接口"](file:///Users/lupengyu/project/docs/多租户电商SaaS平台架构设计.md)，Codex 生成的业务代码 **严禁直接依赖具体实现**，必须通过以下抽象层：

| 防腐层               | 接口位置                                                      | 禁止行为                               |
| :------------------- | :------------------------------------------------------------ | :------------------------------------- |
| Repository 抽象层    | `apps/core/src/shared/ports/`                                 | 禁止在 Service 层直接 new PrismaClient |
| 租户上下文中间件     | `apps/core/src/tenant/application/tenant-context.resolver.ts` | 禁止手写 `WHERE tenant_id = ?`         |
| Billing 配额服务接口 | `apps/core/src/shared/ports/`                                 | 禁止在业务里硬编码套餐判断             |
| Event Bus 抽象       | `apps/core/src/shared/ports/`                                 | 禁止跨模块直接 import Service          |
| API 调用层抽象       | `packages/contracts/`                                         | 前端禁止直接写 `fetch` / `axios`       |

### 1.3 Tenant First —— 一切围绕"怎么卖钱"

Codex 生成的每个功能，必须自问以下问题，不满足则直接拒绝生成：

```
1. 这个功能能不能做成套餐卖点？（对应 plans.features JSON 字段）
2. 这个功能会不会消耗租户配额？（对应 plans.quotas JSON 字段）
3. 这个功能需不需要租户级别隔离？（对应 TenantIsolationLevel）
4. 这个功能要不要记 audit_log？（写操作 + 敏感读操作必须记）
```

---

## 二、前端 PC 端开发规范 (Vue3 + Element Plus + Pinia + TailwindCSS)

### 2.1 技术栈硬约束

```
核心框架:  Vue 3.4+ (Composition API, <script setup>, 禁止 Options API)
UI 组件:   Element Plus 2.x (优先使用官方组件, 禁止重复造轮子)
状态管理:  Pinia 2.x (defineStore, 禁止直接使用 reactive/readonly 替代 Store)
样式方案:  TailwindCSS 3.x + 设计系统 Token (禁止内联 style, 禁止写 CSS 文件)
类型系统:  TypeScript 5.x (严格模式 strict: true, 禁止 any, 禁止 @ts-ignore)
HTTP 客户端: 统一使用封装的 useApiClient (禁止直接 import axios / fetch)
路由:      Vue Router 4.x
构建:      Vite 5.x
```

### 2.2 目录结构与命名约定

```
apps/pc-admin/                       # 或 apps/pc-client/
├── src/
│   ├── api/                         # 接口调用层（仅允许此层接触 HTTP）
│   │   ├── modules/
│   │   │   ├── tenant.api.ts        # 租户相关接口
│   │   │   ├── product.api.ts       # 商品相关接口
│   │   │   └── order.api.ts         # 订单相关接口
│   │   └── client.ts                # 封装 useApiClient, 统一注入 Token/错误处理
│   │
│   ├── stores/                      # Pinia 状态管理 (一个领域 = 一个 Store)
│   │   ├── use-tenant-store.ts      # 命名: use-{domain}-store.ts
│   │   ├── use-product-store.ts     # Store 内禁止写业务逻辑, 只做状态 + 简单派生
│   │   └── use-order-store.ts
│   │
│   ├── composables/                 # 业务逻辑复用 (组合式函数)
│   │   ├── use-product-list.ts      # 商品列表逻辑 (分页/筛选/排序)
│   │   ├── use-order-flow.ts        # 订单状态机操作逻辑
│   │   └── use-export.ts            # 通用导出 Excel 逻辑
│   │
│   ├── views/                       # 路由页面 (一个路由 = 一个文件夹)
│   │   ├── products/
│   │   │   ├── ProductList.vue      # 列表页 (路由: /products)
│   │   │   ├── ProductDetail.vue    # 详情页 (路由: /products/:id)
│   │   │   └── ProductForm.vue      # 新建/编辑页 (可复用组件)
│   │   └── orders/
│   │
│   ├── components/                  # 可复用 UI 组件
│   │   ├── common/                  # 通用 (跨领域复用)
│   │   │   ├── DataTable.vue        # 基于 ElTable 的二次封装
│   │   │   ├── SearchForm.vue       # 搜索栏表单
│   │   │   └── StatusBadge.vue      # 通用状态徽章
│   │   └── product/                 # 领域专用 (只在商品模块复用)
│   │       ├── ProductImageUpload.vue
│   │       └── Product4CMatrix.vue  # 奢品 4C 参数可视化
│   │
│   ├── router/                      # 路由配置
│   │   ├── index.ts                 # 主路由
│   │   └── guards.ts                # 路由守卫 (鉴权/套餐功能权限)
│   │
│   ├── layouts/                     # 布局组件
│   │   ├── AdminLayout.vue          # 后台布局 (侧边栏+顶栏+内容)
│   │   └── components/
│   │       ├── SideMenu.vue
│   │       └── TenantSwitcher.vue   # 租户切换器 (旗舰版功能)
│   │
│   ├── styles/                      # 全局样式 (尽量少用, 优先 Tailwind)
│   │   └── index.css                # Tailwind 指令 + 设计系统 CSS 变量
│   │
│   ├── types/                       # 类型定义
│   │   ├── api.types.ts             # 接口响应/请求类型 (优先从 contracts 包 import)
│   │   └── domain.types.ts          # 前端独有类型
│   │
│   └── App.vue / main.ts
```

### 2.3 Vue 组件编码规范 (Codex 必查清单)

**文件命名**:

```
组件文件夹:  PascalCase (如 ProductList)
组件 .vue 文件: PascalCase (如 ProductList.vue)
composable / store:  kebab-case (如 use-product-list.ts, use-tenant-store.ts)
```

**<script setup> 内部结构顺序 (严格按此顺序)**:

```vue
<script setup lang="ts">
// ==========================================================
// Step 1: defineProps / defineEmits (最先写)
// ==========================================================
interface Props {
  tenantId: string;
  visible: boolean;
}
interface Emits {
  (e: 'confirm', payload: { id: string }): void;
}
const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// ==========================================================
// Step 2: defineExpose (如需暴露方法给父组件)
// ==========================================================
defineExpose({ openDialog, resetForm });

// ==========================================================
// Step 3: Router / Store (依赖注入)
// ==========================================================
const router = useRouter();
const route = useRoute();
const tenantStore = useTenantStore();
const productStore = useProductStore();

// ==========================================================
// Step 4: Composables (业务逻辑)
// ==========================================================
const { list, loading, pagination, searchParams, handleSearch, handleReset } = useProductList(
  props.tenantId,
);

// ==========================================================
// Step 5: 派生状态 (computed)
// ==========================================================
const isTenantOwner = computed(() => tenantStore.currentRole === 'owner');
const canExportData = computed(() => tenantStore.hasFeature('DATA_EXPORT'));

// ==========================================================
// Step 6: 事件处理函数 (onXxx / handleXxx 命名)
// ==========================================================
/** 点击编辑按钮 */
function handleEdit(row: ProductRow) {
  if (!isTenantOwner.value) {
    ElMessage.warning('仅租户所有者可编辑');
    return;
  }
  router.push(`/products/${row.id}/edit`);
}

/** 提交表单 */
async function onSubmitForm() {
  loading.value = true;
  try {
    // 业务逻辑通过 composable / API 层调用
    await productStore.save(draft.value);
    ElMessage.success('保存成功');
    emit('confirm', { id: draft.value.id });
  } catch (err) {
    // 错误统一由 api client 拦截, 此处只需处理业务逻辑的失败
    console.error('[ProductForm] 保存失败:', err);
  } finally {
    loading.value = false;
  }
}

// ==========================================================
// Step 7: 生命周期钩子 (越靠后写)
// ==========================================================
onMounted(() => {
  if (props.visible) handleSearch();
});
watch(
  () => props.visible,
  (val) => val && handleSearch(),
);
</script>
```

**Codex 禁止生成以下反模式**:

```diff
- ❌ 禁止内联 style 写样式 (用 Tailwind 类名 / 设计系统 Token)
- ❌ 禁止 import './xxx.css' (禁止新建 CSS 文件)
- ❌ 禁止在 <script setup> 里写 axios.get('/api/...') (必须走 api 层)
- ❌ 禁止写 <script lang="ts"> export default { ... } (Options API)
- ❌ 禁止使用 ref() 存大型列表对象 (大型数据用 shallowRef + 手动刷新)
- ❌ 禁止在模板里写复杂三元运算 (提取为 computed)
- ❌ 禁止直接修改 props (用 emit 让父组件改)
- ❌ 禁止在 Store 里发 HTTP 请求 (Store 只存状态, 请求走 api 层)
- ❌ 禁止用 any 类型 (如果类型不确定用 unknown + 类型守卫)
- ❌ 禁止 Element Plus 组件嵌套超过 5 层 (提取为子组件)
```

### 2.4 TailwindCSS + 设计系统使用规范

**设计系统 Token 必须优先使用（详见 [design_system.md](file:///Users/lupengyu/project/.trae/rules/design_system.md)）**：

```diff
+ ✅ 正确:  bg-[var(--bg-dark-surface)] text-[var(--text-dark-primary)]
+ ✅ 正确:  border border-[var(--border-dark-subtle)] rounded-xl shadow-[var(--shadow-dark-luxury)]
- ❌ 错误:  bg-slate-900 text-white
- ❌ 错误:  border-gray-700 rounded-3xl shadow-2xl
```

**间距必须遵守 8pt Grid**:

```diff
+ ✅ 正确:  p-3 (12px) / p-4 (16px) / gap-2 (8px) / space-y-6 (24px)
- ❌ 错误:  p-[13px] / gap-[9px] / mt-[17px] (非 8 倍数, 除非设计特殊要求)
```

**禁止出现的廉价效果（反模式清单，参考 design_system.md 第六节）**:

```diff
- ❌ 严禁高饱和紫蓝渐变 / 赛博朋克霓虹发光
- ❌ 严禁玻璃拟态 (backdrop-blur + 半透明白)
- ❌ 严禁卡片套卡片 (Nested Cards)
- ❌ 严禁文字折行缺陷: 按钮/Tab/Badge 内必须 whitespace-nowrap
- ❌ 严禁浅色背景低对比度文字: 正文必须 ≥ 4.5:1
```

### 2.5 Element Plus 使用规范

**优先使用的组件（高频场景）**:

```
表格场景:  <el-table> + <el-table-column> + <el-pagination>  (不要自己写 table)
表单场景:  <el-form> + <el-form-item>  (统一用 label-width="100px" label-position="right")
弹窗场景:  <el-dialog> + <el-drawer>  (复杂表单用 Drawer, 简单确认用 Dialog)
选择器:    <el-select> + <el-option>  (多租户下拉必须支持搜索 filterable)
日期:      <el-date-picker>  (统一 type="datetime" value-format="YYYY-MM-DD HH:mm:ss")
状态标签:  <el-tag>  (type 对应语义色: success=绿 warning=橙 danger=红 info=灰)
消息提示:  ElMessage / ElNotification  (成功 success, 失败 error, 禁止用 ElMessageBox 做普通提示)
```

**二次封装规则**：

```
当出现以下情况时 Codex 必须主动二次封装为独立组件:
1. 同一套 <el-table> 配置 (列定义/分页/搜索栏) 在 3 个页面重复出现
2. 某类表单字段组合 (如"商品 SKU 规格选择器") 复用
3. 弹窗/抽屉的 Footer 按钮组 (确认/取消) 重复
4. 上传组件 + 裁剪/预览 + 鉴权签名 逻辑重复
```

### 2.6 Pinia Store 规范

```typescript
// ✅ 正确示例: stores/use-product-store.ts
import { defineStore } from 'pinia';
import { productApi } from '@/api/modules/product.api';
import type { Product, ProductListQuery } from '@saas/contracts'; // 必须用 contracts 包类型

/**
 * 商品状态管理
 * 仅负责: 当前选中商品、商品列表缓存、简单派生状态
 * 不负责: 业务逻辑 (放 composables) / HTTP 调用 (放 api 层)
 */
export const useProductStore = defineStore('product', () => {
  // ===== 1. State =====
  /** 当前选中的商品 ID (用于跨组件通信) */
  const selectedProductId = ref<string | null>(null);
  /** 商品详情缓存 (Key=ID) */
  const detailCache = reactive<Map<string, Product>>(new Map());
  /** 最近一次搜索条件 (用于返回列表页恢复) */
  const lastQuery = ref<ProductListQuery | null>(null);

  // ===== 2. Getters (Computed) =====
  /** 当前选中的商品详情 */
  const selectedProduct = computed(() =>
    selectedProductId.value ? (detailCache.get(selectedProductId.value) ?? null) : null,
  );

  // ===== 3. Actions (只做简单状态变更) =====
  /** 缓存商品详情 */
  function cacheDetail(product: Product) {
    detailCache.set(product.id, product);
  }

  /** 选中商品 */
  function selectProduct(id: string | null) {
    selectedProductId.value = id;
  }

  return {
    selectedProductId,
    detailCache,
    lastQuery,
    selectedProduct,
    cacheDetail,
    selectProduct,
  };
});
```

**Store 禁令**:

```diff
- ❌ 禁止在 Store Action 里写 await productApi.xxx() (HTTP 调用放 api 层)
- ❌ 禁止在 Store 里写业务判断 (if/else 校验状态机)
- ❌ 禁止跨 Store 直接 import (用 composable 编排多 Store 协作)
- ❌ 禁止持久化大型数据 (Pinia 插件只持久化 user token / tenant 信息)
```

---

## 三、后端开发规范 (NestJS + Prisma + PostgreSQL + 多租户)

### 3.1 技术栈硬约束

```
核心框架:  NestJS 11.x (模块化单体, Module 按领域拆分)
ORM:       Prisma 6.x (Repository 模式封装, 禁止 Service 层直接 new PrismaClient)
数据库:    PostgreSQL 16+ (RLS 行级安全 / Schema 隔离 / DECIMAL 金额)
缓存:      Redis 7+ (租户级限流 / 热点数据缓存 / 分布式锁)
鉴权:      JWT (Access Token 15min + Refresh Token 7d)
计费:      本地模拟 + 预留 Stripe Adapter (通过 BillingPort 接口)
消息:      本地 EventBus (预留 Kafka Adapter)
测试:      Vitest (单元测试 ≥ 80% 覆盖率)
类型:      TypeScript 严格模式 (strict: true)
```

### 3.2 六边形架构分层规范（强制执行）

```
每个领域模块 (billing / tenant / commerce / operations / extension)
内部必须按 4 层严格拆分:

apps/core/src/{module}/
├── interfaces/                   # Layer 1: 接口层 (Controller / Message Handler)
│   ├── xxx.controller.ts        #   REST API 端点 (只做: 参数校验 → 调 App Service → 返回)
│   └── dto/                      #   请求/响应 DTO (class-validator 装饰器)
│
├── application/                  # Layer 2: 应用层 (Use Case / 编排)
│   ├── xxx.service.ts           #   Application Service (编排领域对象 + 事务边界 + 发事件)
│   └── ports/                    #   本模块对外暴露的 Interface (给其他模块用)
│
├── domain/                       # Layer 3: 领域层 (纯业务逻辑, 0 基础设施依赖)
│   ├── entities/                #   领域实体 / 值对象 / 聚合根
│   ├── services/                #   Domain Service (纯业务规则判断, 如订单状态机流转)
│   ├── events/                  #   领域事件定义 (如 OrderCreatedEvent)
│   └── rules/                   #   业务规则 / 规格模式 (如 OrderPriceCalculationRule)
│
└── infrastructure/              # Layer 4: 基础设施层 (具体实现)
    ├── repositories/            #   Repository 实现 (Prisma 代码只允许出现在此)
    ├── adapters/                #   外部系统适配器 (StripeAdapter / SmsAdapter)
    └── prisma/                  #   Prisma 中间件 (如 RLS 设置 app.current_tenant_id)
```

**跨模块调用铁律（Codex 必须检查）**:

```diff
+ ✅ 正确: A 模块的 Application Service 依赖 B 模块在 shared/ports 定义的 Interface
    constructor(@Inject('InventoryPort') private readonly inventory: InventoryPort) {}

- ❌ 错误: A 模块直接 import B 模块的具体 Service
    import { InventoryService } from '../../inventory/application/inventory.service.ts'
```

### 3.3 Controller 层 (Interfaces) 规范

```typescript
// ✅ 正确示例: commerce/interfaces/product.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductApplicationService } from '../application/product.service.js';
import { CreateProductDto, UpdateProductDto, ProductListQueryDto } from './dto/product.dto.js';
import { JwtAuthGuard } from '../../auth/application/guards/jwt-auth.guard.js';
import { FeatureGuard } from '../../billing/application/guards/feature.guard.js';
import { RequireFeature } from '../../billing/application/decorators/require-feature.decorator.js';
import { CurrentTenant } from '../../tenant/application/decorators/current-tenant.decorator.js';

/**
 * 商品管理接口
 * 路径前缀: /api/products
 * 所有接口必须经过: JWT 鉴权 → 套餐 Feature 校验 → RBAC 鉴权
 */
@ApiTags('商品管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productAppService: ProductApplicationService) {}

  /**
   * 分页查询商品列表
   * 功能权限: PRODUCT_READ (基础版可用)
   */
  @Get()
  @RequireFeature('PRODUCT_READ')
  @ApiOperation({ summary: '分页查询商品列表' })
  async list(@CurrentTenant() tenantId: string, @Query() query: ProductListQueryDto) {
    return this.productAppService.list(tenantId, query);
  }

  /**
   * 创建商品
   * 功能权限: PRODUCT_WRITE (专业版可用)
   * 配额检查: 每月商品数上限 (由 BillingPort 检查)
   */
  @Post()
  @RequireFeature('PRODUCT_WRITE')
  @ApiOperation({ summary: '创建商品' })
  async create(@CurrentTenant() tenantId: string, @Body() dto: CreateProductDto) {
    return this.productAppService.create(tenantId, dto);
  }
}
```

**Controller 禁令**:

```diff
- ❌ 禁止在 Controller 里写 if/else 业务判断 (全部下沉到 Application / Domain 层)
- ❌ 禁止在 Controller 里注入 PrismaService (只能注入 Application Service)
- ❌ 禁止手写 try/catch 吞异常 (用 NestJS Global Exception Filter 统一处理)
- ❌ 禁止返回 any 类型 (必须有明确的返回类型, 优先从 @saas/contracts import)
```

### 3.4 Application Service 规范

```typescript
// ✅ 正确示例: commerce/application/product.service.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { Transactional } from '@/shared/infrastructure/prisma/transactional.decorator.js';
import { EventBusPort } from '@/shared/ports/event-bus.port.js';
import { BillingPort } from '@/shared/ports/billing.port.js';
import { AuditLogPort } from '@/shared/ports/audit-log.port.js';
import { ProductRepository } from '../domain/ports/product.repository.port.js';
import { ProductCreatedEvent } from '../domain/events/product-created.event.js';
import { CreateProductDto } from '../interfaces/dto/product.dto.js';

/**
 * 商品应用服务
 * 职责: 编排领域对象 → 管理事务 → 发布事件 → 调用外部端口
 * 禁止: 写具体 SQL / 写 if/else 业务规则
 */
@Injectable()
export class ProductApplicationService {
  constructor(
    // 领域仓储接口 (本模块内部)
    private readonly productRepo: ProductRepository,
    // 跨模块端口 (通过 shared/ports 定义)
    @Inject('BillingPort') private readonly billing: BillingPort,
    @Inject('EventBusPort') private readonly eventBus: EventBusPort,
    @Inject('AuditLogPort') private readonly auditLog: AuditLogPort,
  ) {}

  /**
   * 创建商品 (Use Case)
   * 流程: 配额检查 → 工厂创建实体 → 保存 → 记审计 → 发事件
   */
  @Transactional() // 声明式事务, 方法内所有 DB 操作在同一事务中
  async create(tenantId: string, dto: CreateProductDto) {
    // Step 1: 配额检查 (走 Billing 端口)
    const quotaOk = await this.billing.checkQuota(tenantId, 'products', 1);
    if (!quotaOk) {
      throw new ForbiddenException('商品数量已达套餐上限, 请升级套餐或删除旧商品');
    }

    // Step 2: 通过领域工厂创建实体 (业务规则在领域层)
    const product = ProductFactory.createFromDto(tenantId, dto);

    // Step 3: 保存 (Repository, 实现层可能是 Prisma / TypeORM / 任何东西)
    const saved = await this.productRepo.save(product);

    // Step 4: 异步写审计日志
    void this.auditLog.logCreate(tenantId, 'product', saved.id, dto);

    // Step 5: 发布领域事件 (谁订阅我不管, 解耦定制化需求)
    await this.eventBus.publish(new ProductCreatedEvent(tenantId, saved));

    return saved;
  }
}
```

**Application Service 铁律**:

```
1. 方法名必须是动词短语 (create / list / approve / cancel, 不是 getProduct / setStatus)
2. 每个 public 方法 = 一个 Use Case (用例), 有明确的业务意图
3. 必须用 @Transactional() 装饰器管理事务 (禁止手动 tx.commit / rollback)
4. 跨模块调用必须走 Port 接口 (禁止直接 import 其他模块的 Service)
5. 所有写操作之后必须: ①记 AuditLog ②发 DomainEvent (二选一的话都选)
```

### 3.5 多租户安全规范 (最容易出生产事故的地方)

**Codex 必须逐行检查以下内容, 缺一不可**：

```
检查 1: 每个查询是否通过 TenantContextResolver 获取上下文?
检查 2: LOGICAL 隔离模式下, Prisma 查询是否自动追加 tenantId 过滤?
检查 3: Prisma 查询前是否设置了 app.current_tenant_id (用于 RLS 兜底)?
检查 4: 是否用了 @CurrentTenant() 装饰器, 而不是让前端把 tenantId 写在 Body 里?
检查 5: 批量操作 (updateMany / deleteMany) 是否有租户级 WHERE 条件?
```

**RLS 兜底中间件（必须存在）示例**：

```typescript
// shared/infrastructure/prisma/rls.middleware.ts
/**
 * Prisma 查询中间件: 自动注入 PG RLS 上下文
 * 这是多租户数据安全的最后一道防线, 代码层漏写了也不会越权
 */
export function createRlsMiddleware(tenantContextResolver: TenantContextResolver) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) => {
    // 获取当前请求的 tenantId (从 AsyncLocalStorage)
    const tenantId = asyncLocalStorage.getStore()?.tenantId;
    if (!tenantId) return next(params);

    // 解析租户上下文 (是否需要 RLS)
    const ctx = await tenantContextResolver.resolve(tenantId);
    if (ctx.rlsEnabled) {
      // 在同一个 DB 连接里设置 RLS 变量
      await prisma.$executeRawUnsafe(`SET app.current_tenant_id = '${tenantId}'::uuid`);
    }

    const result = await next(params);

    // 查询完成后清理 (连接池复用场景)
    if (ctx.rlsEnabled) {
      await prisma.$executeRawUnsafe(`RESET app.current_tenant_id`);
    }

    return result;
  };
}
```

**越权访问常见反模式（Codex 必须拒绝生成）**:

```diff
- ❌ 错误: 用户可以在 Body 里传 tenantId 来操作其他租户数据
    async create(@Body() dto: { tenantId: string; name: string }) { ... }

- ❌ 错误: 没有追加租户过滤
    prisma.product.findMany({ where: { status: 'active' } })
    // LOGICAL 模式应该是: where: { tenantId: currentTenantId, status: 'active' }

- ❌ 错误: 批量删除漏了租户条件
    prisma.product.deleteMany({ where: { id: { in: ids } } })
    // 应该追加 tenantId: prisma.product.deleteMany({ where: { id: { in: ids }, tenantId } })

- ❌ 错误: 用原始 SQL 没走占位符
    prisma.$queryRawUnsafe(`SELECT * FROM products WHERE id = ${id}`)
    // SQL 注入风险 + 租户 ID 污染风险, 必须用参数化查询
```

### 3.6 Prisma & 数据库规范

**字段类型硬约束**:

```
金额/价格字段:  必须用 Decimal(12, 2) (禁止 float / number, 精度会丢失)
时间戳字段:     必须用 Timestamptz(6) (带时区, 禁止用 Date 存本地时间)
主键字段:       必须用 UUID (@id @default(dbgenerated("gen_random_uuid()")))
软删除:         deletedAt DateTime? (禁止真删, 除非有合规要求)
版本号:         version Int @default(0) (乐观锁, 写操作必须 version + 1)
JSON 扩展字段:  Json (用于自定义属性, 禁止主字段 JSONB)
租户标识:       tenantId String @map("tenant_id") (LOGICAL 模式必填)
```

**Prisma Repository 封装规范**:

```typescript
// ✅ 正确: 仓储模式封装 Prisma, Application Service 只依赖接口
// commerce/domain/ports/product.repository.port.ts
export interface ProductRepository {
  findById(id: string, tenantId: string): Promise<Product | null>;
  list(tenantId: string, query: ListQuery): Promise<PaginatedResult<Product>>;
  save(product: Product): Promise<Product>;
  softDelete(id: string, tenantId: string): Promise<void>;
}

// commerce/infrastructure/repositories/prisma-product.repository.ts
@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextResolver,
  ) {}

  /** 根据 ID + 租户 ID 查询商品 (确保不越权) */
  async findById(id: string, tenantId: string): Promise<Product | null> {
    const ctx = await this.tenantContext.resolve(tenantId);

    const where: Prisma.ProductWhereUniqueInput = ctx.autoAppendTenantId
      ? { id, tenantId } // LOGICAL 模式: 强制拼 tenantId
      : { id }; // SCHEMA/PHYSICAL 模式: 物理隔离不需要

    const raw = await this.prisma.product.findUnique({ where });
    return raw ? ProductMapper.toDomain(raw) : null;
  }
}
```

### 3.7 计费与配额硬规则 (Billing is King)

```
Codex 生成的每个写操作接口, 必须包含:

1. @UseGuards(FeatureGuard) → 检查套餐 Feature Key
2. @RequireFeature('XXX')   → 声明需要的功能权限
3. 在 Application Service 内, 通过 BillingPort.checkQuota() 检查配额
4. 写操作成功后, 通过 BillingPort.recordUsage() 记录用量 (用于月末结算)
5. 写操作前后, 通过 AuditLogPort 记录审计日志
```

**Feature Key 命名约定**:

```
命名规则: {MODULE}_{ACTION}_{GRANULARITY}
示例:
  PRODUCT_READ              读取商品列表/详情
  PRODUCT_WRITE             创建/编辑商品
  PRODUCT_DELETE            删除商品
  ORDER_EXPORT              导出订单 Excel
  REPORT_ANALYTICS_DASHBOARD  经营分析大盘
  TENANT_SCHEMA_ISOLATION   专属 Schema (专业版功能)
  STAFF_UNLIMITED           无限制员工账号
```

---

## 四、跨端协作规范 (接口契约优先)

### 4.1 接口契约驱动开发 (Contract First)

**禁止**：后端先写 Controller → 前端再对接 → 然后双方吵架改字段。

**必须**：先定义 `packages/contracts` 里的 DTO/接口 → 前后端并行开发 → 最后联调。

```
packages/contracts/src/
├── commerce/
│   ├── product.ts          # Product 相关的 Request / Response 类型
│   ├── order.ts            # Order 相关的 Request / Response 类型
│   └── payment.ts          # Payment 相关的 Request / Response 类型
├── platform/
│   ├── health.ts           # 健康检查接口类型
│   ├── tenant-access-state.ts  # 租户访问状态 (鉴权/订阅/配额)
│   └── billing.ts          # 套餐/订阅/发票类型
└── tenant/
    └── tenant-isolation-level.ts  # 多租户隔离级别枚举
```

**Contract 示例**：

```typescript
// packages/contracts/src/commerce/product.ts
/** 商品列表查询参数 (前端请求用) */
export interface ProductListQuery {
  page?: number; // 页码, 默认 1
  pageSize?: number; // 每页条数, 默认 20
  keyword?: string; // 关键词搜索 (名称/编码)
  categoryId?: string; // 分类 ID
  status?: ProductStatus;
  sortBy?: 'createdAt' | 'price' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

/** 商品列表项 (后端返回用) */
export interface ProductListItem {
  id: string;
  code: string; // 商家编码
  name: string;
  price: string; // 金额统一传 String, 前端用 Decimal 解析
  stockQty: number; // 可售库存
  status: ProductStatus;
  primaryImage?: string; // 主图 URL
  createdAt: string; // ISO 时间字符串
}

/** 分页结果包装器 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 商品状态枚举 (前后端共用) */
export enum ProductStatus {
  DRAFT = 'draft', // 草稿
  LISTED = 'listed', // 已上架
  UNLISTED = 'unlisted', // 已下架
  SOLD_OUT = 'sold_out', // 售罄
}
```

### 4.2 HTTP 响应统一格式

**所有后端接口必须返回统一格式，禁止裸返回数据**：

```typescript
// packages/contracts/src/platform/api-response.ts
export interface ApiResponse<T = unknown> {
  code: number;    // 0 = 成功, 非 0 = 业务错误码
  message: string; // 前端直接展示的友好文案
  data: T;         // 业务数据
  traceId?: string; // 链路追踪 ID (排错用)
}

// ✅ 成功示例
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [...],
    "total": 120,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "req-abc123xyz"
}

// ✅ 失败示例 (配额超限)
{
  "code": 40201,
  "message": "商品数量已达套餐上限(500), 请升级专业版解锁无限制",
  "data": {
    "current": 500,
    "limit": 500,
    "upgradeUrl": "/billing/upgrade"
  },
  "traceId": "req-xyz789"
}
```

### 4.3 前后端联调契约 (SLA)

```
前端允许的请求参数:
  1. Query 参数: 必须是 primitive (string/number/boolean), 禁止传 JSON 对象
  2. Body 参数:  JSON 格式, 禁止传 form-data (文件上传除外)
  3. Header:    必须带 Authorization: Bearer <access_token>
                必须带 X-Tenant-Id: <tenant_id> (从当前租户信息取)
                必须带 X-Request-Id: <uuid> (用于链路追踪)

后端必须返回的响应:
  1. 成功: HTTP 200 + code = 0
  2. 业务失败: HTTP 200 + code != 0 (不是用 4xx/5xx HTTP 状态码表达业务错误)
  3. 鉴权失败: HTTP 401 + code = 40100
  4. 权限不足: HTTP 403 + code = 40300
  5. 配额超限: HTTP 402 + code = 402xx
  6. 限流熔断: HTTP 429 + code = 42900 + Retry-After Header
  7. 服务端异常: HTTP 500 + code = 50000 + traceId (前端不要展示堆栈)
```

---

## 五、Codex 生成代码质量自检清单 (Must Check)

Codex 生成任何代码后，必须逐项对照以下清单。**不合格则自动重写，不允许交付**：

### 5.1 通用清单 (全栈适用)

```
[ ] 1. 是否有明确的文件级注释 (说明本文件的职责、所属模块)?
[ ] 2. 公共函数/类/方法是否有 JSDoc 注释 (说明入参、返回值、异常)?
[ ] 3. 类型是否严格? (any / @ts-ignore / @ts-expect-error 计数 = 0)
[ ] 4. 命名是否语义化? (禁止 fn1 / tmp / data / xxx 命名)
[ ] 5. 函数长度 ≤ 50 行? (超过必须拆分)
[ ] 6. 圈复杂度 ≤ 10? (if/else/switch/?: 嵌套不超过 3 层)
[ ] 7. 是否有错误处理? (异步函数有 try/catch 或 Promise.catch)
[ ] 8. 是否有硬编码的魔法数字/字符串? (必须提取为常量/枚举)
[ ] 9. 是否遵守现有项目的代码格式? (Prettier / ESLint 无报错)
[ ] 10. 是否复用了现有组件/函数/类? (禁止重复发明轮子)
```

### 5.2 前端专项清单

```
[ ] 1. 是否使用了设计系统 Token? (禁止裸写 #FFFFFF / bg-white / text-gray-800)
[ ] 2. 是否遵守 8pt Grid? (间距是 4/8/12/16/20/24... 的倍数)
[ ] 3. Element Plus 组件是否正确使用? (禁止自己写 div 模拟 ElTable)
[ ] 4. HTTP 请求是否走了 api/ 层? (禁止直接 axios/fetch)
[ ] 5. 大型数据是否用 shallowRef / markRaw? (防止 Vue 深度响应性能问题)
[ ] 6. 按钮/Tab/Badge 文字是否有 whitespace-nowrap? (禁止折行缺陷)
[ ] 7. 弹窗/Drawer 是否有关闭时的清理逻辑? (resetFields + clearValidate)
[ ] 8. 列表是否有分页/加载态/空态三个状态? (禁止空页面白屏)
[ ] 9. 是否有 feature-flag? (套餐功能灰度用 v-if="hasFeature('XXX')")
[ ] 10. 是否有防抖/节流? (搜索输入、滚动事件、窗口 resize)
```

### 5.3 后端专项清单

```
[ ] 1. 是否遵守六边形分层? (Controller → App Service → Domain → Infrastructure)
[ ] 2. 跨模块调用是否通过 Port 接口? (禁止直接 import)
[ ] 3. 多租户安全检查通过? (5 个 RLS 检查项全绿)
[ ] 4. 计费/配额检查是否完整? (Feature Guard + BillingPort.checkQuota + recordUsage)
[ ] 5. 是否写了审计日志? (写操作 + 敏感读操作 AuditLogPort.logXxx)
[ ] 6. 金额字段是否用了 Decimal? (禁止 number / float)
[ ] 7. 是否有幂等处理? (写操作接口有 idempotency_key 唯一索引)
[ ] 8. 事务边界是否正确? (关键写操作有 @Transactional())
[ ] 9. 是否发布了领域事件? (关键状态变更有 EventBus.publish)
[ ] 10. 是否有测试用例? (公共 Domain Service 必须带 Vitest 单测)
```

---

## 六、常用代码片段模板 (Codex 可直接复用)

### 6.1 前端: 标准列表页模板

```vue
<!-- views/products/ProductList.vue -->
<script setup lang="ts">
/**
 * 商品列表页
 * 功能: 搜索 + 筛选 + 分页 + 批量操作 + 跳详情
 * 套餐权限: PRODUCT_READ (基础版+)
 */
import { onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProductList } from '@/composables/use-product-list';
import { useTenantStore } from '@/stores/use-tenant-store';
import DataTable from '@/components/common/DataTable.vue';
import SearchForm from '@/components/common/SearchForm.vue';
import type { ProductStatus } from '@saas/contracts';

const tenantStore = useTenantStore();
const canEdit = computed(() => tenantStore.hasFeature('PRODUCT_WRITE'));
const canDelete = computed(() => tenantStore.hasFeature('PRODUCT_DELETE'));

// 复用列表逻辑 composable
const {
  list,
  total,
  loading,
  pagination,
  searchParams,
  selectedRows,
  handleSearch,
  handleReset,
  handlePageChange,
  handleDelete,
} = useProductList();

// 搜索栏配置
const searchFields = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '商品名称/编码' },
  { prop: 'status', label: '状态', type: 'select', options: ProductStatusOptions },
  { prop: 'categoryId', label: '分类', type: 'cascader' },
];

// 表格列配置
const tableColumns = [
  { prop: 'code', label: '编码', width: 140 },
  { prop: 'name', label: '商品名称', minWidth: 200, showOverflowTooltip: true },
  { prop: 'price', label: '售价', width: 120, formatter: formatCurrency },
  { prop: 'stockQty', label: '库存', width: 100 },
  { prop: 'status', label: '状态', width: 100, type: 'tag', tagMap: productStatusTagMap },
  { prop: 'createdAt', label: '创建时间', width: 180 },
  {
    prop: 'actions',
    label: '操作',
    width: 220,
    fixed: 'right',
    buttons: (row) => [
      { label: '查看', type: 'primary', link: true, onClick: () => goDetail(row.id) },
      {
        label: '编辑',
        type: 'primary',
        link: true,
        show: canEdit.value,
        onClick: () => goEdit(row.id),
      },
      {
        label: '删除',
        type: 'danger',
        link: true,
        show: canDelete.value,
        onClick: () => confirmDelete(row),
      },
    ],
  },
];

/** 确认删除单条 */
function confirmDelete(row: ProductListItem) {
  ElMessageBox.confirm(`确认删除商品「${row.name}」?`, '删除确认', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })
    .then(() => handleDelete([row.id]))
    .then(() => ElMessage.success('删除成功'))
    .catch(() => {});
}

onMounted(handleSearch);
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- 搜索栏 -->
    <SearchForm
      :fields="searchFields"
      v-model="searchParams"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 操作工具栏 -->
    <div class="flex justify-between items-center">
      <div class="flex gap-2">
        <el-button
          v-if="canEdit"
          type="primary"
          :class="/* Token */ 'bg-[var(--accent-gold-primary)]'"
          @click="goCreate"
        >
          + 新建商品
        </el-button>
        <el-button v-if="canDelete && selectedRows.length" type="danger" @click="batchDelete">
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
      <div class="text-[var(--text-dark-secondary)] text-sm">共 {{ total }} 条记录</div>
    </div>

    <!-- 数据表格 -->
    <DataTable :columns="tableColumns" :data="list" :loading="loading" v-selection="selectedRows" />

    <!-- 分页 -->
    <div class="flex justify-end pt-2">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>
```

### 6.2 后端: 标准 Controller + Application Service 模板

```typescript
// apps/core/src/commerce/interfaces/order.controller.ts
/**
 * 订单管理接口
 * 路径前缀: /api/orders
 */
import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderApplicationService } from '../application/order.service.js';
import { CreateOrderDto, CancelOrderDto, OrderListQueryDto } from './dto/order.dto.js';
import { JwtAuthGuard } from '../../auth/application/guards/jwt-auth.guard.js';
import { FeatureGuard } from '../../billing/application/guards/feature.guard.js';
import { RequireFeature } from '../../billing/application/decorators/require-feature.decorator.js';
import { CurrentTenant } from '../../tenant/application/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../auth/application/decorators/current-user.decorator.js';

@ApiTags('订单管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderAppService: OrderApplicationService) {}

  @Get()
  @RequireFeature('ORDER_READ')
  @ApiOperation({ summary: '分页查询订单列表' })
  list(@CurrentTenant() tenantId: string, @Query() query: OrderListQueryDto) {
    return this.orderAppService.list(tenantId, query);
  }

  @Post()
  @RequireFeature('ORDER_WRITE')
  @ApiOperation({ summary: '创建订单' })
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderAppService.create(tenantId, userId, dto);
  }

  @Post(':id/cancel')
  @RequireFeature('ORDER_CANCEL')
  @ApiOperation({ summary: '取消订单' })
  cancel(
    @CurrentTenant() tenantId: string,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderAppService.cancel(tenantId, orderId, dto.reason);
  }
}
```

```typescript
// apps/core/src/commerce/application/order.service.ts
/**
 * 订单应用服务
 * 用例编排: 创建订单 / 取消订单 / 订单支付 / 发货 / 退款
 */
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Transactional } from '@/shared/infrastructure/prisma/transactional.decorator.js';
import { BillingPort } from '@/shared/ports/billing.port.js';
import { EventBusPort } from '@/shared/ports/event-bus.port.js';
import { AuditLogPort } from '@/shared/ports/audit-log.port.js';
import { InventoryPort } from '@/shared/ports/inventory.port.js';
import { OrderRepository, OrderItemRepository } from '../domain/ports/order.repository.port.js';
import { OrderFactory } from '../domain/factories/order.factory.js';
import { OrderCreatedEvent, OrderCancelledEvent } from '../domain/events/order.events.js';
import { CreateOrderDto } from '../interfaces/dto/order.dto.js';

@Injectable()
export class OrderApplicationService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly orderItemRepo: OrderItemRepository,
    @Inject('BillingPort') private readonly billing: BillingPort,
    @Inject('InventoryPort') private readonly inventory: InventoryPort,
    @Inject('EventBusPort') private readonly eventBus: EventBusPort,
    @Inject('AuditLogPort') private readonly auditLog: AuditLogPort,
  ) {}

  /**
   * 创建订单
   * 流程: 配额检查 → 锁定库存 → 生成订单号 → 保存订单+明细 → 解锁(扣减)库存 → 事件
   */
  @Transactional()
  async create(tenantId: string, userId: string, dto: CreateOrderDto) {
    // 1. 配额检查 (订单数 / GMV 配额)
    await this.billing.checkQuotaOrThrow(tenantId, 'orders_per_month', 1);

    // 2. 预锁定库存 (调用仓储端口, 走库存模块)
    const lockedItems = await this.inventory.lockStock(
      tenantId,
      dto.items.map((it) => ({ variantId: it.variantId, qty: it.qty })),
    );
    if (!lockedItems.success) {
      throw new BadRequestException(`库存不足: ${lockedItems.failedVariantIds.join(', ')}`);
    }

    try {
      // 3. 领域工厂创建订单 (业务规则在工厂方法内)
      const { order, items } = OrderFactory.createFromDto(tenantId, userId, dto, lockedItems);

      // 4. 保存
      const savedOrder = await this.orderRepo.save(order);
      await this.orderItemRepo.saveMany(items);

      // 5. 扣减库存 (从锁定 → 实际出库)
      await this.inventory.confirmLockedStock(tenantId, lockedItems.lockBatchId);

      // 6. 记审计
      void this.auditLog.logCreate(tenantId, 'order', savedOrder.id, { dto, userId });

      // 7. 发布事件 (触发: 库存告警检查 / ERP 同步 / 通知客户等扩展逻辑)
      await this.eventBus.publish(new OrderCreatedEvent(tenantId, savedOrder.id));

      return savedOrder;
    } catch (err) {
      // 失败回滚库存锁
      await this.inventory.releaseLockedStock(tenantId, lockedItems.lockBatchId);
      throw err;
    }
  }
}
```

---

## 七、禁止事项终极清单 (Codex 触发即终止)

```
【红线 0】数据安全红线
  - 严禁前端把 tenantId / userId / role 写在请求 Body 里让后端信任
  - 严禁任何查询 (findMany/updateMany/deleteMany) 不带租户条件
  - 严禁用 $queryRawUnsafe 传字符串拼接 SQL (必须参数化)
  - 严禁 Console.log / Error.message 输出 token / 密钥 / 客户隐私数据

【红线 1】架构红线
  - 严禁绕过五大防腐层接口直接通信
  - 严禁破坏六边形架构分层 (Controller 写 SQL, Domain 层 import Prisma)
  - 严禁新增模块不按 4 层目录结构创建

【红线 2】计费红线
  - 严禁写操作接口不加 FeatureGuard / RequireFeature
  - 严禁跳过 BillingPort.checkQuota 直接操作数据
  - 严禁硬编码套餐判断 (if planCode === 'pro' { ... })

【红线 3】设计系统红线
  - 严禁出现廉价渐变 / 霓虹光 / 玻璃拟态 / 超大圆角
  - 严禁不用设计系统 Token 直接写颜色值
  - 严禁按钮/Tab/Badge 文字折行

【红线 4】代码质量红线
  - 严禁 any / @ts-ignore
  - 严禁函数 > 100 行 / 嵌套 > 4 层
  - 严禁无注释的公共 API
  - 严禁复制粘贴超过 3 段相似代码而不提取
```

---

**文档版本**: v1.0
**最后更新**: 2026-08-26
**维护人**: 架构组
**适用范围**: 本项目所有 Codex / AI 代码助手生成的代码
