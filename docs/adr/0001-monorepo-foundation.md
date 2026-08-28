# ADR-0001：Monorepo 基线

- 状态：Accepted
- 日期：2026-08-26

## 决策

使用 pnpm workspace 管理依赖，Turborepo 编排任务；Gateway 与 Core 为独立 NestJS 应用，共享契约放在纯 TypeScript 包 `@saas/contracts` 中。

## 原因

统一 TypeScript 工具链能降低跨端协作成本；应用保持独立启动与部署边界，为增长期拆分 Billing 和 Extension 服务保留路径；共享包不依赖框架，避免领域契约被 NestJS 或数据库实现污染。

## 约束

Gateway 不承载业务逻辑；Core 模块间只通过端口协作；基础设施实现不得进入 contracts。
