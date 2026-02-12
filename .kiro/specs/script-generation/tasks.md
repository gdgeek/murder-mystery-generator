# Implementation Plan: 剧本生成子系统 (script-generation)

## Overview

基于子模块 design-kb 中已有的实现（ConfigService、SkillService、LLMAdapter），在当前项目中构建剧本生成子系统的完整后端服务。采用增量开发方式，从已有组件的迁移/适配开始，逐步实现GeneratorService、TagService和反馈驱动优化功能。

## Tasks

- [ ] 1. 项目基础设施搭建
  - [ ] 1.1 初始化 Monorepo 结构和共享类型包
    - 创建 packages/shared/src/types/ 目录，从子模块迁移 config.ts、script.ts、tag.ts、feedback.ts 类型定义
    - 配置 tsconfig.json 和 package.json（@murder-mystery/shared）
    - 创建 packages/shared/src/index.ts 统一导出
    - _Requirements: 1.1, 2.1, 4.1, 5.1_

  - [ ] 1.2 初始化后端服务包
    - 创建 packages/server/ 目录结构（src/services/、src/adapters/、src/routes/、src/db/、src/skills/、src/config/）
    - 配置 package.json（依赖 @murder-mystery/shared、express、mysql2、ioredis、uuid）
    - 配置 tsconfig.json
    - 配置 vitest 和 fast-check 测试依赖
    - _Requirements: 9.1, 9.2_

  - [ ] 1.3 配置数据库连接和迁移脚本
    - 创建 src/db/mysql.ts（MySQL连接池）和 src/db/redis.ts（Redis客户端）
    - 创建数据库迁移脚本：script_configs、scripts、tags、script_tags 表
    - _Requirements: 1.5, 6.4_

- [ ] 2. ConfigService 实现
  - [ ] 2.1 迁移并适配 ConfigService
    - 从子模块迁移 config.service.ts 到 packages/server/src/services/
    - 确保 validate、create、calculateRoundStructure、getById 函数正常工作
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 编写 ConfigService 属性测试：配置参数校验完整性
    - **Property 1: 配置参数校验完整性**
    - 使用 fast-check 生成随机有效/无效配置输入，验证校验结果的正确性
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 2.3 编写 ConfigService 属性测试：轮次结构时长约束
    - **Property 2: 轮次结构时长约束**
    - 使用 fast-check 生成 2-6 的 durationHours，验证轮次阶段时间范围和总时长约束
    - **Validates: Requirements 1.7**

- [ ] 3. SkillService 实现
  - [ ] 3.1 迁移并适配 SkillService
    - 从子模块迁移 skill.service.ts 和 skills/ JSON 数据文件到 packages/server/src/
    - 确保 getByCategory、getByGameType、getForGeneration、serialize、deserialize 函数正常工作
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 编写 SkillService 属性测试：JSON往返一致性
    - **Property 3: Skill模板JSON往返一致性**
    - 使用 fast-check 生成随机 SkillTemplate 对象，验证 serialize→deserialize 往返一致性
    - **Validates: Requirements 2.7**

  - [ ]* 3.3 编写 SkillService 属性测试：游戏类型过滤与排序
    - **Property 4: Skill按游戏类型过滤与优先级排序**
    - 使用 fast-check 生成随机 GameType，验证 getByGameType 返回结果的过滤和排序正确性
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [ ] 4. LLMAdapter 实现
  - [ ] 4.1 迁移并适配 LLMAdapter
    - 从子模块迁移 llm-adapter.ts 和 llm-adapter.interface.ts 到 packages/server/src/adapters/
    - 确保 send、getProviderName、getDefaultModel 函数正常工作
    - 确保环境变量配置（LLM_API_KEY、LLM_ENDPOINT、LLM_MODEL、LLM_PROVIDER）正常读取
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.2 编写 LLMAdapter 属性测试：指数退避重试
    - **Property 13: LLM指数退避重试**
    - 使用 mock fetch 模拟可重试错误，验证重试次数、延迟间隔和最终错误对象
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 4.3 编写 LLMAdapter 属性测试：Token用量
    - **Property 14: LLM响应包含Token用量**
    - 使用 mock fetch 模拟成功响应，验证返回的 tokenUsage 和 responseTimeMs
    - **Validates: Requirements 9.5**

- [ ] 5. Checkpoint - 基础组件验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. GeneratorService 核心实现
  - [ ] 6.1 实现 GeneratorService 核心生成逻辑
    - 创建 packages/server/src/services/generator.service.ts
    - 实现 generate(config) 方法：组装提示词（config + skills + language指令）→ 调用LLM → 解析JSON结果 → 校验结构 → 存储
    - 实现 LLM 提示词组装逻辑（系统提示定义输出JSON格式，用户提示包含配置参数和Skill模板内容）
    - 实现生成结果解析和结构校验（玩家手册数量、线索ID一致性、分支可达性）
    - _Requirements: 3.1, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.6, 10.1_

  - [ ] 6.2 实现 Script 序列化/反序列化和数据库存储
    - 实现 serializeScript / deserializeScript 方法
    - 实现 getScript、listScripts 数据库查询方法
    - 实现 Script 存储到 MySQL（content 字段存储完整JSON）
    - _Requirements: 6.4_

  - [ ]* 6.3 编写 GeneratorService 属性测试：玩家手册数量一致
    - **Property 5: 玩家手册数量与配置一致**
    - 使用 mock LLM 返回预设结构，验证 playerHandbooks.length === config.playerCount
    - **Validates: Requirements 4.2**

  - [ ]* 6.4 编写属性测试：线索分发完整性
    - **Property 6: 线索分发完整性（跨引用一致性）**
    - 使用 fast-check 生成随机 Script 结构，验证 clueDistribution 和 Material 线索卡的 clueId 双向一致
    - **Validates: Requirements 5.3**

  - [ ]* 6.5 编写属性测试：分支结构可达性
    - **Property 7: 分支结构可达性**
    - 使用 fast-check 生成随机 BranchStructure，验证从起始节点沿任意路径都能到达结局
    - **Validates: Requirements 6.2**

  - [ ]* 6.6 编写属性测试：玩家手册信息隔离
    - **Property 8: 玩家手册信息隔离**
    - 使用 fast-check 生成随机 PlayerHandbook 对，验证 secrets 不出现在对方可见内容中
    - **Validates: Requirements 4.3**

  - [ ]* 6.7 编写属性测试：Script JSON往返一致性
    - **Property 9: Script JSON往返一致性**
    - 使用 fast-check 生成随机 Script 对象，验证 serialize→deserialize 往返一致性
    - **Validates: Requirements 6.4**

- [ ] 7. 版本管理与反馈优化
  - [ ] 7.1 实现 Script 版本管理
    - 实现 optimizeWithFeedback(scriptId, feedback) 方法：查询原版本 → 组装优化提示词 → 调用LLM → 创建新版本（版本号递增）→ 存储
    - 实现 getScriptVersions(scriptId) 查询版本历史
    - _Requirements: 6.5, 8.3_

  - [ ] 7.2 实现反馈驱动提示词组装
    - 在 generate 方法中集成反馈查询逻辑：查询历史 AggregatedFeedback，将低分维度和高频建议纳入提示词
    - 实现 checkAutoOptimizeTrigger(scriptId) 方法：评价数量 ≥ 阈值且任一维度 < 6 时返回 true
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 7.3 编写属性测试：版本递增不可变性
    - **Property 10: 版本递增不可变性**
    - 验证优化操作后原版本不变，新版本号严格递增
    - **Validates: Requirements 6.5**

  - [ ]* 7.4 编写属性测试：反馈驱动提示词
    - **Property 15: 反馈驱动提示词包含低分维度**
    - 使用 fast-check 生成随机 AggregatedFeedback，验证低分维度被包含在提示词中
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 7.5 编写属性测试：自动优化触发条件
    - **Property 16: 自动优化触发条件**
    - 使用 fast-check 生成随机反馈数据，验证触发条件的正确性
    - **Validates: Requirements 8.4**

- [ ] 8. Checkpoint - 生成引擎验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. TagService 实现
  - [ ] 9.1 实现 TagService
    - 创建 packages/server/src/services/tag.service.ts
    - 实现 autoGenerateTags(script)：根据 config 自动生成 game_type、age_group、player_count、era、theme 标签
    - 实现 addCustomTag(scriptId, tagName)：创建 category=CUSTOM 的标签并关联
    - 实现 removeTag(scriptId, tagId)
    - 实现 getScriptTags(scriptId)
    - 实现 searchByTags(tagIds, limit, offset)：查询关联了所有指定标签的剧本
    - 实现 getPopularTags(limit)：按使用次数排序，使用 Redis 缓存
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.2 编写 TagService 属性测试：自动标签生成完整性
    - **Property 11: 自动标签生成完整性**
    - 使用 fast-check 生成随机 Script+Config，验证自动标签覆盖所有必要类别
    - **Validates: Requirements 7.1**

  - [ ]* 9.3 编写 TagService 属性测试：标签搜索正确性
    - **Property 12: 标签搜索正确性**
    - 使用 fast-check 生成随机标签集合和剧本集合，验证搜索结果的完整性和正确性
    - **Validates: Requirements 7.3**

- [ ] 10. REST API 路由层
  - [ ] 10.1 实现配置和剧本相关 API 路由
    - 创建 packages/server/src/routes/configs.ts：POST /api/configs、GET /api/configs/:id
    - 创建 packages/server/src/routes/scripts.ts：POST /api/scripts/generate、GET /api/scripts、GET /api/scripts/:id、GET /api/scripts/:id/versions、POST /api/scripts/:id/optimize
    - 创建 packages/server/src/routes/tags.ts：GET /api/tags、GET /api/tags/popular、POST /api/scripts/:id/tags、DELETE /api/scripts/:id/tags/:tagId
    - 创建 packages/server/src/app.ts 注册所有路由
    - 实现 i18n 中间件支持根据 Accept-Language 返回对应语言的错误信息
    - _Requirements: 1.1-1.8, 6.4, 7.1-7.4, 9.1, 10.2, 10.3_

  - [ ]* 10.2 编写 API 集成测试
    - 使用 Supertest 测试主要 API 端点的请求/响应
    - 测试配置创建校验、剧本生成触发、标签操作
    - _Requirements: 1.4, 7.1, 7.3_

- [ ] 11. Final checkpoint - 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 子模块 design-kb 中已实现 ConfigService、SkillService、LLMAdapter，任务 2.1、3.1、4.1 为迁移适配
- 每个属性测试引用设计文档中的 Property 编号，确保需求可追溯
- Checkpoints 确保增量验证
