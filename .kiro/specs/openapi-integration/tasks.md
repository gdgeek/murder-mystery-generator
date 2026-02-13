# 实现计划：OpenAPI 3.0 集成

## 概述

为 Express 后端集成 OpenAPI 3.0 规范文档和 Swagger UI，通过 JSDoc 注解驱动，覆盖所有 22 个 API 端点。

## 任务

- [x] 1. 安装依赖并创建 Swagger 配置模块
  - 在 `packages/server` 中安装 `swagger-jsdoc`、`swagger-ui-express` 及其类型声明
  - 创建 `packages/server/src/swagger.ts`，定义 OpenAPI 基础信息（title、version、description、servers、tags）和扫描路径
  - 导出 `swaggerSpec` 对象
  - _Requirements: 3.1, 3.3_

- [x] 2. 集成 Swagger UI 到 Express App
  - 修改 `packages/server/src/app.ts`，导入 swagger 模块
  - 注册 `/api-docs` 路径的 Swagger UI 中间件
  - 添加 `/api-docs/json` 端点返回原始 JSON spec
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. 定义共享 Schema 注解
  - 在 `packages/server/src/swagger.ts` 中添加 `@openapi` 注解定义所有 `components/schemas`
  - 包含：ErrorResponse、ScriptConfig、CreateConfigRequest、ScriptStyle、GameType、AgeGroup、SettingType、AuthoringMode、SessionState、PhaseName、ChapterType、EphemeralAiConfig、AiStatusResult、AiVerifyResult、ScriptPlan、ScriptOutline、Chapter、PhaseOutput、AuthoringSession、CreateSessionRequest、ParallelBatch、FailureInfo
  - 枚举 Schema 的 enum 值必须与 TypeScript 枚举完全一致
  - 可选字段不出现在 required 列表中
  - _Requirements: 1.3, 4.1, 4.2, 4.3_

- [x] 4. 为 configs 路由添加 OpenAPI 注解
  - 在 `packages/server/src/routes/configs.ts` 中为 POST /api/configs 和 GET /api/configs/:id 添加 `@openapi` 注解
  - 包含 tags、summary、description（中文）、requestBody、responses（含 400、404、500 错误码）
  - 所有错误响应引用 ErrorResponse Schema
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.3_

- [x] 5. 为 scripts 路由添加 OpenAPI 注解
  - 在 `packages/server/src/routes/scripts.ts` 中为所有 6 个端点添加 `@openapi` 注解
  - 端点：POST /generate、GET /jobs/:jobId、GET /、GET /:id、GET /:id/versions、POST /:id/optimize
  - 包含查询参数定义（configId、status、limit、offset）
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.3_

- [x] 6. 为 tags 路由添加 OpenAPI 注解
  - 在 `packages/server/src/routes/tags.ts` 中为 GET /api/tags、GET /api/tags/popular、POST /api/scripts/:id/tags、DELETE /api/scripts/:id/tags/:tagId 添加 `@openapi` 注解
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.3_

- [x] 7. 为 authoring 路由添加 OpenAPI 注解
  - 在 `packages/server/src/routes/authoring.ts` 中为所有 9 个端点添加 `@openapi` 注解
  - 包含 202 异步响应的说明
  - 包含路径参数（:id、:phase、:chapterIndex）的定义
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.3_

- [x] 8. 为 ai-status 路由和 health 端点添加 OpenAPI 注解
  - 在 `packages/server/src/routes/ai-status.ts` 中为 GET /api/ai-status 和 POST /api/ai-status/verify 添加 `@openapi` 注解
  - 在 `packages/server/src/app.ts` 中为 GET /health 添加 `@openapi` 注解
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.3_

- [x] 9. 检查点 — 验证 Swagger UI 可访问
  - Ensure all tests pass, ask the user if questions arise.
  - 用户可手动启动服务器访问 http://localhost:3000/api-docs 验证 Swagger UI 正常加载

- [x] 10. 编写单元测试和属性测试
  - [x] 10.1 编写单元测试验证 spec 结构和端点覆盖
    - 创建 `packages/server/src/swagger.test.ts`
    - 验证 swaggerSpec 包含 openapi、info、paths 字段
    - 验证所有 22 个预期路径存在于 spec.paths
    - 验证所有预期 Schema 存在于 spec.components.schemas
    - _Requirements: 1.1, 1.3, 3.3_

  - [ ]* 10.2 编写属性测试：路径操作完整性
    - **Property 1: 路径操作完整性**
    - **Validates: Requirements 1.2**

  - [ ]* 10.3 编写属性测试：中文描述一致性
    - **Property 2: 中文描述一致性**
    - **Validates: Requirements 1.4, 5.3**

  - [ ]* 10.4 编写属性测试：JSON 序列化往返一致性
    - **Property 3: JSON 序列化往返一致性**
    - **Validates: Requirements 1.5**

  - [ ]* 10.5 编写属性测试：操作标签分组
    - **Property 4: 操作标签分组**
    - **Validates: Requirements 2.4**

  - [ ]* 10.6 编写属性测试：枚举值一致性
    - **Property 5: 枚举值一致性**
    - **Validates: Requirements 4.2**

  - [ ]* 10.7 编写属性测试：错误响应规范性
    - **Property 6: 错误响应规范性**
    - **Validates: Requirements 5.1, 5.2**

- [x] 11. 最终检查点 — 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP
- 每个任务引用具体需求以确保可追溯性
- 属性测试使用项目已有的 `fast-check` 库
- 检查点确保增量验证
