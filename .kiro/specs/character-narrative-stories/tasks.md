# 实现计划：角色沉浸式叙事故事生成

## 概述

在现有剧本杀AI生成系统中扩展沉浸式叙事能力。通过类型定义扩展、提示词模板注入、叙事校验逻辑、向后兼容处理和迁移工具更新，实现序幕/每幕/终幕的第二人称（"你"）沉浸式叙事生成。

## 任务

- [x] 1. 扩展类型定义，新增沉浸式叙事字段
  - [x] 1.1 在 `packages/shared/src/types/script.ts` 中扩展 PlayerPrologueContent 和 PlayerFinaleContent 接口
    - 在 `PlayerPrologueContent` 接口中新增 `immersiveNarrative: string` 字段
    - 在 `PlayerFinaleContent` 接口中新增 `immersiveNarrative: string` 字段
    - `PlayerActContent.personalNarrative` 保持字段名不变，仅升级语义（无代码变更）
    - _需求: 7.1, 7.2, 7.3_

  - [ ]* 1.2 编写 immersiveNarrative 字段结构完整性属性测试
    - **Property 4: immersiveNarrative 字段结构完整性**
    - **验证需求: 7.1, 7.3**

  - [ ]* 1.3 编写 PlayableStructure 序列化往返一致性属性测试（含沉浸式叙事字段）
    - **Property 5: PlayableStructure 序列化往返一致性**
    - **验证需求: 7.4**

- [x] 2. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 3. 修改 LLM 提示词模板，注入沉浸式叙事写作规范
  - [x] 3.1 修改 `packages/server/src/services/generator.service.ts` 中的 `buildStorySystemPrompt` 方法
    - 追加沉浸式叙事写作规范（第二人称视角、信息边界、语气匹配、MBTI风格差异、误导信息处理、凶手/嫌疑人视角、300字要求等）
    - 更新 JSON 输出格式模板，在 prologueContent 和 finaleContent 中包含 `immersiveNarrative` 字段
    - _需求: 6.1, 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 2.4, 2.5, 2.6, 3.1, 3.3, 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 修改 `buildSystemPrompt` 方法（oneshot 模式），注入相同的沉浸式叙事写作规范
    - 追加与 `buildStorySystemPrompt` 相同的叙事规范和 JSON 格式更新
    - _需求: 6.1_

  - [x] 3.3 修改 `buildStoryUserPrompt` 方法，注入事件事实摘要指令和叙事字段说明
    - 追加跨角色叙事一致性要求（事件事实摘要指令）
    - 追加沉浸式叙事字段说明（prologueContent.immersiveNarrative、actContents[].personalNarrative、finaleContent.immersiveNarrative）
    - _需求: 5.1, 5.2, 5.3, 6.2, 6.4_

  - [x] 3.4 修改 `buildUserPrompt` 方法（oneshot 模式），注入相同的事件事实摘要指令和叙事字段说明
    - 追加与 `buildStoryUserPrompt` 相同的叙事上下文指令
    - _需求: 6.2, 6.4_

  - [ ]* 3.5 编写系统提示词沉浸式叙事规范完整性属性测试
    - **Property 2: 系统提示词沉浸式叙事规范完整性**
    - **验证需求: 4.1, 6.1**

  - [ ]* 3.6 编写用户提示词叙事上下文完整性属性测试
    - **Property 3: 用户提示词叙事上下文完整性**
    - **验证需求: 2.2, 6.2, 6.4**

  - [ ]* 3.7 编写提示词模板单元测试
    - 验证系统提示词包含沉浸式叙事写作规范的具体文本内容
    - 验证用户提示词包含事件事实摘要指令和叙事字段说明
    - 验证 JSON 输出格式模板包含 immersiveNarrative 字段
    - _需求: 6.1, 6.2_

- [x] 4. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 实现叙事内容校验逻辑
  - [x] 5.1 在 `packages/server/src/services/generator.service.ts` 中新增 `validateNarrativeContent` 方法
    - 校验每个 playerHandbook 的 `actContents[].personalNarrative` 包含"你"且字数 ≥ 300
    - 校验每个 playerHandbook 的 `prologueContent.immersiveNarrative` 如非空则包含"你"
    - 校验每个 playerHandbook 的 `finaleContent.immersiveNarrative` 如非空则包含"你"
    - 校验失败记录警告日志，不阻断流程
    - _需求: 6.3_

  - [x] 5.2 在 `generate` 方法（character_first 模式）中调用 `validateNarrativeContent`
    - 在 `parsePlayableContent` 之后、`storeScript` 之前调用
    - _需求: 6.3_

  - [x] 5.3 在 `generateStory` 方法（oneshot 模式）中调用 `validateNarrativeContent`
    - 在 `parsePlayableContent` 之后调用
    - _需求: 6.3_

  - [ ]* 5.4 编写沉浸式叙事第二人称视角与字数校验属性测试
    - **Property 1: 沉浸式叙事第二人称视角与字数校验**
    - **验证需求: 1.1, 2.1, 3.1, 6.3, 7.2**

  - [ ]* 5.5 编写 validateNarrativeContent 单元测试
    - 测试恰好300字的边界情况
    - 测试空字符串 immersiveNarrative 不触发警告
    - 测试不含"你"的文本触发警告
    - 测试字数不足300的 personalNarrative 触发警告
    - _需求: 6.3_

- [x] 6. 向后兼容处理
  - [x] 6.1 修改 `packages/server/src/services/generator.service.ts` 中的 `deserializeScript` 方法
    - 对旧版数据中缺失 `immersiveNarrative` 字段的 PlayerPrologueContent 和 PlayerFinaleContent 补充默认值空字符串
    - _需求: 7.5_

  - [x] 6.2 修改 `parsePlayableContent` 方法，处理 LLM 输出中缺失的 immersiveNarrative 字段
    - LLM 返回的 JSON 中 prologueContent 或 finaleContent 缺少 immersiveNarrative 时，自动补充为空字符串
    - _需求: 7.5_

  - [ ]* 6.3 编写旧版数据向后兼容默认值属性测试
    - **Property 6: 旧版数据向后兼容默认值**
    - **验证需求: 7.5**

  - [ ]* 6.4 编写向后兼容单元测试
    - 测试旧版 PlayerPrologueContent JSON（无 immersiveNarrative）经 deserializeScript 后字段为空字符串
    - 测试旧版 PlayerFinaleContent JSON（无 immersiveNarrative）经 deserializeScript 后字段为空字符串
    - 测试新版 JSON（含 immersiveNarrative）正常反序列化
    - _需求: 7.5_

- [x] 7. 迁移工具更新
  - [x] 7.1 修改 `packages/server/src/services/migration.service.ts` 中的 `migrateToPlayable` 方法
    - 为迁移生成的 PlayerPrologueContent 设置 `immersiveNarrative: ''`
    - 为迁移生成的 PlayerFinaleContent 设置 `immersiveNarrative: ''`
    - _需求: 7.1, 7.3_

  - [ ]* 7.2 编写迁移工具单元测试
    - 验证 migrateToPlayable 生成的 PlayerPrologueContent 包含 immersiveNarrative 字段且值为空字符串
    - 验证 migrateToPlayable 生成的 PlayerFinaleContent 包含 immersiveNarrative 字段且值为空字符串
    - _需求: 7.1, 7.3_

- [x] 8. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性（Property 1-6），单元测试验证具体示例和边界情况
- 所有属性测试使用 fast-check 库，配合 Vitest 测试框架
