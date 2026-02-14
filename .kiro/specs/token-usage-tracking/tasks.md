# Implementation Plan: Token 用量追踪

## Overview

在现有创作工作流中增加 Token 用量追踪。修改 shared 类型、authoring service 累加逻辑、数据库持久化、以及测试 UI 展示。采用增量方式：先定义类型，再修改服务层，最后更新 UI。

## Tasks

- [ ] 1. 定义 CumulativeTokenUsage 类型并扩展 AuthoringSession
  - [ ] 1.1 在 `packages/shared/src/types/authoring.ts` 中新增 `CumulativeTokenUsage` 接口（promptTokens, completionTokens, totalTokens, callCount），并在 `AuthoringSession` 接口中新增可选字段 `tokenUsage?: CumulativeTokenUsage`
    - 确保从 shared 包正确导出新类型
    - _Requirements: 1.4, 2.1_

- [ ] 2. 实现 Token 用量累加逻辑
  - [ ] 2.1 在 `packages/server/src/services/authoring/authoring.service.ts` 中新增 `accumulateTokenUsage(session, usage)` 私有方法，实现累加逻辑
    - 处理 session.tokenUsage 未初始化的情况（首次调用时初始化为零值）
    - _Requirements: 1.1, 1.2, 1.4_
  - [ ] 2.2 在 `advancePlanning` 方法中，LLM 调用成功后调用 `accumulateTokenUsage`
    - _Requirements: 1.1_
  - [ ] 2.3 在 `approvePlan`（designing 阶段）方法中，LLM 调用成功后调用 `accumulateTokenUsage`
    - _Requirements: 1.1_
  - [ ] 2.4 在 `generateCurrentChapter` 方法中，LLM 调用成功后调用 `accumulateTokenUsage`
    - _Requirements: 1.1_
  - [ ] 2.5 在 `generateParallelBatch` 方法中，`Promise.allSettled` 结果处理时，对每个成功的结果累加 Token 用量
    - 需要在并行 Promise 中捕获每次调用的 tokenUsage，然后在结果收集阶段统一累加
    - _Requirements: 1.1, 1.3_
  - [ ]* 2.6 编写 `accumulateTokenUsage` 的属性测试
    - **Property 1: 累加正确性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 4.1, 4.2, 4.3**
  - [ ]* 2.7 编写 totalTokens 不变量的属性测试
    - **Property 2: totalTokens 不变量**
    - **Validates: Requirements 4.4**
  - [ ]* 2.8 编写失败调用不影响累计的属性测试
    - **Property 3: 失败调用不影响累计**
    - **Validates: Requirements 4.5**

- [ ] 3. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. 数据库持久化支持
  - [ ] 4.1 更新 `saveSession` 和 `insertSession` 方法，确保 `tokenUsage` 字段被正确序列化到数据库
    - 检查现有的序列化逻辑，如果 session 以 JSON 列存储则无需额外修改；如果使用独立列则需新增 `token_usage` 列
    - _Requirements: 2.3_
  - [ ] 4.2 更新 `rowToSession` 方法，确保从数据库读取时正确反序列化 `tokenUsage` 字段
    - 处理旧数据中不存在该字段的情况（返回 undefined）
    - _Requirements: 2.3_
  - [ ]* 4.3 编写持久化往返一致性的属性测试
    - **Property 4: 持久化往返一致性**
    - **Validates: Requirements 2.3**

- [ ] 5. 创建会话时初始化 tokenUsage
  - [ ] 5.1 在 `createSession` 方法中，初始化 `tokenUsage` 为 `{ promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 }`
    - _Requirements: 1.4_

- [ ] 6. UI 展示 Token 用量
  - [ ] 6.1 在 `packages/server/src/routes/ui.ts` 的 HTML 中新增 Token 用量展示区域
    - 在步骤条下方或导航栏中添加统计面板，使用与现有 UI 一致的玻璃拟态风格
    - 包含 prompt tokens、completion tokens、total tokens、调用次数四个数值
    - _Requirements: 3.1, 3.3, 3.4_
  - [ ] 6.2 在 UI 的 JavaScript 轮询回调 `hu(s)` 中，读取 `s.tokenUsage` 并更新 DOM 元素
    - 会话活跃时显示面板，draft 状态时隐藏
    - _Requirements: 3.1, 3.2_

- [ ] 7. Final checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 属性测试使用 fast-check 库配合 Vitest
- UI 修改仅涉及内嵌测试 UI（`ui.ts`），不影响前端 web 包
- 数据库修改取决于现有 session 存储方式（JSON 列 vs 独立列）
