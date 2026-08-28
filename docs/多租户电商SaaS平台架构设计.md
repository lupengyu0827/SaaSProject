# 通用型多租户电商 SaaS 平台 — 从零架构设计方案

> 设计时间：2026-08-26
> 设计目标：抛弃现有实现，从零设计一套「可商用、可演进、行业通用」的多租户电商 SaaS 平台。
> 适用场景：二手奢品、生鲜、建材、服装、数码等任意垂直电商行业。
> 设计原则：每个决策必附「为什么」，每个阶段必可独立上线赚钱。

---

## 目录

1. [顶层设计原则（3 条红线）](#1-顶层设计原则3-条红线)
2. [三阶段演进路线图（3 年不重构）](#2-三阶段演进路线图3-年不重构)
3. [技术选型决策树（附选型理由与替换路径）](#3-技术选型决策树附选型理由与替换路径)
4. [多租户隔离策略（三种模式一套代码通吃）](#4-多租户隔离策略三种模式一套代码通吃)
5. [API Gateway 拦截管道（SaaS 商业模式的心脏）](#5-api-gateway-拦截管道saas-商业模式的心脏)
6. [核心数据库设计（8 张主表 + RLS 安全网）](#6-核心数据库设计8-张主表--rls-安全网)
7. [代码分层规范（六边形架构 + 模块化单体）](#7-代码分层规范六边形架构--模块化单体)
8. [扩展引擎（定制化需求与平台核心的隔离术）](#8-扩展引擎定制化需求与平台核心的隔离术)
9. [计费系统（第 0 个要写的模块，四步闭环）](#9-计费系统第-0-个要写的模块四步闭环)
10. [部署 & DevOps 规范（Day 1 起强制执行）](#10-部署--devops-规范day-1-起强制执行)
11. [落地启动顺序（按周排期）](#11-落地启动顺序按周排期)
12. [设计的第一性原理（三条根逻辑）](#12-设计的第一性原理三条根逻辑)

---

## 1. 顶层设计原则（3 条红线）

> 任何技术选型或架构决策，违反以下任意一条直接否决。

### 1.1 Tenant First —— 一切围绕「怎么把租户卖钱」

所有决策先问自己：**这东西能不能做成套餐卖点？**

例：
- 选 PostgreSQL 而不是 MySQL → 因为 PG 支持 Schema 级隔离，可以卖「专业版：Schema 独立隔离」。
- 做三种隔离模式而不是一种 → 因为隔离级别本身就是定价梯度。
- 做自定义字段 JSONB → 可以卖「高级版：自定义商品字段」增值功能。

### 1.2 Zero Downtime Evolution —— 3 年不重构，模块可独立替换

采用「六边形架构 + 防腐层」，任何基础设施层的实现都能被替换，且业务代码 **0 改动**：

- 今天用 PostgreSQL → 明天换成 TiDB / CockroachDB
- 今天用微信支付 → 明天接 Stripe / 支付宝
- 今天跑单体 → 明天拆微服务（NestJS Microservices 同框架迁移）
- 今天用自建 MinIO → 明天切阿里云 OSS / AWS S3

**实现手段**：所有跨层交互、跨模块交互、外部依赖调用，全部通过 `Interface / Port` 进行，业务层永远只依赖抽象，不依赖具体实现。

### 1.3 Billing is King —— 计费系统比订单系统先写

没有计费系统的 SaaS 是慈善项目。订单系统 v1 可以做得很简单，计费系统 v1 必须是完整闭环：

```
套餐管理 → 订阅周期 → 优惠券 → 用量计量 → 发票 → 自动续费 → 欠费降级 → 数据归档
```

计费系统必须部署在**不可绕过的全局入口**（API Gateway），而不是每个业务模块自己判断。

---

## 2. 三阶段演进路线图（3 年不重构）

> 每个阶段都是「能上线、能赚钱、可独立运行」的完整闭环。不一步到位上微服务。

### Phase 1：MVP 验证期（0 ~ 6 月）—— 目标：10 个付费种子客户

```
                        ┌──────────────────────────────────┐
                        │      Clients 多端接入层          │
                        │  ┌───────┐ ┌───────┐ ┌────────┐ │
                        │  │ 小程序 │ │  H5   │ │  PC 后台│ │
                        │  └───┬───┘ └───┬───┘ └───┬────┘ │
                        └──────┼─────────┼─────────┼──────┘
                               │         │         │
                        ┌──────▼─────────▼─────────▼──────┐
                        │    API Gateway（自建，必选）      │
                        │    NestJS + 8 道拦截管道         │ ← 全局唯一入口
                        └───────────────┬─────────────────┘
                                        │
                        ┌───────────────▼─────────────────┐
                        │   Modular Monolith 模块化单体    │
                        │  ┌───────────────────────────┐  │
                        │  │   1. Billing Module       │  │ ← 第 0 个写的模块
                        │  ├───────────────────────────┤  │
                        │  │   2. Tenant / RBAC / Audit│  │ ← 平台层
                        │  ├───────────────────────────┤  │
                        │  │   3. Commerce Core        │  │ ← 商品/订单/库存/支付
                        │  ├───────────────────────────┤  │
                        │  │   4. Operations           │  │ ← 营销/CRM/报表/内容
                        │  ├───────────────────────────┤  │
                        │  │   5. Extension Engine     │  │ ← Webhook/插件/定制
                        │  └───────────────────────────┘  │
                        └───────────────┬─────────────────┘
                                        │
                        ┌───────────────▼─────────────────┐
                        │  PostgreSQL 16（单实例）         │
                        │  ├─ platform.* （平台自身表）     │
                        │  ├─ public.*   （LOGICAL 租户业务表 + RLS） │
                        │  ├─ tenant_xxx.*（SCHEMA 租户专属） │
                        │  Redis 7（缓存 + 限流 + 锁 + 轻量 MQ）
                        │  MinIO / S3（对象存储，S3 协议）  │
                        └─────────────────────────────────┘
```

### Phase 2：增长期（6 ~ 18 月）—— 目标：100 ~ 500 付费租户

**只拆两个最需要独立部署的服务**（最高频变更、最怕相互影响），业务核心继续跑单体，不急着拆：

```
Clients
   │
API Gateway（新增：租户级灰度发布 / 金丝雀）
   │
┌────────────┬──────────────────┬─────────────────┐
│            │                  │                 │
Billing Svc  Extension Svc    Commerce Monolith
(独立部署)   (独立部署)        （不拆，继续跑）
└────────────┴──────────────────┴─────────────────┘
   │
PostgreSQL（主从 + 读写分离）
Redis Cluster（分片）
Elasticsearch（商品搜索 / 全文检索）
```

拆出的理由：
1. **Billing 是钱袋子**，不能和业务抢资源，任何业务事故不能影响扣款。
2. **Extension 是屎盆子**，定制化代码和大客户 Webhook 最容易炸，独立部署不拖垮核心。

### Phase 3：规模化（18 月 +）—— 目标：1000+ 租户，多行业适配

按**领域边界**拆微服务，每个行业做垂直插件包：

```
              Clients（行业化前端皮肤包）
                 │  ┌───────────────────────┐
                 │  │ 奢品皮肤（4C/证书/押运）│
                 │  │ 生鲜皮肤（保质期/冷链） │ ← 前端也插件化
           Gateway  │ 建材皮肤（安装/工地）   │
                 │  └───────────────────────┘
   ┌───────┬─────┼───────┬────────┬────────┬──────────┐
   │       │     │       │        │        │          │
 租户服务 商品服务 订单服务 库存服务 营销服务 行业插件集群
(微服务)(微服务)(微服务)(微服务)(微服务)  (奢品/生鲜/…)
   └───────┴─────┼───────┴────────┴────────┴──────────┘
                 │
     Distributed DB（TiDB / PG 分片中间件 Citus）
     Kafka / RocketMQ（消息队列）
     Prometheus + Grafana + Jaeger（可观测性三件套）
```

---

## 3. 技术选型决策树（附选型理由与替换路径）

### 3.1 编程语言 & 运行时

| 层级 | 选型 | 为什么选 | 什么时候换（备选） |
|:---|:---|:---|:---|
| 后端主语言 | **TypeScript + Node.js 20 LTS** | 1. 前后端同语言，招聘与协作成本最低；<br>2. 电商是 IO 密集型（查 DB、调接口），Node 足够；<br>3. 支付/鉴权/ORM 生态最成熟。 | 当 QPS > 10,000+，或出现 CPU 密集型瓶颈时，核心性能模块用 **Go / Rust** 重写。 |
| 后端框架 | **NestJS 10+** | 1. 原生模块化 + 依赖注入 + 中间件管道；<br>2. 天然六边形分层（Controller→Service→Repository）；<br>3. 从单体到微服务（Nest Microservices）几乎零改造；<br>4. 内置鉴权、校验、守卫、拦截器等 SaaS 必备基建。 | 不选 Fastify/Koa：太裸，团队容易写乱；<br>不选 Spring Boot：太重，招人难，迭代慢。 |
| 前端主语言 | **TypeScript + Vue 3 + Vite** | 现有团队已用 Vue 3，迁移成本低。uni-app 编译多端。 | React 也可，但对当前团队是额外成本。 |

### 3.2 数据存储层（最核心的选型，直接决定能不能卖钱）

#### ❌ 为什么不选 MongoDB / 微信云数据库？
1. **事务能力弱**：跨表事务要么没有要么弱鸡，订单/库存系统不敢用。
2. **Schema 隔离做不到**：无法支持 SCHEMA 隔离套餐 → 直接少了一个定价梯度。
3. **聚合查询弱**：后期做报表、经营分析会想死。

#### ✅ 为什么是 PostgreSQL 16+？

| 卖点 | 如何变成套餐收益 |
|:---|:---|
| **Schema 级隔离** | 直接做成「专业版：专属 Schema 独立空间」，加钱 +50%。 |
| **Row-Level Security（RLS）** | 即使代码漏写 `WHERE tenant_id`，数据库层也拦截越权 → 产品「数据安全承诺」的卖点。 |
| **JSONB 字段** | 灵活扩展自定义字段 → 卖「高级版：自定义商品/订单字段」增值功能。 |
| **CTE + 窗口函数** | 经营分析、库龄、滞销统计都能做 → 前期不上数仓也能跑。 |
| **PG Vector 插件** | 未来 AI 语义搜索直接上 → 卖「AI 智能选品」功能。 |

#### ✅ 配套存储选型

| 组件 | 选型 | 用途 | 替换路径 |
|:---|:---|:---|:---|
| 缓存 / 限流 / 锁 | **Redis 7+** | 1. 热点数据缓存（商品、套餐配置）；<br>2. API Gateway 租户级限流；<br>3. 订单/库存分布式锁；<br>4. 轻量 MQ（后期换 Kafka）。 | 规模大了上 Redis Cluster 分片。 |
| 对象存储 | **MinIO（自建） / Backblaze / OSS** | 商品图、证书、发票 PDF。**必须走 S3 兼容协议**，随时可迁。 | 前期 MinIO 自建，后期按成本切云厂商。 |
| 搜索引擎 | 前期 PG Full Text Search → **Elasticsearch / OpenSearch** | 商品搜索、全文检索。Phase 2 再加，不急。 | 不选 Meilisearch：企业级功能（同义词、权重、多租户隔离）弱。 |

### 3.3 ORM：Prisma 5+

- **为什么不选 TypeORM / Sequelize**：迁移管理不可靠，类型系统有洞。
- **为什么是 Prisma**：
  1. **端到端类型安全**：从 DB Schema → Prisma Schema → TS 类型，全链路零 any。
  2. **原生支持 multi-schema**：完美契合 SCHEMA 隔离模式。
  3. **Prisma Migrate**：迁移管理比手写 SQL 稳。
- **替换路径**：Repository 模式封装，核心代码不直接依赖 PrismaClient。将来换 Drizzle / TypeORM 只改 Repository 实现层。

### 3.4 API Gateway（SaaS 的心脏，Phase 1 必须自建）

- **为什么不选云厂商 API Gateway / Kong / APISIX**？
  - 云厂商：Vendor Lock-in，迁不动。
  - Kong / APISIX：太重，Phase 1 团队驾驭不了，光 Lua 脚本和插件就能把你玩死。
- **选型**：用 NestJS 写一个 **Gateway Service**，和业务共用技术栈，前面套 Nginx 做 TLS / 静态资源。
  - 好处：团队看得懂、能 Debug、能扩展。
  - 和业务单体的区别：Gateway 只做**拦截**和**转发**，不写任何业务逻辑。

---

## 4. 多租户隔离策略（三种模式一套代码通吃）

> 三种隔离模式 = 三档定价梯度，一套代码通过 `TenantIsolationLevel` 枚举切换。

```typescript
/**
 * 租户隔离级别 —— 直接对应 SaaS 套餐售价
 */
export enum TenantIsolationLevel {
  /**
   * 逻辑隔离（入门版 / 免费版）
   * 所有租户共享同一张表，靠 tenant_id + PG RLS 行级安全做隔离
   * 成本最低，隔离性最弱
   */
  LOGICAL = 'logical',

  /**
   * Schema 隔离（专业版 / 团队版）
   * 一个租户 = 一个独立 Schema（相当于"命名空间"）
   * 表结构相同，物理数据文件共享但逻辑独立
   * 成本中等，隔离性中等（主流 SaaS 都在这儿）
   */
  SCHEMA = 'schema',

  /**
   * 物理隔离（旗舰版 / 私有化部署）
   * 一个租户 = 一个独立数据库实例 / 独立连接串
   * 成本最高，隔离性最强
   * 奢品 / 金融 / 医疗客户愿意为这个付 3~10 倍溢价
   */
  PHYSICAL = 'physical',
}
```

### 4.1 三种模式的路由规则（`TenantContext` 服务统一管理）

```typescript
/**
 * 租户上下文解析器
 * 根据租户的隔离级别动态选择：用哪条连接、哪个 Schema、是否拼 tenant_id
 * 所有 Repository 必须通过 TenantContext 获取查询上下文
 */
@Injectable()
export class TenantContextResolver {
  /**
   * 根据租户 ID 解析出完整的 DB 访问上下文
   */
  async resolve(tenantId: string): Promise<TenantDbContext> {
    // 1. 查 tenants 表，拿到 isolation_level / schema_name / db_connection
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });

    switch (tenant.isolationLevel) {
      case TenantIsolationLevel.LOGICAL:
        return {
          prisma: this.sharedPrismaClient,    // 共享库连接
          schema: 'public',                    // 共享 Schema
          autoAppendTenantId: true,            // 所有查询自动拼 tenant_id
          rlsEnabled: true,                    // 同时启用 PG RLS 兜底
        };

      case TenantIsolationLevel.SCHEMA:
        return {
          prisma: this.sharedPrismaClient,    // 同一个库（同一个连接池复用）
          schema: tenant.schemaName,           // 租户专属 Schema
          autoAppendTenantId: false,           // 不需要 tenant_id 了
          rlsEnabled: false,
        };

      case TenantIsolationLevel.PHYSICAL:
        return {
          prisma: this.getDedicatedClient(tenant),  // 专属连接池（按租户缓存）
          schema: 'public',
          autoAppendTenantId: false,
          rlsEnabled: false,
        };
    }
  }
}
```

### 4.2 PG RLS（行级安全）—— 逻辑隔离的兜底安全网

**PG RLS 的核心价值**：就算应用层代码漏写了 `WHERE tenant_id = xxx`，数据库层面也会把这个查询拦截掉。绝对不会出现「A 租户看到 B 租户订单」的生产事故。

```sql
-- 1. 对业务表启用 RLS
ALTER TABLE commerce.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.orders   ENABLE ROW LEVEL SECURITY;

-- 2. 创建一个策略：每个查询只能看到当前 app.current_tenant_id 匹配的行
CREATE POLICY tenant_isolation_policy ON commerce.products
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON commerce.orders
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. 每次查询前，在同一个 DB 连接里设置当前租户 ID
-- （NestJS Prisma Middleware 统一做，业务代码不用管）
SET app.current_tenant_id = 'tenant-uuid-xxxx';
SELECT * FROM commerce.products WHERE id = '...';  -- 自动只查本租户
```

---

## 5. API Gateway 拦截管道（SaaS 商业模式的心脏）

> 所有请求（不管来自小程序、H5、PC 后台）必须经过这 8 道拦截。这是计费与权限的唯一真相来源。

```
                         所有 HTTP / WebSocket 请求
                                      │
                                      ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ 8 道拦截管道（NestJS Guards & Interceptors，按顺序执行）                │
 ├───────────────────────────────────────────────────────────────────────┤
 │                                                                       │
 │  ① Tenant Resolution     从域名 / Header / Token 解析出 TenantId       │
 │                          例：luxury-xxx.my-saas.com → tenant_id = A    │
 │                                                                       │
 │  ② Authentication        验证用户身份（JWT / Session / API Key）       │
 │                          解析出 actor_id + actor_type（用户/管理员/开放API）│
 │                                                                       │
 │  ③ Subscription Status   查订阅状态：过期？欠费？停服？                │
 │                          过期未超7天 → 放行读 / 拦截写（402）          │
 │                          已停服 → 全部 402，只留续费页                 │
 │                                                                       │
 │  ④ Feature Gate          这个套餐有没有这个功能权限？                 │
 │                          例：基础版调用高级报表接口 → 403              │
 │                                                                       │
 │  ⑤ Quota Enforcement     本月配额超了没？                             │
 │                          例：本月商品数已达 500 上限 → 创建商品 429    │
 │                                                                       │
 │  ⑥ Usage Metering        用量计量 +1（异步写 usage_metrics）          │
 │                          月底结算超额费用                             │
 │                                                                       │
 │  ⑦ RBAC Authorization    这个角色 / 用户，有没有权限调这个接口？       │
 │                          权限点粒度：controller.method → 菜单/按钮级  │
 │                                                                       │
 │  ⑧ Global Rate Limit     全局 / 租户级限流（防刷 / 防攻击）            │
 │                          例：单个租户 1000 QPS，单 IP 100 QPS         │
 │                                                                       │
 └───────────────────────────────────────────────────────────────────────┘
                                      │ 全部通过
                                      ▼
                               转发到业务服务
                                      │
                                      ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ 出站：Audit Log 写审计日志（所有写操作 + 敏感读操作）                  │
 └───────────────────────────────────────────────────────────────────────┘
```

### 关键拦截的性能优化

- 第 ①②③④⑤ 步的结果**全部缓存到 Redis**（Key = `tenant_state:{tenantId}`，TTL 30s）。不要每个请求查 DB。
- 租户状态变更（续费、欠费、升降套餐）时**主动失效缓存**。
- 第 ⑥ 步用量计量用 **Redis INCR + 批量落库**（每 5 分钟批量写一次 DB），不要每次请求写 DB。

---

## 6. 核心数据库设计（8 张主表 + RLS 安全网）

> 分两类表：
> - **平台层表（platform.*）**：SaaS 自身的表（租户、套餐、订阅、用量），所有租户共享。
> - **业务层表（commerce.* / SCHEMA.* / 独立库.*）**：每个租户自己的业务数据。

### 6.1 平台层表（SaaS 自身的「钱袋子」表）

```sql
-- ============================================================
-- 1. tenants：租户表（SaaS 的客户）
-- ============================================================
CREATE TABLE platform.tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL,             -- 店铺名称
  subdomain         VARCHAR(50) UNIQUE NOT NULL,       -- 二级域名（Gateway 识别租户）
  custom_domain     VARCHAR(100) UNIQUE,               -- 自定义域名（专业版+ 功能）
  isolation_level   VARCHAR(20) NOT NULL DEFAULT 'logical',  -- logical / schema / physical
  schema_name       VARCHAR(50) UNIQUE,                -- SCHEMA 模式的专属 Schema 名
  db_connection_enc TEXT,                              -- PHYSICAL 模式的加密连接串
  status            VARCHAR(20) NOT NULL DEFAULT 'active',   -- active / suspended / terminated
  plan_id           UUID REFERENCES platform.plans(id),-- 当前套餐
  subscription_id   UUID,                              -- 当前订阅
  expired_at        TIMESTAMPTZ,                       -- 订阅过期时间（和 subscriptions 同步）
  settings          JSONB NOT NULL DEFAULT '{}',       -- 租户设置：logo/主题色/时区/语言…
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenants_status ON platform.tenants(status);

-- ============================================================
-- 2. plans：套餐表（你卖什么）
-- ============================================================
CREATE TABLE platform.plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50) UNIQUE NOT NULL,  -- free / basic / pro / enterprise
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  price_monthly    DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly     DECIMAL(10,2) NOT NULL DEFAULT 0,
  isolation_level  VARCHAR(20) NOT NULL,         -- 这个套餐默认给什么隔离
  trial_days       INT NOT NULL DEFAULT 0,       -- 免费试用天数
  features         JSONB NOT NULL,               -- 包含的 Feature Key 数组
  quotas           JSONB NOT NULL,               -- 配额：{products:500, staffs:20, storage:10GB, api:100000}
  sort_order       INT NOT NULL DEFAULT 0,
  is_public        BOOLEAN NOT NULL DEFAULT TRUE,-- 是否在购买页展示
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. subscriptions：订阅表（谁买了什么，什么时候到期）
-- ============================================================
CREATE TABLE platform.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES platform.plans(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
                        -- active / canceled / past_due / unpaid / expired
  billing_cycle         VARCHAR(10) NOT NULL DEFAULT 'monthly', -- monthly / yearly
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,   -- 到期日，与 tenants.expired_at 一致
  trial_end             TIMESTAMPTZ,            -- 试用结束时间
  auto_renew            BOOLEAN NOT NULL DEFAULT TRUE,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sub_tenant_period ON platform.subscriptions(tenant_id, current_period_end);

-- ============================================================
-- 4. usage_metrics：用量计量（月底算超额收费）
-- ============================================================
CREATE TABLE platform.usage_metrics (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  metric_key     VARCHAR(50) NOT NULL,   -- api_calls / storage_bytes / sms_count / products
  amount         BIGINT NOT NULL DEFAULT 0,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, metric_key, period_start)
);

-- ============================================================
-- 5. invoices：发票 & 账单（财务审计必备，只增不改）
-- ============================================================
CREATE TABLE platform.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES platform.tenants(id),
  subscription_id  UUID REFERENCES platform.subscriptions(id),
  invoice_no       VARCHAR(32) UNIQUE NOT NULL,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  items            JSONB NOT NULL,     -- 明细：订阅费 + 超额使用费（每行 name/qty/unit/amount）
  subtotal         DECIMAL(12,2) NOT NULL,
  discount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax              DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft / paid / void / refunded
  paid_at          TIMESTAMPTZ,
  pdf_file_id      VARCHAR(100),       -- 对象存储的发票 PDF
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 业务层核心表（每个租户的业务数据）

> 以下结构在 LOGICAL / SCHEMA / PHYSICAL 三种模式下都相同，只是位置不同。

```sql
-- ============================================================
-- 6. products / product_variants：商品 & SKU
-- ============================================================
CREATE TABLE commerce.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,                           -- LOGICAL 模式有值 + RLS
  category_id   UUID REFERENCES commerce.categories(id),
  brand_id      UUID REFERENCES commerce.brands(id),
  code          VARCHAR(50) NOT NULL,           -- 商家编码（对接 ERP 用）
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  attributes    JSONB NOT NULL DEFAULT '{}',    -- 自定义字段（奢品4C/生鲜保质期…）
  seo_slug      VARCHAR(200) UNIQUE,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID,
  updated_by    UUID,
  version       INT NOT NULL DEFAULT 0          -- 乐观锁
);

-- 每个商品下的多规格（颜色/尺寸/克拉…），价格/库存挂在 variant 上
CREATE TABLE commerce.product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  product_id    UUID NOT NULL REFERENCES commerce.products(id) ON DELETE CASCADE,
  sku           VARCHAR(80) NOT NULL,           -- 唯一 SKU 编码（库存流水用）
  specs         JSONB NOT NULL DEFAULT '{}',    -- 规格组合：{"color":"金","size":"50分"}
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  weight_g      DECIMAL(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

-- ============================================================
-- 7. orders / order_items + inventory_transactions：订单 & 库存流水
-- ============================================================
CREATE TABLE commerce.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  order_no        VARCHAR(32) UNIQUE NOT NULL,          -- 展示用订单号
  user_id         UUID NOT NULL,                        -- 下单用户
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payable_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  address_snap    JSONB NOT NULL,                       -- 地址快照（用户改地址不影响历史订单）
  items_snap      JSONB NOT NULL,                       -- 商品快照
  promotion_snap  JSONB NOT NULL DEFAULT '[]',          -- 优惠快照
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,          -- 幂等键（防止重复下单）
  state_trace     JSONB NOT NULL,                       -- 状态机历史轨迹（审计/合规）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- 库存流水表 —— 这是库存余额的唯一真相来源
-- 【绝对禁止】直接 UPDATE inventory SET qty = qty - 1
-- 所有库存变更必须写流水，库存余额是流水的聚合结果
CREATE TABLE commerce.inventory_transactions (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID,
  variant_id      UUID NOT NULL REFERENCES commerce.product_variants(id),
  type            VARCHAR(20) NOT NULL,   -- in / out / adjustment / lock / unlock
  qty_change      INT NOT NULL,           -- 正数 = 入库，负数 = 出库
  reference_type  VARCHAR(30) NOT NULL,   -- order_item / purchase / stock_check / refund
  reference_id    UUID NOT NULL,          -- 关联单据 ID
  reason          VARCHAR(200),
  operator_id     UUID,                   -- 操作人（管理员 / 系统 / API）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inv_variant_time ON commerce.inventory_transactions(variant_id, created_at);

-- ============================================================
-- 8. audit_logs：全局审计日志（大客户审核 / 合规必备）
-- ============================================================
CREATE TABLE shared.audit_logs (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL,
  actor_id       UUID,
  actor_type     VARCHAR(20),              -- admin_user / customer / system / api_client
  action         VARCHAR(50) NOT NULL,     -- create / update / delete / approve / refund / login
  resource_type  VARCHAR(50) NOT NULL,     -- product / order / refund / user_role
  resource_id    UUID NOT NULL,
  diff           JSONB,                    -- before / after 对比
  request_id     VARCHAR(64),
  ip             INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_time ON shared.audit_logs(tenant_id, created_at);
```

---

## 7. 代码分层规范（六边形架构 + 模块化单体）

### 7.1 仓库目录结构

```text
saas-platform/
├── apps/
│   ├── gateway/                # API Gateway 服务（全局入口）
│   │   └── src/pipes/          # 8 道拦截管道
│   └── core/                   # 核心业务模块化单体
│       └── src/
│           ├── billing/        # 计费模块（第 0 个写）
│           │   ├── application/     # Use Case：创建订阅、查账单…
│           │   ├── domain/          # 领域模型：Plan / Subscription / Invoice
│           │   ├── infrastructure/  # Repository 实现 + Stripe Adapter
│           │   └── interfaces/      # REST Controller / Message Handler
│           ├── tenant/         # 租户 / RBAC / 审计
│           ├── commerce/       # 电商核心：product / order / inventory / payment
│           ├── operations/     # 运营：marketing / crm / report / content
│           ├── extension/      # 扩展引擎：webhook / plugin / custom hook
│           └── shared/         # 全平台共享内核
│               ├── domain/         # BaseEntity / DomainEvent / ValueObject
│               ├── infrastructure/ # Prisma Client 封装 / Redis / Multi-tenancy
│               └── ports/          # 跨模块调用接口（防腐层 ACL）
│
├── packages/
│   ├── contracts/             # 全平台共享 DTO / 枚举 / 接口契约（前后端共用）
│   └── ui-kit/                # 通用 UI 组件库（设计系统）
│
├── industry-packages/         # 行业垂直插件包（物理隔离，和核心代码解耦）
│   ├── luxury-resale/         # 奢品二手：4C / GIA 证书 / 特保押运
│   ├── fresh-grocery/         # 生鲜：保质期 / 冷链 / 损耗率
│   └── building-material/     # 建材：规格换算 / 工地配送 / 安装服务
│
├── db/
│   ├── migrations/            # Prisma Migrations / 原生 SQL
│   └── seeds/                 # 初始化数据：套餐表、默认权限表
│
├── docs/
│   └── adr/                   # ADR 架构决策记录（每个选型必须写文档）
│
├── docker-compose.yml         # 本地开发一键起环境
└── turbo.json                 # Turborepo 构建编排
```

### 7.2 分层铁律（Code Review 时强制执行）

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1：Controller / Interface（接口层）                    │
│  只做：参数校验（DTO）→ 调用 Application Service → 返回响应   │
│  禁止：写业务逻辑、写 SQL、跨模块直接调用 Repository          │
└───────────────────────────────┬──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│  Layer 2：Application Service（应用层 / Use Case）            │
│  只做：编排领域对象 + 管理事务边界 + 发布领域事件              │
│  禁止：写具体 SQL、写 if/else 业务规则判断                    │
│  例："创建订单" Use Case =                                     │
│     ① 开启事务 → ② 校验商品库存（调库存域服务）               │
│     → ③ 创建订单实体（调订单工厂）→ ④ 写订单项                │
│     → ⑤ 扣库存（写流水）→ ⑥ 发布 OrderCreatedEvent → 提交事务 │
└───────────────────────────────┬──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│  Layer 3：Domain Service / Entity（领域层）                    │
│  只写：纯业务规则（不依赖任何基础设施）                        │
│  例：订单状态机合法流转判断、价格快照生成、库存流水正确性校验   │
│  禁止：依赖 DB / Redis / 外部 API                              │
└───────────────────────────────┬──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│  Layer 4：Repository / Adapter（基础设施层）                   │
│  只做：DB 读写 / 外部 API 调用 / 缓存 / 文件存储               │
│  禁止：写任何业务规则判断                                      │
└──────────────────────────────────────────────────────────────┘
```

**跨模块调用铁律**：A 模块想调用 B 模块的能力，**只能通过 B 模块在 `shared/ports` 暴露的 Interface**，禁止直接 import B 的 Application Service。

```typescript
// ✅ 正确：通过端口 + 依赖注入
export class OrderApplicationService {
  constructor(
    @Inject('InventoryPort')
    private readonly inventory: InventoryPort,  // InventoryPort 在 shared/ports 定义
  ) {}
  async createOrder(...) {
    await this.inventory.lockStock(...);  // 只依赖接口，不依赖库存模块的具体实现
  }
}

// ❌ 错误：直接 import 别人模块的 Service
import { InventoryService } from '@app/inventory/application/InventoryService';
```

---

## 8. 扩展引擎（定制化需求与平台核心的隔离术）

> 所有 SaaS 都会死在「大客户定制」上：
> 客户 A 要 Webhook → 客户 B 要 ERP 同步 → 客户 C 要企业微信 SSO
> → 代码变成 if tenant_id === A { … } else if B { … } 的屎山

**解法 = 领域事件 + 扩展点注册表 + 租户级插件加载器**

### 8.1 关键领域事件（业务核心节点的钩子点）

业务核心节点**必须发布领域事件**，业务代码不用管谁会订阅：

```typescript
// domain/events.ts —— 全局已定义的扩展钩子
export const DOMAIN_EVENTS = {
  // 订单域
  ORDER_CREATED:       'order.created',     // 订单创建 → 触发：ERP 同步 / Webhook
  ORDER_PAID:          'order.paid',        // 支付成功 → 触发：短信 / 企业微信通知
  ORDER_SHIPPED:       'order.shipped',     // 发货 → 触发：物流同步 / 客户通知
  ORDER_CANCELLED:     'order.cancelled',   // 取消 → 触发：库存回滚 / 退款

  // 商品域
  PRODUCT_CREATED:     'product.created',   // 商品上架 → 触发：同步到抖音店 / 搜索引擎
  PRODUCT_UPDATED:     'product.updated',
  INVENTORY_LOW:       'inventory.low',     // 库存告警 → 触发：推送到采购群

  // 租户域
  TENANT_CREATED:      'tenant.created',    // 新租户注册 → 触发：初始化数据 / 欢迎邮件
  SUBSCRIPTION_RENEWED:'subscription.renewed', // 续费成功 → 触发：发票 / 感谢邮件
} as const;
```

### 8.2 租户级插件加载器

每个租户的定制逻辑 = 一个**独立 npm 包**，和平台核心代码**物理隔离**。

```typescript
// extension/application/TenantPluginLoader.ts
/**
 * 租户级插件加载器
 * 根据租户 ID，从 extension_bindings 表里查出这个租户启用了哪些插件，
 * 按 sort_order 动态加载，依次执行。
 */
@Injectable()
export class TenantPluginLoader {
  /**
   * 获取某个事件在某个租户下的所有扩展处理器
   * 优先级：租户专属定制插件 > 行业包插件 > 平台默认处理
   */
  async getHandlersForEvent<T extends DomainEvent>(
    tenantId: string,
    eventType: string,
  ): Promise<Array<IEventHandler<T>>> {
    // 1. 查 DB：SELECT * FROM extension_bindings
    //         WHERE tenant_id = ? AND event_type = ? ORDER BY sort_order
    const bindings = await this.db.extensionBinding.findMany({
      where: { tenantId, eventType, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 2. 动态加载每个插件对应的 Handler 类
    //    （插件包：@your-saas/plugin-{packageName}，已发布到私有 npm 源）
    const handlers: IEventHandler<T>[] = [];
    for (const binding of bindings) {
      const pkg = await import(`@your-saas/plugin-${binding.packageName}`);
      const HandlerClass = pkg[binding.handlerClass];
      handlers.push(new HandlerClass(binding.config as THandlerConfig));
    }
    return handlers;
  }
}
```

### 8.3 一个租户专属插件的示例

客户是「XX 顶级珠宝」，要求订单支付后同步到他们自建 ERP：

```typescript
// @your-saas/plugin-luxury-xxjewelry/src/handlers/SyncPaidOrderToErp.ts
/**
 * 【租户 XX 珠宝专属】订单支付后同步 ERP
 * 这是定制代码，和平台核心代码物理隔离！
 * 出问题 = 在后台禁用这个绑定即可，不影响全局
 */
@EventHandler(DOMAIN_EVENTS.ORDER_PAID)
export class SyncPaidOrderToErpHandler implements IEventHandler<OrderPaidEvent> {
  constructor(private readonly config: { erpEndpoint: string; apiToken: string }) {}

  async handle(event: OrderPaidEvent): Promise<void> {
    try {
      // 1. 查订单详情
      const order = await this.orderRepo.findById(event.orderId);
      // 2. 组装 ERP 需要的格式
      const payload = this.transformToErpFormat(order);
      // 3. 调 ERP API
      await axios.post(this.config.erpEndpoint, payload, {
        headers: { Authorization: `Bearer ${this.config.apiToken}` },
        timeout: 5000,
      });
    } catch (error) {
      // 4. 失败重试（队列 + 死信），3 次失败告警人工处理
      this.deadLetterQueue.push(event, error);
      this.alertService.alertAdmin('ERP 同步失败', error);
    }
  }
}
```

### 扩展引擎的商业模式

- **通用插件做成付费 App Store**：比如「企业微信 SSO 插件 ¥299/月」「抖音店同步插件 ¥499/月」，租户自行购买安装，躺赚。
- **专属定制按时计费**：帮大客户写专属插件，¥10,000 ~ ¥100,000 一个 + 年服务费 20%。
- **行业包按年收费**：奢品包 ¥2,999/月，生鲜包 ¥999/月。

---

## 9. 计费系统（第 0 个要写的模块，四步闭环）

### 9.1 计费闭环四步走

```
     ┌────────────────────────────────────────────────────────────┐
     │  Step 1：下单 & 订阅创建（用户购买套餐）                      │
     │  Stripe / 本地支付扣款 → 创建 subscriptions → 更新 tenants  │
     │  关键：幂等！同一订单来 100 次回调都只扣一次钱                │
     └───────────────────────────┬────────────────────────────────┘
                                 │
     ┌───────────────────────────▼────────────────────────────────┐
     │  Step 2：运行时拦截（每个请求必经 Gateway）                  │
     │  订阅状态？→ 功能权限？→ 配额超了没？→ 计量 +1              │
     │  拦截结果用 Redis 缓存（30s TTL），变更主动失效              │
     └───────────────────────────┬────────────────────────────────┘
                                 │
     ┌───────────────────────────▼────────────────────────────────┐
     │  Step 3：账期结算（Cron Job，每月 1 号 02:00 跑）            │
     │  1. 遍历所有活跃租户                                        │
     │  2. 算「基础订阅费」+「超额使用费」（查 usage_metrics）       │
     │  3. 应用优惠券 / 折扣                                       │
     │  4. 生成 Invoice PDF → 发送邮件                             │
     │  5. 自动续费扣款 → 失败告警（给运营 + 给客户）                │
     └───────────────────────────┬────────────────────────────────┘
                                 │
     ┌───────────────────────────▼────────────────────────────────┐
     │  Step 4：欠费熔断 & 数据生命周期                             │
     │  +0~7 天：宽限期（拦截写操作，允许读）                        │
     │  +8~30 天：欠费期（全部拦截 402，只留续费/导出数据接口）      │
     │  +30 天以上：归档期（数据冷存储，付费后 24 小时内恢复）        │
     │  +90 天以上：删除期（提前 30 天邮件通知，确认后彻底删除）      │
     └────────────────────────────────────────────────────────────┘
```

### 9.2 计费系统的 4 条铁律

1. **所有金额用 `DECIMAL(12,2)`，不用 float / number**。
2. **所有操作幂等**（用 idempotency_key 唯一索引去重）。
3. **账单只追加、不修改、不删除**。改账 = 开负数 Credit Note 对冲。
4. **核心路径双写**：Stripe / 支付渠道是真相来源，本地 invoices 是本地真相，每次回调对账。不一致告警财务人工介入。

---

## 10. 部署 & DevOps 规范（Day 1 起强制执行）

### 10.1 四套环境严格隔离

| 环境 | 域名 | 部署时机 | 数据 | 配置策略 |
|:---|:---|:---|:---|:---|
| local | `*.saas.localhost` | 开发本地 Docker Compose 一键起 | 种子数据（fixtures） | 本地 .env（不进 git） |
| dev | `*.dev.saas.com` | 每个 PR 自动部署 | 自动同步脱敏快照 | 环境变量注入 |
| staging | `*.staging.saas.com` | main 分支手动触发 | 生产脱敏备份 | 与生产同配置 |
| prod | `*.saas.com` | Tag vX.Y.Z 触发，手动审批 | 真实生产数据 | 严格加密 |

### 10.2 数据库备份与恢复（SaaS 客户的命）

```text
自动备份策略：
├── WAL 增量归档    每 15 分钟一次，存在异地对象存储
├── 全量备份（pg_basebackup）  每天凌晨 03:00 一次，加密存储
├── 备份留存：7 天日备份 + 4 周周备份 + 12 个月月度备份
└── 跨区域复制：备份文件同步到另一个机房（防止单地域事故）

恢复演练：
├── 频率：每月强制一次（最后一个周五下午）
├── 验收标准：RTO < 1 小时（从故障到恢复服务）
└──            RPO < 15 分钟（最多丢 15 分钟数据）
```

### 10.3 CI/CD 流水线（每个 PR 必跑 8 步）

```yaml
# .github/workflows/ci.yml 核心步骤
steps:
  - name: 1. 安装依赖（pnpm 缓存）
  - name: 2. 代码质量：ESLint + Prettier + TSC 类型检查
  - name: 3. 安全扫描：gitleaks 密钥 + npm audit + npm dedupe
  - name: 4. 单元测试（Vitest）—— 覆盖率门槛：shared/billing ≥ 80%
  - name: 5. 集成测试（Testcontainers 起真 PG/Redis）—— 核心 Use Case 全跑
  - name: 6. DB 破坏性变更检查（Prisma migrate diff 检测 DROP COLUMN 等，禁止合入）
  - name: 7. 构建 Docker 镜像 → 推私有 Harbor（带 Git SHA 标签）
  - name: 8. dev 环境自动部署（main 分支）→ 冒烟测试（核心链路 10 条用例）
```

### 10.4 可观测性三件套（Phase 2 之前可以简单点，但必须有）

| 维度 | Phase 1（MVP） | Phase 2+ |
|:---|:---|:---|
| 指标 Metrics | Prometheus + Grafana 基础面板（QPS/延迟/错误率/租户级调用量） | 和 Phase 1 同，加业务大盘（GMV/付费租户/续费率） |
| 日志 Logs | Pino 结构化 JSON 日志 + Loki 查询 | ELK / Datadog，按租户维度索引 |
| 链路 Tracing | 每个请求分配 request_id，全链路透传 | 加 OpenTelemetry + Jaeger，定位慢查询/微服务调用链 |

---

## 11. 落地启动顺序（按周排期）

> 不是先写商品、再写订单。**先把钱袋子和地基搭好，再写业务**。

### Week 1：搭脚手架（Monorepo + 工具链）

```
pnpm create monorepo + Turborepo
  ├── apps/gateway (NestJS)
  ├── apps/core (NestJS 模块化单体)
  ├── packages/contracts (纯 TS DTO/枚举)
  ├── docker-compose.yml：PG + Redis + MinIO 一键起
  ├── 统一工具链：ESLint + Prettier + Vitest + Husky + Commitlint
  └── CI 跑通：type-check + lint + test
```

### Week 2：计费 + 租户 + 拦截管道（能跑通「注册→拦截→熔断」全链路）

```
1. Prisma Schema：platform 层 5 张表（tenants/plans/subscriptions/usage/invoices）
2. 种子数据：插入 4 档套餐（免费/基础/专业/旗舰）
3. TenantContextResolver：三种隔离模式的上下文切换
4. Gateway 前 6 道拦截管道（Tenant→Auth→Sub→Feature→Quota→Metering）
5. Demo 验证：
   - 注册 tenantA（免费版），调用「高级报表接口」→ 返回 403
   - 把 tenantA 升级到专业版 → 能调了
   - 把 tenantA 订阅过期 → 所有请求 402
```

### Week 3 ~ 4：RBAC + 审计日志 + 三种隔离模式跑通

```
1. RBAC：roles / permissions / user_roles，NestJS @Roles() 守卫
2. 审计日志：所有写操作自动出审计（NestJS Interceptor 全局实现）
3. E2E 验证三种隔离模式：
   - LOGICAL + RLS：A/B 两个租户互查不到对方数据（注入越权 SQL 也不行）
   - SCHEMA：A/B 两个租户各自独立 Schema，数据物理不相交
   - PHYSICAL：起第二个 PG 容器，A 连第一个，B 连第二个
```

### Week 5 ~ 8：电商 MVP 闭环（商品 → 订单 → 库存 → 支付）

```
1. 商品模块：分类/品牌/商品/SKU，配套 CRUD + 列表 + 详情
2. 订单模块：状态机 + 幂等键 + 快照，创建/取消/查询
3. 库存模块：库存流水（唯一真相）+ 锁库存/扣库存/回滚
4. 支付模块：微信支付 v3 接入 + 回调验签 + 幂等
5. E2E 跑通：上架商品 → 加购 → 下单 → 支付回调 → 扣库存 → 订单完成
```

### Week 9 ~ 12：扩展引擎 + 行业包骨架

```
1. 领域事件总线：核心节点发布事件（Phase 1 先内存实现）
2. 插件加载器：从 DB 绑定表动态加载 Handler
3. 第一个行业包（luxury-resale）：
   - 商品 attributes 扩展：4C 参数 + GIA 证书字段
   - 订单扩展：特保押运信息
   - 第一个定制插件示例：订单支付同步 ERP Demo
4. 文档 + SDK：开放平台初版
```

---

## 12. 设计的第一性原理（三条根逻辑）

> 做任何架构决策，拿不准就回到这三条问自己。

### 第一性原理 1：SaaS 的本质是「按隔离能力 + 功能权限 + 资源用量」卖钱

所以：
- 选 PostgreSQL 不选 MySQL（三种隔离卖三档价）
- 第 0 个写 Billing 系统（先有收费站再有高速公路）
- API Gateway 做 8 道拦截（每个请求 = 一次收费判断）

### 第一性原理 2：软件最大成本是「变更成本」，不是「开发成本」

所以：
- 六边形 + 接口抽象（换 PG→TiDB 只改 Repository，业务代码 0 改）
- 领域事件 + 扩展引擎（定制代码和核心物理隔离，插件崩了平台不崩）
- 模块化单体 → 微服务渐进（不一步到位，每个阶段独立赚钱）

### 第一性原理 3：多租户底线是「一个租户出事，不影响其他租户」

所以：
- PG RLS + Schema 隔离 + 物理隔离（数据库级三重兜底，应用层漏了也不怕）
- 租户级限流（一个薅羊毛，不拖垮全站）
- 插件物理隔离（一个客户定制 Bug，不影响 999 个客户）
- 分库备份恢复（误删一个租户的数据，单独恢复一个，不影响其他）

---

**文档结束**。如果觉得 OK，可以从第 11 章的 Week 1 直接落地。需要我把 Week 1~2 的代码骨架（Monorepo 结构 + NestJS Gateway + Prisma 多租户抽象 + Billing 核心表）直接在当前项目里生成出来吗？
