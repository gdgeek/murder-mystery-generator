# Implementation Plan: 会话韧性与错误恢复

## Overview

在现有分阶段创作工作流基础上增强错误恢复能力。按增量方式实现：先扩展数据模型和数据库，再实现服务层新方法（`updateAiConfig`、`retryFailedChapters`、`lastStepTokens` 捕获），然后新增 API 端点，最后更新 UI 层的恢复流程编排。使用 TypeScript，Vitest + fast-check 测试。

## Tasks

- [x] 1. 扩展数据模型与数据库迁移
  - [x] 1.1 在 `packages/shared/src/types/authoring.ts` 的 `AuthoringSession` 接口中新增可选字段 `lastStepTokens?: TokenUsage`（从 `./script` 导入 `TokenUsage`）
    - 复用现有 `TokenUsage` 接口 `{ prompt: number; completion: number; total: number }`
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 创建数据库迁移文件 `packages/server/src/db/migrations/003-session-resilience.sql`，为 `authoring_sessions` 表新增 `last_step_tokens JSON DEFAULT NULL` 列
    - _Requirements: 1.1_
  - [x] 1.3 在 `AuthoringService` 的 `sessionToRow` 和 `rowToSession` 方法中处理 `lastStepTokens` 字段的序列化/反序列化
    - _Requirements: 1.2_

- [x] 2. 实现 lastStepTokens 捕获逻辑
  - [x] 2.1 在 `advancePlanning` 方法中，LLM 调用成功后将 `LLMResponse.tokenUsage` 赋值给 `session.lastStepTokens`
    - _Requirements: 1.1_
  - [x] 2.2 在 `approvePlan`（designing 阶段 LLM 调用）方法中，LLM 调用成功后赋值 `session.lastStepTokens`
    - _Requirements: 1.1_
  - [x] 2.3 在 `generateCurrentChapter` 方法中，LLM 调用成功后赋值 `session.lastStepTokens`
    - _Requirements: 1.1_
  - [x] 2.4 在 `generateParallelBatch` 方法中，汇总所有成功调用的 `tokenUsage` 之和赋值给 `session.lastStepTokens`
    - _Requirements: 1.3_
  - [x] 2.5 确保 LLM 调用失败时不更新 `session.lastStepTokens`（保留上一次成功值）
    - _Requirements: 1.4_
  - [ ]* 2.6 编写 lastStepTokens 赋值正确性属性测试
    - **Property 1: lastStepTokens 赋值正确性**
    - **Validates: Requirements 1.1**
  - [ ]* 2.7 编写并行批量 lastStepTokens 求和属性测试
    - **Property 2: 并行批量 lastStepTokens 为各项之和**
    - **Validates: Requirements 1.3**
  - [ ]* 2.8 编写失败调用不更新 lastStepTokens 属性测试
    - **Property 3: 失败调用不更新 lastStepTokens**
    - **Validates: Requirements 1.4**

- [x] 3. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现 updateAiConfig 服务方法
  - [x] 4.1 在 `packages/server/src/services/authoring/authoring.service.ts` 中定义 `AI_CONFIG_UPDATABLE_STATES` 常量（`failed`、`plan_review`、`design_review`、`chapter_review`、`draft`）
    - _Requirements: 3.1_
  - [x] 4.2 实现 `updateAiConfig(sessionId, ephemeralAiConfig)` 方法：校验会话状态、用新配置创建临时适配器替换旧的、更新 `aiConfigMeta`、保存会话
    - 状态不在允许集合中时抛出错误（供路由层返回 409）
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 4.3 编写 AI 配置更换状态守卫属性测试
    - **Property 4: AI 配置更换状态守卫**
    - **Validates: Requirements 3.1, 3.3**

- [x] 5. 实现 retryFailedChapters 服务方法
  - [x] 5.1 实现 `retryFailedChapters(sessionId)` 方法：校验会话处于 `chapter_review` 且 `parallelBatch.failedIndices` 非空，仅重新生成失败章节，成功后合并到 `chapters` 列表并清除对应 `failedIndices`
    - 重试全部再次失败时，会话转 `failed`，保留之前成功的章节
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 5.2 编写重试保留已有产出物属性测试
    - **Property 5: 重试保留已有产出物**
    - **Validates: Requirements 5.4**
  - [ ]* 5.3 编写失败章节重试后合并正确性属性测试
    - **Property 6: 失败章节重试后合并正确性**
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. 确保检查点保存语义
  - [x] 6.1 审查并确认 `advancePlanning`、`approvePlan`、`generateCurrentChapter`、`generateParallelBatch` 中 LLM 调用成功后先调用 `saveSession` 再进行状态转换
    - 如有不符合的地方进行修正，确保产出物先持久化再转换状态
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.2 确认 `retry` 方法保留所有已保存的阶段产出物（`planOutput`、`outlineOutput`、`chapters`），不清除任何已有数据
    - _Requirements: 5.4, 5.5_
  - [ ]* 6.3 编写检查点保存顺序单元测试（mock `saveSession` 验证调用时机在状态转换之前）
    - **Property 7: 检查点保存顺序**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 7. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 新增 API 端点
  - [x] 8.1 在 `packages/server/src/routes/authoring.ts` 中实现 `PUT /api/authoring-sessions/:id/ai-config` 端点：解析 `ephemeralAiConfig`、调用 `validateEphemeralAiConfig` 校验、调用 `authoringService.updateAiConfig`，状态不允许时返回 409，会话不存在返回 404，校验失败返回 400
    - _Requirements: 3.1, 3.3_
  - [x] 8.2 在 `packages/server/src/routes/authoring.ts` 中实现 `POST /api/authoring-sessions/:id/retry-failed-chapters` 端点：调用 `authoringService.retryFailedChapters`，无 failedIndices 返回 400，会话不在 chapter_review 返回 400
    - _Requirements: 4.3_
  - [ ]* 8.3 编写两个新端点的单元测试（使用 Supertest），覆盖 200/400/404/409 场景
    - _Requirements: 3.1, 3.3, 4.3_

- [x] 9. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 10. UI 层：Session ID 显性化与会话恢复
  - [x] 10.1 在 `packages/server/src/routes/ui/body.html` 和 `packages/server/src/routes/ui/app.js` 中，创建会话后在 session 信息区域显眼展示完整 session ID，附带一键复制按钮
    - _Requirements: 2.1, 6.5_
  - [x] 10.2 在 UI 页面顶部添加"恢复会话"入口：输入框 + 按钮，用户输入 session ID 后调用 `GET /api/authoring-sessions/:id` 加载会话，根据状态自动跳转到对应步骤
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.4_
  - [x] 10.3 在 `packages/server/src/routes/ui/styles.css` 中添加 session ID 展示区域、复制按钮、恢复入口的样式
    - _Requirements: 2.1_

- [x] 11. UI 层：Token 用量展示
  - [x] 11.1 在轮询 `GET /sessions/:id` 的响应处理中，解析并展示 `lastStepTokens`（本次花费）和 `tokenUsage`（累计花费）
    - _Requirements: 1.2, 6.1_

- [x] 12. UI 层：失败恢复流程编排
  - [x] 12.1 当会话进入 `failed` 状态时，显示失败原因、"重试"按钮、"更换 AI 配置并重试"按钮，以及已完成的阶段产出物（可查看）
    - _Requirements: 6.1_
  - [x] 12.2 实现"重试"按钮逻辑：调用 `POST /retry` → `POST /advance`，开始轮询
    - _Requirements: 6.2_
  - [x] 12.3 实现"更换 AI 配置并重试"按钮逻辑：弹出 AI 配置表单 → 校验 → `PUT /ai-config` → `POST /retry` → `POST /advance`，开始轮询
    - _Requirements: 3.5, 6.3_
  - [x] 12.4 当并行批量生成存在失败章节时（`parallelBatch.failedIndices` 非空），在章节审阅界面显示失败章节列表和"重试失败章节"按钮，点击后调用 `POST /retry-failed-chapters`
    - _Requirements: 4.5, 6.6_

- [x] 13. Final checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## Notes

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体的需求编号以确保可追溯性
- 属性测试 P1-P6 使用 fast-check，P7 为单元测试（mock 验证调用顺序）
- 复用现有 `TokenUsage` 类型，不引入新类型
- UI 层任务编排复杂恢复流程（换 key → retry → advance），后端保持原子化
