# 实施任务：临时 AI 配置（Ephemeral AI Config）

## 任务列表

- [x] 1. 共享类型定义
  - [x] 1.1 在 `packages/shared/src/types/ai-config.ts` 中定义 `EphemeralAiConfig`、`AiStatusResult`、`AiVerifyResult`、`AiConfigMeta`、`PROVIDER_DEFAULTS` 类型和常量
  - [x] 1.2 在 `packages/shared/src/types/authoring.ts` 的 `AuthoringSession` 接口中新增可选字段 `aiConfigMeta?: AiConfigMeta`
  - [x] 1.3 在 `packages/shared/src/index.ts` 中导出新增类型

- [x] 2. 临时 AI 配置校验函数
  - [x] 2.1 在 `packages/shared/src/validators/ai-config-validator.ts` 中实现 `validateEphemeralAiConfig(config)` 校验函数，校验 apiKey 非空、endpoint 有效 URL、model 非空
  - [x] 2.2 编写 `validateEphemeralAiConfig` 的单元测试
  - [x] 2.3 (PBT) 编写 Property 1 属性测试：临时 AI 配置校验正确性

- [x] 3. AI 状态检测服务与路由
  - [x] 3.1 在 `packages/server/src/services/ai-status.service.ts` 中实现 `AiStatusService`，包含 `getStatus()` 和 `verify(config)` 方法
  - [x] 3.2 在 `packages/server/src/routes/ai-status.ts` 中实现 `GET /api/ai-status` 和 `POST /api/ai-status/verify` 端点
  - [x] 3.3 在 `packages/server/src/app.ts` 中注册 ai-status 路由
  - [x] 3.4 编写 AI 状态服务和路由的单元测试

- [x] 4. AuthoringService 会话级适配器管理
  - [x] 4.1 在 `AuthoringService` 中新增 `sessionAdapters: Map<string, ILLMAdapter>` 和相关方法：`getAdapterForSession(sessionId)`、`cleanupSessionAdapter(sessionId)`
  - [x] 4.2 修改 `createSession` 方法，接受可选的 `ephemeralAiConfig` 参数，创建临时适配器并缓存
  - [x] 4.3 修改 `advance`、`approvePhase`、`regenerateChapter` 等方法，使用 `getAdapterForSession` 获取适配器
  - [x] 4.4 在会话状态变为 `completed` 或 `failed` 时调用 `cleanupSessionAdapter`
  - [x] 4.5 修改会话序列化逻辑，将 ephemeralAiConfig 的 provider/model 保存为 `aiConfigMeta`，排除 apiKey
  - [x] 4.6 编写 AuthoringService 适配器管理的单元测试
  - [x] 4.7 (PBT) 编写 Property 2 属性测试：apiKey 不出现在序列化输出中
  - [x] 4.8 (PBT) 编写 Property 3 属性测试：适配器选择一致性

- [x] 5. Authoring 路由扩展
  - [x] 5.1 修改 `POST /api/authoring-sessions` 路由，解析请求体中的 `ephemeralAiConfig` 字段并传递给 `AuthoringService.createSession()`
  - [x] 5.2 当服务器未配置 AI 且请求无 `ephemeralAiConfig` 时返回 400 错误
  - [x] 5.3 编写路由扩展的单元测试

- [x] 6. 数据库迁移
  - [x] 6.1 创建 SQL 迁移文件，为 `authoring_sessions` 表新增 `ai_config_meta` JSON 列

- [x] 7. 前端 AI 配置表单
  - [x] 7.1 在 `packages/web/src/components/ai-config-form.ts` 中实现 `AiConfigForm` 组件，包含 provider 下拉、apiKey 密码框、endpoint 和 model 输入
  - [x] 7.2 实现 provider 选择时自动填充默认 endpoint 和 model 的逻辑
  - [x] 7.3 实现表单校验和错误提示显示
  - [x] 7.4 在配置表单页面中集成 `AiConfigForm`：页面加载时调用 `GET /api/ai-status`，根据状态决定是否显
  - [x] 7.5 修改创建会话的前端逻辑，当 AI 未配置时在请求中附加 `ephemeralAiConfig`
  - [x] 7.6 在创建会话前调用 `POST /api/ai-status/verify` 验证配置，验证通过后才继续
  - [x] 7.7 (PBT) 编写 Property 4 属性测试：Provider 默认值完整性
