# Implementation Plan: 剧本生成子系统 (script-generation)

## Overview

基于子模块 design-kb 中已有的实现（ConfigService、SkillService、LLMAdapter），在当前项目中构建剧本生成子系统的完整后端服务。采用增量开发方式，从已有组件的迁移/适配开始，逐步实现GeneratorService、TagService和反馈驱动优化功能。

## Tasks

- [x] 1. 项目基础设施搭建
  - [x] 1.1 初始化 Monorepo 结构和共享类型包
    - 创建 packages/shared/src/types/ 目录，定义 config.ts、script.ts、tag.ts、feedback.ts 类型
    - 配置 tsconfig.json 和 package.json（@gdgeek/murder-mystery-shared）
    - 创建 packages/shared/src/index.ts 统一导出
    - _Requirements: 1.1, 2.1, 4.1, 5.1_

  - [x] 1.2 初始化后端服务包
    - 创建 packages/server/ 目录结构（src/services/、src/adapters/、src/routes/、src/db/、src/skills/、src/config/）
    - 配置 package.json（依赖 @gdgeek/murder-mystery-shared、express、mysql2、ioredis、uuid）
    - 配置 tsconfig.json、vitest.config.ts
    - 配置 vitest 和 fast-check 测试依赖
    - _Requirements: 9.1, 9.2_

  - [x] 1.3 配置数据库连接和迁移脚本
    - 创建 src/db/mysql.ts（MySQL连接池）和 src/db/redis.ts（Redis客户端）
    - 创建数据库迁移脚本 001-init.sql：script_configs、scripts、tags、script_tags 表
    - _Requirements: 1.5, 6.4_

- [x] 2. ConfigService 实现与测试
  - [x] 2.1 实现 ConfigService
    - 实现 packages/server/src/services/config.service.ts
    - 包含 validate、create、calculateRoundStructure、getById 方法
    - 包含新本格特殊设定（specialSetting）校验逻辑
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.5.1, 1.5.2, 1.5.3_

  - [x] 2.2 编写 ConfigService 单元测试
    - 测试 validate 方法的各种有效/无效输入场景
    - 测试 calculateRoundStructure 的所有时长映射和时间范围约束
    - 测试边界值（playerCount 1/6、durationHours 2/6、ratio 0+100/100+0）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [ ]* 2.3 编写 ConfigService 属性测试：配置参数校验完整性
    - **Property 1: 配置参数校验完整性**
    - 使用 fast-check 生成随机有效/无效配置输入，验证：有效输入 → valid=true 且 errors 为空；无效输入 → valid=false 且 errors 精确指出不合法字段
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 2.4 编写 ConfigService 属性测试：轮次结构时长约束
    - **Property 2: 轮次结构时长约束**
    - 使用 fast-check 生成 2-6 的 durationHours，验证每轮阶段时间在规定范围内（阅读10-15、搜证15-20、讨论15-20），且所有时间加总不超过总时长
    - **Validates: Requirements 1.7**

- [x] 3. SkillService 实现与测试
  - [x] 3.1 实现 SkillService
    - 实现 packages/server/src/services/skill.service.ts
    - 从 JSON 文件加载 Skill 模板（honkaku.json、shin-honkaku.json、henkaku.json、common.json）
    - 实现 getByCategory、getByGameType、getForGeneration、serialize、deserialize、getAllTemplates 方法
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 编写 SkillService 单元测试
    - 测试 getAllTemplates 返回非空数组且每个模板包含必填字段
    - 测试 getByCategory 按类别过滤、getByGameType 按游戏类型过滤且按 priority 降序排列
    - 测试 getForGeneration 同时按游戏类型和类别过滤
    - 测试 serialize/deserialize 往返一致性
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.3 编写 SkillService 属性测试：JSON往返一致性
    - **Property 3: Skill模板JSON往返一致性**
    - 使用 fast-check 生成随机 SkillTemplate 对象，验证 deserialize(serialize(template)) 深度等于 template
    - **Validates: Requirements 2.7**

  - [ ]* 3.4 编写 SkillService 属性测试：游戏类型过滤与排序
    - **Property 4: Skill按游戏类型过滤与优先级排序**
    - 使用 fast-check 生成随机 GameType，验证 getByGameType 返回的每个模板的 gameTypes 包含该 gameType，且结果按 priority 降序排列
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [x] 4. LLMAdapter 实现与测试
  - [x] 4.1 实现 LLMAdapter
    - 实现 packages/server/src/adapters/llm-adapter.ts 和 llm-adapter.interface.ts
    - 实现 send 方法（含指数退避重试）、getProviderName、getDefaultModel
    - 支持环境变量配置（LLM_API_KEY、LLM_ENDPOINT、LLM_MODEL、LLM_PROVIDER）
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 4.2 编写 LLMAdapter 单元测试
    - 测试成功响应返回 content 和 tokenUsage
    - 测试 429/5xx 错误的指数退避重试（验证重试次数和延迟间隔）
    - 测试重试耗尽后抛出 LLMError（含 statusCode、retryAttempts、provider）
    - 测试 4xx（非429）不重试
    - 测试网络错误重试
    - 测试 token total = prompt + completion
    - _Requirements: 9.3, 9.4, 9.5_

  - [ ]* 4.3 编写 LLMAdapter 属性测试：指数退避重试
    - **Property 13: LLM指数退避重试**
    - 使用 fast-check 生成随机可重试状态码（429/5xx）和重试次数，验证重试延迟按 baseDelay × backoffMultiplier^(attempt-1) 增长，重试耗尽后 LLMError 包含正确的 retryAttempts 和 provider
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 4.4 编写 LLMAdapter 属性测试：Token用量
    - **Property 14: LLM响应包含Token用量**
    - 使用 fast-check 生成随机 prompt/completion token 数，验证返回的 tokenUsage.total = prompt + completion 且 responseTimeMs ≥ 0
    - **Validates: Requirements 9.5**

- [x] 5. Checkpoint - 基础组件验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. GeneratorService 核心实现
  - [x] 6.1 实现 GeneratorService 核心生成逻辑
    - 创建 packages/server/src/services/generator.service.ts
    - 实现 generate(config) 方法：获取 Skill 模板 → 组装提示词（系统提示 + 配置参数 + Skill + 反馈 + 语言指令）→ 调用 LLM → 解析 JSON → 校验结构 → 存储
    - 实现 buildSystemPrompt（含新本格特殊设定指令）和 buildUserPrompt（含反馈低分维度和高频建议）
    - 实现 parseGeneratedContent（支持 markdown fence 包裹的 JSON）
    - 实现 validateGenerated（玩家手册数量、线索一致性、分支可达性校验）
    - _Requirements: 3.1, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.6, 10.1, 1.5.4, 1.5.5_

  - [x] 6.2 实现 Script 序列化/反序列化和数据库存储
    - 实现 serializeScript / deserializeScript 方法（处理 Date 序列化）
    - 实现 storeScript、getScript、listScripts 数据库操作
    - _Requirements: 6.4_

  - [x] 6.3 编写 GeneratorService 单元测试
    - 测试 buildSystemPrompt（中文/英文语言指令、新本格特殊设定指令）
    - 测试 buildUserPrompt（配置参数包含、反馈低分维度包含、高分维度排除）
    - 测试 parseGeneratedContent（有效 JSON、markdown fence 包裹、无效 JSON）
    - 测试 validateGenerated（玩家手册数量不匹配、线索 ID 不一致）
    - 测试 validateBranchReachability（可达/不可达/空分支）
    - 测试 serializeScript/deserializeScript 往返一致性
    - _Requirements: 3.1, 4.2, 5.3, 6.2, 6.4_

  - [ ]* 6.4 编写属性测试：玩家手册数量一致
    - **Property 5: 玩家手册数量与配置一致**
    - 使用 fast-check 生成随机 playerCount（1-6），构造 mock LLM 返回对应数量的手册，验证 validateGenerated 对数量匹配通过、不匹配抛出错误
    - **Validates: Requirements 4.2**

  - [ ]* 6.5 编写属性测试：线索分发完整性
    - **Property 6: 线索分发完整性（跨引用一致性）**
    - 使用 fast-check 生成随机 clueDistribution 和 Material 线索卡集合，验证 validateClueConsistency 对双向一致的数据通过、不一致的数据抛出错误
    - **Validates: Requirements 5.3**

  - [ ]* 6.6 编写属性测试：分支结构可达性
    - **Property 7: 分支结构可达性**
    - 使用 fast-check 生成随机 BranchStructure（确保从起始节点有路径到结局），验证 validateBranchReachability 通过；生成含死路的结构验证抛出错误
    - **Validates: Requirements 6.2**

  - [ ]* 6.7 编写属性测试：玩家手册信息隔离
    - **Property 8: 玩家手册信息隔离**
    - 使用 fast-check 生成随机 PlayerHandbook 对（含 secrets），验证 A.secrets 中的每个秘密不出现在 B 的 backgroundStory、knownClues、roundActions 文本中
    - **Validates: Requirements 4.3**

  - [ ]* 6.8 编写属性测试：Script JSON往返一致性
    - **Property 9: Script JSON往返一致性**
    - 使用 fast-check 生成随机 Script 对象，验证 deserializeScript(serializeScript(script)) 与原始 Script 语义等价
    - **Validates: Requirements 6.4**

- [x] 7. 版本管理与反馈优化
  - [x] 7.1 实现 Script 版本管理
    - 在 GeneratorService 中实现 optimizeWithFeedback(scriptId, feedback) 方法：查询原版本 → 组装优化提示词（含反馈数据）→ 调用 LLM → 创建新版本（版本号递增 v1.0→v1.1）→ 设置 parentVersionId → 存储
    - 实现 getScriptVersions(scriptId) 查询同一 configId 下的版本历史
    - _Requirements: 6.5, 8.3_

  - [x] 7.2 实现反馈驱动提示词组装与自动优化触发
    - 实现 checkAutoOptimizeTrigger(scriptId) 方法：查询评价数量 ≥ 阈值（默认5）且任一维度平均评分 < 6 时返回 true
    - 确保 buildUserPrompt 中已集成反馈查询逻辑（低分维度和高频建议纳入提示词）
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 7.3 编写属性测试：版本递增不可变性
    - **Property 10: 版本递增不可变性**
    - 使用 fast-check 生成随机版本号字符串，验证优化操作后原版本内容和版本号不变，新版本号严格大于原版本
    - **Validates: Requirements 6.5**

  - [ ]* 7.4 编写属性测试：反馈驱动提示词包含低分维度
    - **Property 15: 反馈驱动提示词包含低分维度**
    - 使用 fast-check 生成随机 AggregatedFeedback（含随机维度评分），验证评分 < 6 的维度名称出现在 buildUserPrompt 输出中
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 7.5 编写属性测试：自动优化触发条件
    - **Property 16: 自动优化触发条件**
    - 使用 fast-check 生成随机反馈数据（totalReviews 和维度评分），验证 checkAutoOptimizeTrigger 在 totalReviews ≥ 5 且任一维度 < 6 时返回 true，否则返回 false
    - **Validates: Requirements 8.4**

- [x] 8. Checkpoint - 生成引擎与版本管理验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. TagService 实现
  - [x] 9.1 实现 TagService
    - 创建 packages/server/src/services/tag.service.ts
    - 实现 autoGenerateTags(script)：根据 config 自动生成 game_type、age_group、player_count、era、theme 标签，标记 isAutoGenerated=true
    - 实现 addCustomTag(scriptId, tagName)：创建 category=CUSTOM 的标签并关联，标记 isAutoGenerated=false
    - 实现 removeTag(scriptId, tagId)
    - 实现 getScriptTags(scriptId)
    - 实现 searchByTags(tagIds, limit, offset)：查询关联了所有指定标签的剧本
    - 实现 getPopularTags(limit)：按使用次数排序，使用 Redis Sorted Set 缓存（TTL 300s）
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.2 编写 TagService 属性测试：自动标签生成完整性
    - **Property 11: 自动标签生成完整性**
    - 使用 fast-check 生成随机 Script+Config，验证 autoGenerateTags 产生的标签覆盖 game_type、age_group、player_count、era、theme 五个类别，且每个标签 isAutoGenerated=true
    - **Validates: Requirements 7.1**

  - [ ]* 9.3 编写 TagService 属性测试：标签搜索正确性
    - **Property 12: 标签搜索正确性**
    - 使用 fast-check 生成随机标签集合和剧本-标签关联，验证 searchByTags 返回的每个剧本都关联了所有指定标签，且不遗漏满足条件的剧本
    - **Validates: Requirements 7.3**

- [x] 10. REST API 路由层
  - [x] 10.1 实现配置和剧本相关 API 路由
    - 创建 packages/server/src/routes/configs.ts：POST /api/configs（校验+创建）、GET /api/configs/:id
    - 创建 packages/server/src/routes/scripts.ts：POST /api/scripts/generate、GET /api/scripts（支持标签筛选）、GET /api/scripts/:id、GET /api/scripts/:id/versions、POST /api/scripts/:id/optimize
    - 创建 packages/server/src/routes/tags.ts：GET /api/tags（支持 category 筛选）、GET /api/tags/popular、POST /api/scripts/:id/tags、DELETE /api/scripts/:id/tags/:tagId
    - 创建 packages/server/src/app.ts 注册所有路由，实现 i18n 中间件（根据 Accept-Language 返回对应语言的错误信息）
    - _Requirements: 1.1-1.8, 6.4, 7.1-7.4, 9.1, 10.2, 10.3_

  - [ ]* 10.2 编写 API 集成测试
    - 使用 Supertest 测试主要 API 端点的请求/响应
    - 测试配置创建校验（无效参数返回400）、剧本生成触发、标签 CRUD 操作
    - _Requirements: 1.4, 7.1, 7.3_

- [x] 11. Final checkpoint - 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个属性测试引用设计文档中的 Property 编号，确保需求可追溯
- Checkpoints 确保增量验证
- 属性测试使用 fast-check 库，每个测试至少运行 100 次迭代
- 注释格式：**Feature: script-generation, Property {number}: {property_text}**
