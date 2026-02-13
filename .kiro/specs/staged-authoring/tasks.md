# Implementation Plan: Staged Authoring

## Overview

基于设计文档，将分阶段创作工作流拆分为增量式编码任务。每个任务在前一个任务基础上构建，最终将所有组件连接到 REST API。使用 TypeScript 实现，Vitest + fast-check 测试。

## Tasks

- [x] 1. 定义共享类型和数据库迁移
  - [x] 1.1 在 `packages/shared/src/types/authoring.ts` 中定义所有新增类型（AuthoringMode、SessionState、PhaseName、ChapterType、ScriptPlan、ScriptOutline、Chapter、AuthorEdit、PhaseOutput、SessionFilters、FailureInfo、AuthoringSession）并从 `packages/shared/src/types/index.ts` 导出
    - _Requirements: 1.1, 1.6, 2.1, 3.2, 4.2, 7.1, 7.4, 7.5_
  - [x] 1.2 创建数据库迁移文件 `packages/server/src/db/migrations/002-authoring-sessions.sql`，包含 authoring_sessions 表和索引
    - _Requirements: 1.4_
  - [ ]* 1.3 编写 AuthoringSession、PhaseOutput、AuthorEdit 的 JSON 往返属性测试
    - **Property 1: 创作数据往返一致性**
    - **Validates: Requirements 1.2, 1.4, 1.6, 7.4, 7.5**

- [x] 2. 实现状态机
  - [x] 2.1 在 `packages/server/src/services/authoring/state-machine.ts` 中实现 `SessionStateMachine`，包含 STAGED_TRANSITIONS 和 VIBE_TRANSITIONS 转换表以及 `transition` 函数
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.2 编写状态机转换正确性属性测试
    - **Property 2: 状态机转换正确性**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  - [ ]* 2.3 编写失败与重试状态恢复属性测试
    - **Property 3: 失败与重试状态恢复**
    - **Validates: Requirements 2.5, 2.6**

- [x] 3. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现提示词构建器和阶段解析器
  - [x] 4.1 在 `packages/server/src/services/authoring/prompt-builder.ts` 中实现 `PromptBuilder`，包含 `buildPlanningPrompt`、`buildDesignPrompt`、`buildChapterPrompt` 方法
    - _Requirements: 3.1, 4.1, 4.6, 5.1, 5.7_
  - [x] 4.2 在 `packages/server/src/services/authoring/phase-parser.ts` 中实现 `PhaseParser`，包含 `parsePlan`、`parseOutline`、`parseChapter` 方法
    - _Requirements: 3.2, 4.2_
  - [ ]* 4.3 编写 Script_Plan 结构完整性属性测试
    - **Property 4: Script_Plan 结构完整性**
    - **Validates: Requirements 3.2**
  - [ ]* 4.4 编写 Script_Outline 结构完整性属性测试
    - **Property 5: Script_Outline 结构完整性**
    - **Validates: Requirements 4.2**
  - [ ]* 4.5 编写作者备注传播到提示词属性测试
    - **Property 6: 作者备注传播到提示词**
    - **Validates: Requirements 4.6**
  - [ ]* 4.6 编写章节数量与排序属性测试
    - **Property 8: 章节数量与排序**
    - **Validates: Requirements 5.1**
  - [ ]* 4.7 编写章节提示词包含前序内容属性测试
    - **Property 12: 章节提示词包含前序内容**
    - **Validates: Requirements 5.7**

- [x] 5. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 实现 AuthoringService 核心逻辑
  - [x] 6.1 在 `packages/server/src/services/authoring/authoring.service.ts` 中实现 `AuthoringService`，包含 `createSession`、`getSession`、`listSessions` 方法和会话的数据库存取逻辑
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 6.2 实现 `advance` 方法：根据当前状态和模式触发对应阶段的 LLM 生成（planning/designing/executing/generating），集成 StateMachine、PromptBuilder、PhaseParser
    - _Requirements: 2.2, 2.3, 3.1, 3.3, 4.1, 4.3, 5.1, 5.2, 6.1, 6.2_
  - [x] 6.3 实现 `editPhase` 和 `approvePhase` 方法：保存编辑记录、批准阶段并触发下一阶段
    - _Requirements: 3.4, 3.5, 3.6, 4.4, 4.5, 4.6, 5.3, 5.5_
  - [x] 6.4 实现 `regenerateChapter` 方法：重新生成指定章节并保留历史
    - _Requirements: 5.4_
  - [x] 6.5 实现 `retry` 方法：从 failed 状态恢复到失败前的阶段
    - _Requirements: 2.5, 2.6_
  - [x] 6.6 实现 `assembleScript` 方法：将所有已批准章节组装为完整 Script 对象并存储
    - _Requirements: 5.6, 6.3, 6.4_
  - [ ]* 6.7 编写编辑记录保留双版本属性测试
    - **Property 7: 编辑记录保留双版本**
    - **Validates: Requirements 3.4, 4.4, 5.5, 7.2**
  - [ ]* 6.8 编写章节进度状态逻辑属性测试
    - **Property 9: 章节进度状态逻辑**
    - **Validates: Requirements 5.3**
  - [ ]* 6.9 编写章节重新生成保留历史属性测试
    - **Property 10: 章节重新生成保留历史**
    - **Validates: Requirements 5.4**
  - [ ]* 6.10 编写章节组装为完整 Script 属性测试
    - **Property 11: 章节组装为完整 Script**
    - **Validates: Requirements 5.6**
  - [ ]* 6.11 编写模式无关的 Script 输出格式属性测试
    - **Property 13: 模式无关的 Script 输出格式**
    - **Validates: Requirements 6.4**
  - [ ]* 6.12 编写会话列表筛选正确性属性测试
    - **Property 14: 会话列表筛选正确性**
    - **Validates: Requirements 1.3**
  - [ ]* 6.13 编写状态变更时间戳更新属性测试
    - **Property 15: 状态变更时间戳更新**
    - **Validates: Requirements 1.5**

- [x] 7. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 实现 REST API 路由并集成
  - [x] 8.1 在 `packages/server/src/routes/authoring.ts` 中实现所有 REST API 端点：POST /api/authoring-sessions、GET /api/authoring-sessions/:id、POST /api/authoring-sessions/:id/advance、PUT /api/authoring-sessions/:id/phases/:phase/edit、POST /api/authoring-sessions/:id/phases/:phase/approve、POST /api/authoring-sessions/:id/chapters/:chapterIndex/regenerate，包含参数校验和错误处理
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 8.2 在 `packages/server/src/app.ts` 中注册新路由 `/api/authoring-sessions`
    - _Requirements: 8.1_
  - [x] 8.3 导出 `packages/server/src/services/authoring/index.ts` 桶文件，统一导出 AuthoringService、SessionStateMachine、PromptBuilder、PhaseParser
    - _Requirements: 1.1_
  - [ ]* 8.4 编写 API 端点的单元测试（使用 Supertest），覆盖正常流程、400 参数错误、404 资源不存在
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 9. Final checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## Notes

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体的需求编号以确保可追溯性
- 属性测试验证设计文档中定义的通用正确性属性
- 单元测试验证具体示例和边界情况
- Checkpoint 确保增量验证
