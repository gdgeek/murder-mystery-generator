# Implementation Plan: 角色优先两阶段生成 (Character-First Generation)

## Overview

将现有一次性剧本生成流程扩展为两阶段生成：第一阶段生成角色设定（CharacterProfile），第二阶段基于确认的角色设定生成完整故事。CharacterProfile 包含 gender（性别）、bloodType（血型）、mbtiType（MBTI类型）等新增字段，生成时确保角色性格与 MBTI/血型保持一致性。实现路径为：类型定义 → 数据层（Redis/MySQL）→ 核心服务方法 → 提示词构建 → REST API → 反馈优化 → 集成联调。

## Tasks

- [x] 1. 新增类型定义与数据模型
  - [x] 1.1 在 `packages/shared/src/types/script.ts` 中新增角色设定相关类型
    - 新增 `GenerationMode`、`RelationshipType`、`NarrativeRole`、`CharacterType`、`BloodType` 类型
    - 新增 `CharacterProfileRelationship`、`CharacterProfile` 接口（含 gender、bloodType、mbtiType 字段）
    - 新增 `CharacterDraftStatus`、`CharacterDraft` 接口
    - 导出所有新增类型
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 扩展 `GenerateJob` 接口，新增两阶段生成状态
    - 在 `packages/server/src/services/generator.service.ts` 中扩展 `GenerateJob` 的 `status` 联合类型，新增 `generating_characters`、`characters_ready`、`generating_story`
    - 新增 `generationMode`、`currentPhase`、`errorPhase` 字段
    - 确保默认 `generationMode` 为 `'oneshot'`，现有代码不受影响
    - _Requirements: 5.1, 7.1, 7.2_

  - [ ]* 1.3 编写 Property 3 属性测试：CharacterProfile JSON 往返一致性
    - **Property 3: CharacterProfile JSON 往返一致性**
    - 使用 fast-check 生成任意有效 CharacterProfile（含 characterType、gender、bloodType、mbtiType、appearance 字段），验证 `JSON.parse(JSON.stringify(profile))` 深度等于原始对象
    - **Validates: Requirements 1.5**

- [x] 2. MySQL 数据库迁移与角色持久化
  - [x] 2.1 创建 `characters` 表迁移文件
    - 在 `packages/server/src/db/migrations/` 下新增迁移文件
    - 包含 id、name、character_type、gender、birthday、blood_type（ENUM: A/B/O/AB）、mbti_type（VARCHAR(4)）、personality、abilities、appearance、tags、created_at、updated_at 字段
    - 创建 idx_characters_name 和 idx_characters_type 索引
    - _Requirements: 8.1_

  - [x] 2.2 创建 `script_character_sets` 表迁移文件
    - 包含 id、character_id、script_id、character_type、motivation、experience_summary、narrative_role、secrets、created_at 字段
    - 创建外键约束和 idx_scs_character、idx_scs_script、idx_scs_char_script 索引
    - _Requirements: 8.2_

- [x] 3. Checkpoint - 确保类型定义和数据库迁移正确
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 实现 CharacterDraft Redis 存储与角色校验逻辑
  - [x] 4.1 在 `GeneratorService` 中实现 CharacterDraft Redis 存储方法
    - 实现 `storeCharacterDraft(jobId, configId, characters)` — 存储到 `character_draft:{jobId}`，TTL 24h
    - 实现 `getCharacterDraft(jobId)` — 从 Redis 读取 CharacterDraft
    - 实现 `updateCharacterProfile(jobId, characterId, updates)` — 更新单个角色并重新校验关系一致性
    - 实现 `confirmCharacters(jobId)` — 将 CharacterDraft 状态更新为 confirmed
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 实现角色设定校验方法
    - 实现 `validateCharacterProfiles(profiles, config)` — 校验 player 角色数量等于 playerCount，NPC 不计入；校验 bloodType 为 A/B/O/AB 之一；校验 mbtiType 为16种有效MBTI类型之一；校验 gender 非空
    - 实现 `validateRelationshipConsistency(characters)` — 校验 targetCharacterId 指向集合中存在的其他角色
    - 校验关系多样性：至少一条对立关系（rival/enemy）和一条合作关系（ally/colleague/family）
    - _Requirements: 1.4, 2.4, 2.5, 2.6, 3.6_

  - [ ]* 4.3 编写 Property 1 属性测试：CharacterProfile 结构校验
    - **Property 1: CharacterProfile 结构校验**
    - 使用 fast-check 生成任意有效 CharacterProfile，验证所有必填字段非空、gender 非空、bloodType 为有效枚举值、mbtiType 为有效MBTI类型、secrets 长度 ≥ 1、relationships 每条包含必要字段
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 4.4 编写 Property 2 属性测试：角色间关系引用一致性
    - **Property 2: 角色间关系引用一致性**
    - 使用 fast-check 生成一致性角色集合，验证 `validateRelationshipConsistency` 对合法集合返回空错误列表；对包含无效引用的集合返回非空错误列表
    - **Validates: Requirements 1.4, 3.3, 3.6**

  - [ ]* 4.5 编写 Property 4 属性测试：玩家角色数量与配置一致
    - **Property 4: 玩家角色数量与配置一致**
    - 使用 fast-check 生成任意 playerCount (1-10)，验证通过 `validateCharacterProfiles` 的角色列表中 player 数量等于 playerCount，npc 数量不受约束
    - **Validates: Requirements 2.4**

  - [ ]* 4.6 编写 Property 5 属性测试：角色关系多样性
    - **Property 5: 角色关系多样性**
    - 使用 fast-check 生成通过校验的角色集合，验证至少存在一条对立关系和一条合作关系
    - **Validates: Requirements 2.5**

  - [ ]* 4.7 编写 Property 15 属性测试：角色性格与MBTI/血型一致性
    - **Property 15: 角色性格与MBTI/血型一致性**
    - 使用 fast-check 生成任意 CharacterProfile，验证 mbtiType 为16种有效MBTI类型之一、bloodType 为 A/B/O/AB 之一；验证 buildCharacterSystemPrompt 输出包含性格-MBTI-血型一致性指令
    - **Validates: Requirements 2.6**

- [x] 5. 实现第一阶段：角色生成提示词与解析
  - [x] 5.1 实现角色生成提示词构建方法
    - 实现 `buildCharacterSystemPrompt(config)` — 包含角色设计师角色定义、输出格式要求、外貌描述要求、gender/bloodType/mbtiType 生成要求、性格与MBTI/血型一致性指令
    - 实现 `buildCharacterUserPrompt(config, skills)` — 注入 playerCount、gameType、ageGroup、era、location、theme，以及 CHARACTER_DESIGN/MOTIVE 类别 Skill 模板
    - 当 gameType 为 shin_honkaku 且有 specialSetting 时，注入特殊设定信息
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.8_

  - [x] 5.2 实现角色设定解析方法
    - 实现 `parseCharacterProfiles(content)` — 从 LLM 响应中解析 CharacterProfile[] JSON，确保 gender、bloodType、mbtiType 字段正确解析
    - 复用现有 `parseGeneratedContent` 的 JSON 提取策略（markdown code fence、outermost braces）
    - _Requirements: 2.1_

  - [ ]* 5.3 编写 Property 6 属性测试：第一阶段提示词完整性
    - **Property 6: 第一阶段提示词完整性**
    - 使用 fast-check 生成任意有效 ScriptConfig 和 Skill 模板列表，验证 `buildCharacterUserPrompt` 输出包含 playerCount、gameType、ageGroup、era、location、theme 信息，且包含 appearance 生成指令和 gender/bloodType/mbtiType 生成要求；当 shin_honkaku + specialSetting 时包含 settingDescription 和 settingConstraints
    - **Validates: Requirements 2.2, 2.6, 2.7, 2.8**

- [x] 6. 实现第二阶段：故事生成提示词与一致性校验
  - [x] 6.1 实现故事生成提示词构建方法
    - 实现 `buildStorySystemPrompt(config, characters)` — 注入完整角色设定 JSON（含 gender、bloodType、mbtiType），要求不引入未定义角色，仅为 player 角色生成玩家手册，角色行为与MBTI类型一致
    - 实现 `buildStoryUserPrompt(config, characters, skills, feedback?)` — 注入角色设定、配置参数、全部 Skill 模板、可选反馈数据
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 实现故事-角色一致性校验方法
    - 实现 `validateCharacterConsistency(script, characters)` — 校验 PlayerHandbook 仅为 player 角色生成、角色名/背景一致、timeline involvedCharacterIds 指向有效角色
    - 轻微不一致记录警告，严重不一致（引用不存在角色）抛出异常
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 6.3 编写 Property 7 属性测试：第二阶段提示词完整性
    - **Property 7: 第二阶段提示词完整性**
    - 使用 fast-check 生成任意有效 ScriptConfig、CharacterProfile 列表和 Skill 模板列表，验证 `buildStoryUserPrompt` 输出包含每个角色的 characterName、characterType、gender、bloodType、mbtiType、personality、appearance、backgroundStory、primaryMotivation 以及所有配置参数
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.4 编写 Property 8 属性测试：故事-角色一致性
    - **Property 8: 故事-角色一致性**
    - 使用 fast-check 生成一致的 Script + CharacterProfile 集合，验证 `validateCharacterConsistency` 通过；生成不一致数据时验证抛出异常。验证 PlayerHandbook 仅为 player 角色生成，timeline 中 involvedCharacterIds 指向有效角色
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 7. Checkpoint - 确保提示词构建和校验逻辑正确
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 实现两阶段生成任务编排（状态机）
  - [x] 8.1 实现两阶段生成入口和后台执行器
    - 实现 `startCharacterFirstGenerate(config)` — 创建 GenerateJob（generationMode: character_first, status: pending），启动后台 `runCharacterGenerate`
    - 实现 `runCharacterGenerate(jobId, config)` — 状态流转 pending → generating_characters → characters_ready，调用 generateCharacters、storeCharacterDraft
    - 实现 `generateCharacters(config)` — 获取 CHARACTER_DESIGN/MOTIVE Skill 模板，构建提示词，调用 LLM，解析并校验角色设定（含 gender、bloodType、mbtiType 校验）
    - _Requirements: 2.1, 5.1, 5.2_

  - [x] 8.2 实现第二阶段触发和后台执行器
    - 实现 `startStoryGenerate(jobId)` — 校验 CharacterDraft 为 confirmed，更新 GenerateJob 状态为 generating_story
    - 实现 `runStoryGenerate(jobId)` — 读取 CharacterDraft 和 Config，获取全部 Skill 模板，调用 LLM 生成故事，校验一致性，存储 Script，更新状态为 completed
    - 实现 `generateStory(config, characters, feedback?)` — 构建故事提示词，调用 LLM，解析并校验
    - _Requirements: 4.1, 4.2, 4.3, 5.3_

  - [x] 8.3 实现阶段化错误处理
    - 第一阶段失败时设置 `errorPhase: 'character'`，第二阶段失败时设置 `errorPhase: 'story'`
    - 第二阶段失败时保持 CharacterDraft confirmed 状态不变
    - 错误信息包含 LLM 错误详情
    - _Requirements: 2.9, 4.7, 5.5_

  - [ ]* 8.4 编写 Property 10 属性测试：状态机合法转换
    - **Property 10: 状态机合法转换**
    - 使用 fast-check 生成任意状态转换序列，验证 character_first 模式下 GenerateJob 状态必须严格遵循 pending → generating_characters → characters_ready → generating_story → completed；CharacterDraft 状态遵循 pending_review → confirmed，不允许回退
    - **Validates: Requirements 5.1, 5.2, 5.3, 3.1, 3.4**

  - [ ]* 8.5 编写 Property 9 属性测试：阶段化错误信息
    - **Property 9: 阶段化错误信息**
    - 使用 fast-check 生成任意阶段标识（character/story），验证失败时 errorPhase 正确、status 为 failed；第二阶段失败时 CharacterDraft 保持 confirmed
    - **Validates: Requirements 2.9, 4.7, 5.5**

  - [ ]* 8.6 编写 Property 11 属性测试：任务查询包含角色数据
    - **Property 11: 任务查询包含角色数据**
    - 验证处于 characters_ready 或之后状态的 GenerateJob 返回 currentPhase 标识，且能通过 getCharacterDraft 获取角色数据
    - **Validates: Requirements 5.4**

- [x] 9. 实现 REST API 端点
  - [x] 9.1 新增角色生成 API 路由
    - 在 `packages/server/src/routes/scripts.ts` 中新增以下端点：
    - `POST /api/scripts/generate-characters` — 启动角色优先生成，传入 configId，返回 jobId
    - `GET /api/jobs/:jobId/characters` — 获取角色草稿（返回含 gender、bloodType、mbtiType 的完整 CharacterProfile）
    - `PUT /api/jobs/:jobId/characters/:characterId` — 更新单个角色设定（支持更新 gender、bloodType、mbtiType 等字段），返回更新后的角色列表和可能的 validationErrors
    - `POST /api/jobs/:jobId/confirm-characters` — 确认角色设定，触发第二阶段
    - `POST /api/jobs/:jobId/skip-review` — 跳过审查，自动确认并进入第二阶段
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.3_

  - [x] 9.2 扩展现有 generate 端点支持 generationMode 参数
    - 在 `POST /api/scripts/generate` 中支持可选 `generationMode` 参数，默认 `'oneshot'`
    - 当 `generationMode === 'character_first'` 时转发到 `startCharacterFirstGenerate`
    - 确保现有调用方无需修改
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.3 实现请求校验和错误响应
    - 校验 configId 存在性、jobId 有效性、characterId 有效性
    - CharacterDraft 过期（Redis TTL）时返回 404
    - 关系不一致时 confirmCharacters 返回 400
    - 校验 bloodType 和 mbtiType 的有效性，无效值返回 400
    - _Requirements: 3.6_

- [x] 10. Checkpoint - 确保 API 端点和两阶段流程正确
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. 实现角色持久化与跨剧本复用
  - [x] 11.1 实现角色持久化逻辑
    - 在 confirmCharacters 流程中，将每个 CharacterProfile 持久化到 `characters` 表（含 gender、blood_type、mbti_type 字段）
    - 在第二阶段完成后，创建 `script_character_sets` 关联记录
    - 第二阶段完成后自动更新 experienceSummary
    - 在 Script.content 中可选存储 characterProfiles 快照和 generationMode
    - _Requirements: 8.3, 8.7_

  - [x] 11.2 实现角色 CRUD API
    - `POST /api/characters` — 创建角色（含 gender、bloodType、mbtiType 字段）
    - `GET /api/characters` — 查询角色列表（支持按名称/标签筛选）
    - `GET /api/characters/:id` — 查询角色详情含经历列表（返回含 gender、bloodType、mbtiType 的完整信息）
    - `PUT /api/characters/:id` — 更新角色基本设计
    - `DELETE /api/characters/:id` — 删除角色（仅当无关联剧本时允许）
    - _Requirements: 8.4, 8.5, 8.6, 8.8_

  - [ ]* 11.3 编写 Property 14 属性测试：角色持久化往返一致性
    - **Property 14: 角色持久化往返一致性**
    - 使用 fast-check 生成任意有效 CharacterProfile（含 characterType、gender、bloodType、mbtiType、appearance），验证持久化到 characters 表后再读取，角色基本设计（name、characterType、gender、bloodType、mbtiType、personality、appearance、abilities、tags）与原始数据一致
    - **Validates: Requirements 8.3, 8.6**

- [x] 12. 实现反馈驱动的角色优化
  - [x] 12.1 实现两阶段反馈优化方法
    - 实现 `optimizeWithFeedbackCharacterFirst(scriptId, feedback)` — 从原始 Script 提取角色设定（含 gender、bloodType、mbtiType），结合反馈生成优化角色，再执行第二阶段故事生成
    - 实现 `buildCharacterOptimizationPrompt(characters, feedback, skills)` — 构建角色优化提示词，低分维度作为优化重点，保持 MBTI/血型与性格的一致性
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 12.2 编写 Property 12 属性测试：反馈优化提示词包含低分角色维度
    - **Property 12: 反馈优化提示词包含低分角色维度**
    - 使用 fast-check 生成任意 AggregatedFeedback，验证当角色相关维度平均评分 < 6 时，`buildCharacterOptimizationPrompt` 输出包含这些低分维度
    - **Validates: Requirements 6.2**

- [x] 13. 向后兼容与 Script 结构一致性
  - [x] 13.1 确保两种模式产出的 Script 结构一致
    - 验证 character_first 模式产出的 Script 包含所有必填字段，与 oneshot 模式结构一致
    - 确保现有 `startGenerate` 方法默认 generationMode 为 oneshot，行为不变
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 13.2 编写 Property 13 属性测试：两种模式 Script 结构一致
    - **Property 13: 两种模式 Script 结构一致**
    - 使用 fast-check 验证无论 generationMode 为 oneshot 还是 character_first，最终 Script 对象都包含相同的必填字段集合（id、version、configId、config、title、dmHandbook、playerHandbooks、materials、branchStructure、tags、status、createdAt、updatedAt）
    - **Validates: Requirements 7.4**

- [x] 14. Final checkpoint - 全部测试通过，集成验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保需求可追溯
- Checkpoint 任务用于阶段性验证，确保增量开发的正确性
- 属性测试使用 fast-check + Vitest，每个属性至少运行 100 次迭代
- 属性测试注释格式：**Feature: character-first-generation, Property {number}: {property_text}**
- 新增字段 gender、bloodType、mbtiType 贯穿类型定义、数据库、提示词、API 全链路
- 角色性格（personality）与 MBTI 类型、血型之间的一致性在第一阶段提示词中通过指令约束
