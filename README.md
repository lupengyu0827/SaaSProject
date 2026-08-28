# SaaS Platform

基于 `docs/多租户电商SaaS平台架构设计.md` 从零构建的多租户电商 SaaS Monorepo。

## 环境要求

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

## 快速开始

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:deploy
pnpm db:seed
pnpm dev
```

- Gateway 健康检查：<http://localhost:3000/api/health>
- Core 健康检查：<http://localhost:3001/api/health>
- MinIO Console：<http://localhost:9001>

## 常用命令

```bash
pnpm check       # format + lint + typecheck + test + build
pnpm infra:down  # 停止本地基础设施
```

## Week 2 演示链路

注册一个免费租户：

```bash
curl -X POST http://localhost:3001/api/platform/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Demo Store","subdomain":"demo","planCode":"free","ownerEmail":"owner@example.com","ownerPassword":"change-this-password"}'
```

登录并保存返回的 `accessToken`：

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"subdomain":"demo","email":"owner@example.com","password":"change-this-password"}'
```

使用返回的 `tenantId` 和 `accessToken` 调用 Gateway：

```bash
curl http://localhost:3000/api/demo/advanced-report \
  -H 'authorization: Bearer <accessToken>' \
  -H 'x-tenant-id: <tenantId>'
```

免费版返回 `403`。通过 Core 将套餐改为 `pro` 后，Gateway 缓存会主动失效，再次调用返回 `200`：

```bash
curl -X POST http://localhost:3001/api/platform/tenants/<tenantId>/subscription/plan \
  -H 'content-type: application/json' \
  -d '{"planCode":"pro"}'
```

模拟订阅过期：

```bash
curl -X POST http://localhost:3001/api/platform/tenants/<tenantId>/subscription/expire

curl -X POST http://localhost:3000/api/demo/advanced-report/refresh \
  -H 'authorization: Bearer <accessToken>' \
  -H 'x-tenant-id: <tenantId>'
```

宽限期内读取仍然可用，但写请求返回 `402 Payment Required`。

## Week 3 安全基线

- 注册租户时会建立 Owner 管理员与系统角色，并授予种子数据中的全部权限。
- Gateway 在功能与配额检查之后执行 `@RequirePermission()` RBAC 检查。
- 所有成功的写请求由出站拦截器写入 `shared.audit_logs`。
- `commerce.tenant_probes` 开启并强制 PostgreSQL RLS；访问必须在事务内设置
  `app.current_tenant_id`，用于验证即使查询漏写 `tenant_id` 过滤也不会跨租户读取。
- Core 签发 15 分钟 JWT Access Token；Gateway 校验签名、签发方、受众、令牌类型和租户绑定。
- Refresh Token 是随机不透明令牌，数据库只保存 SHA-256 摘要；刷新时旧令牌立即撤销并轮换新令牌。
- 密码使用 Node.js `scrypt` 加随机盐保存，数据库不保存明文密码。

## Prisma PostgreSQL Adapter

Core 和种子脚本统一使用 Prisma 官方 `@prisma/adapter-pg`，适用于当前自建 PostgreSQL 16。
连接池通过 `DB_POOL_MAX`、`DB_CONNECTION_TIMEOUT_MS` 和 `DB_IDLE_TIMEOUT_MS` 配置；所有业务代码只注入
`PrismaService`，不要自行创建 `PrismaClient` 或 `pg.Pool`。

## 商品域 API

所有商品接口只通过 Gateway 的 `/api/commerce/*` 访问，并要求 JWT、套餐功能、API 配额和 RBAC
权限。金额使用字符串传输，避免 JavaScript 浮点误差；商品更新必须提交响应中的 `version`。

```text
POST   /api/commerce/categories
GET    /api/commerce/categories
POST   /api/commerce/brands
GET    /api/commerce/brands
POST   /api/commerce/products
GET    /api/commerce/products?search=&status=&cursor=&limit=
GET    /api/commerce/products/:id
PATCH  /api/commerce/products/:id
POST   /api/commerce/products/:id/variants
PATCH  /api/commerce/variants/:id
DELETE /api/commerce/variants/:id
```

## 库存流水 API

库存余额不允许直接修改，而是由不可变流水聚合得到。每个命令必须携带业务单据类型和幂等 ID；同一命令
重复提交不会重复扣减。锁定、释放和扣减在 `Serializable` 事务及 SKU 级 PostgreSQL Advisory Lock
内执行，避免并发超卖。

```text
GET  /api/commerce/inventory/:variantId
POST /api/commerce/inventory/in
POST /api/commerce/inventory/adjustment
POST /api/commerce/inventory/lock
POST /api/commerce/inventory/unlock
POST /api/commerce/inventory/out
POST /api/commerce/inventory/refund
```

## 订单域 API

创建订单、商品与价格快照、库存检查和库存锁定在同一个 `Serializable` 事务中完成。重复提交相同
`idempotencyKey` 和请求会返回原订单；同一个幂等键对应不同请求时会拒绝。取消待处理订单会写入库存解锁流水。

```text
POST /api/commerce/orders
GET  /api/commerce/orders?status=&cursor=&limit=
GET  /api/commerce/orders/:id
POST /api/commerce/orders/:id/cancel
POST /api/commerce/orders/expire
```

订单默认保留库存 30 分钟，可通过 Core 环境变量 `ORDER_PAYMENT_TIMEOUT_MINUTES` 调整。调度器定期调用
`orders/expire` 扫描当前租户的过期订单；批处理和支付确认使用同一把订单锁，不会同时把订单改成已支付和已过期。

Core 启动后默认每分钟自动扫描全部活跃租户。`ORDER_EXPIRATION_SCHEDULER_ENABLED=false` 可关闭调度，
`ORDER_EXPIRATION_SCAN_INTERVAL_MS` 可调整扫描周期（最小 10 秒）。单进程会跳过重叠执行，多实例依靠订单级
PostgreSQL Advisory Lock 和状态条件更新保证同一订单只关闭一次。

## 支付域 API

支付单金额始终取订单服务端总额，前端不能指定应付金额。模拟确认成功后，支付单成功、订单已支付、库存出库和
库存解锁会在同一个 `Serializable` 事务内完成；重复渠道事件不会重复扣库存。真实微信/支付宝回调接入时，
需要在进入该业务服务前增加平台证书验签与商户身份解析。

```text
POST /api/commerce/payments
GET  /api/commerce/payments/:id
POST /api/commerce/payments/:id/checkout
POST /api/commerce/payments/:id/confirm
```

`checkout` 根据支付单渠道返回前端调起参数。`mock` 渠道返回本地测试 token；`wechat_pay` 调用微信支付
JSAPI 下单并返回小程序需要的 `timeStamp`、`nonceStr`、`package`、`signType` 和 `paySign`。
微信支付私钥只通过文件路径读取，不进入数据库或接口响应。

微信支付成功通知入口为 `POST /api/payment-callbacks/wechat`。该入口必须接收原始请求体，并依次执行
5 分钟防重放检查、平台证书序列号匹配、RSA-SHA256 验签、AES-256-GCM 解密、商户号与金额校验，
最后进入幂等支付确认事务。租户和支付单标识来自微信加密回传的 `attach`，不接受外部租户请求头。

验签后的通知会先写入 `payment_webhook_events` Inbox 并立即返回 204。后台处理器默认每秒消费事件；
失败事件采用指数退避，最多尝试 10 次后进入 `dead_letter`，可通过 `last_error` 排查。处理语义为至少一次，
支付确认事务本身保持幂等，因此进程在“支付成功、事件未标记完成”之间退出也不会重复扣库存。

## 边界约定

- `apps/gateway` 只负责全局拦截与转发，不承载业务规则。
- `apps/core` 是模块化单体；模块内遵循 domain → application → infrastructure/interfaces。
- `packages/contracts` 只存放跨应用稳定契约，不依赖 NestJS 或数据库实现。
- 跨模块协作必须经由 `shared/ports` 中定义的端口。

## 数据库 E2E

基础设施和迁移就绪后，运行真实 PostgreSQL 业务闭环测试：

```bash
DATABASE_URL=postgresql://saas:saas_local_password@localhost:5432/saas_platform?schema=public \
  pnpm test:e2e
```

该测试会创建临时租户，依次执行商品上架、入库、下单锁库、Mock 支付 Inbox 消费、订单支付和库存出库，
完成后自动清理测试数据。普通 `pnpm test` 默认跳过数据库 E2E。
