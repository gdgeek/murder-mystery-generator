# 实现计划：可游玩结构（Playable Structure）

## 概述

将剧本杀AI生成系统的输出重组为以"幕"为核心的线性可游玩结构。实现采用增量式扩展，在现有类型上新增可选字段，修改提示词模板和生成逻辑，并提供迁移工具。

## 任务

- [x] 1. 定义可游玩结构类型
  - [x] 1.1 在 `packages/shared/src/types/script.ts` 中新增所有幕结构相关类型定义
    - 新增 ActDiscussion, ActVote, ActVoteOption, Prologue, CharacterIntro, Act, Finale, FinaleEnding 接口
    - 新增 ActGuide, ClueDistributionInstruction, PrologueGuide, FinaleGuide 接口
    - 新增 PlayerActContent, PlayerPrologueContent, PlayerFinaleContent 接口
    - 新增 PlayableDMHandbook, PlayablePlayerHandbook, PlayableStructure 接口
    - 在 Script 接口中新增可选字段 `playableStructure?: PlayableStructure`
    - 在 `packages/shared/src/types/index.ts` 中导出所有新类型
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.2 编写 PlayableStructure 序列化往返属性测试
    - **Property 9: PlayableStructure 序列化往返一致性**
    - **验证需求: 7.5**

  - [ ]* 1.3 编写幕结构完整性不变量属性测试
    - **Property 1: 幕结构完整性不变量**
    - **验证需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 7.3**

- [x] 2. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 3. 实现幕结构校验逻辑
  - [x] 3.1 在 `packages/server/src/services/generator.service.ts` 中新增 `validatePlayableStructure` 方法
    - 校验幕数量一致性（acts.length === actGuides.length === 每个 playerHandbook.actContents.length）
    - 校验线索双向一致性（所有幕 clueIds 在 materials 中存在，所有线索卡在某幕被引用）
    - 校验线索分发指令与幕线索一致性
    - 校验幕数量与 config.roundStructure.totalRounds 匹配
    - _需求: 5.1, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 3.2 编写幕数量一致性属性测试
    - **Property 2: 幕数量一致性**
    - **验证需求: 7.4**

  - [ ]* 3.3 编写幕数量与配置轮次匹配属性测试
    - **Property 3: 幕数量与配置轮次匹配**
    - **验证需求: 5.1, 5.3**

  - [ ]* 3.4 编写线索双向一致性属性测试
    - **Property 4: 线索双向一致性**
    - **验证需求: 7.1, 7.2**

  - [ ]* 3.5 编写线索分发指令一致性属性测试
    - **Property 5: 线索分发指令与幕线索一致性**
    - **验证需求: 2.4**

- [x] 4. 修改 LLM 提示词模板
  - [x] 4.1 修改 `buildSystemPrompt` 方法，更新 JSON 输出格式定义以包含幕结构
    - 在系统提示词中定义 prologue、acts 数组、finale 的 JSON schema
    - 包含 DM 幕指引和玩家幕内容的格式定义
    - _需求: 4.1_

  - [x] 4.2 修改 `buildUserPrompt` 方法，添加幕结构生成指令
    - 指示 LLM 按幕生成故事叙述、搜证目标、交流建议、投票环节
    - 指示 LLM 确保幕间故事连贯性和递进性
    - 指示中间幕数量等于 config.roundStructure.totalRounds
    - _需求: 4.2, 4.3, 5.1_

  - [ ]* 4.3 编写提示词模板单元测试
    - 验证系统提示词包含 prologue/acts/finale JSON 格式
    - 验证用户提示词包含幕结构生成指令和轮次数
    - _需求: 4.1, 4.2_

- [x] 5. 实现幕结构解析与生成集成
  - [x] 5.1 新增 `parsePlayableContent` 方法解析 LLM 返回的幕结构 JSON
    - 验证返回 JSON 包含 prologue、acts、finale
    - 缺少必要字段时抛出描述性错误
    - _需求: 4.4_

  - [x] 5.2 修改 `generate` 方法，集成幕结构生成流程
    - 使用新提示词模板调用 LLM
    - 解析返回内容构建 PlayableStructure
    - 调用 validatePlayableStructure 校验
    - 将 PlayableStructure 挂载到 Script.playableStructure
    - 同时保留旧结构字段的填充（向后兼容）
    - _需求: 1.1, 2.1, 3.1, 4.4, 5.1_

  - [ ]* 5.3 编写幕结构解析校验属性测试
    - **Property 8: 幕结构解析校验**
    - **验证需求: 4.4**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. 实现迁移工具
  - [x] 7.1 创建 `packages/server/src/services/migration.service.ts`
    - 实现 `migrateToPlayable(script: Script): PlayableStructure` 方法
    - 实现 `hasPlayableStructure(script: Script): boolean` 方法
    - 按设计文档中的映射规则将旧版字段转换为幕结构
    - 确保不修改原始 Script 数据（深拷贝或只读访问）
    - _需求: 6.3, 6.4_

  - [ ]* 7.2 编写迁移映射正确性属性测试
    - **Property 6: 迁移映射正确性**
    - **验证需求: 6.3**

  - [ ]* 7.3 编写迁移非破坏性属性测试
    - **Property 7: 迁移非破坏性**
    - **验证需求: 6.4**

- [x] 8. 向后兼容处理
  - [x] 8.1 修改 `deserializeScript` 方法，兼容无 playableStructure 字段的旧版 JSON
    - 旧版 JSON 反序列化时 playableStructure 为 undefined
    - 新版 JSON 反序列化时正确解析 playableStructure
    - _需求: 6.1, 6.2_

  - [ ]* 8.2 编写向后兼容单元测试
    - 测试旧版 Script JSON（无 playableStructure）正常反序列化
    - 测试新版 Script JSON（含 playableStructure）正常反序列化
    - _需求: 6.1, 6.2_

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
