# 实现计划：多模型路由 (Multi-Model Routing)

## 概述

基于设计文档，按增量方式实现多模型路由功能。从类型定义和配置加载开始，逐步构建路由器核心逻辑、Fallback 链、语言注入，最后完成集成接线。每个步骤都在前一步基础上构建，确保无孤立代码。

## 任务

- [x] 1. 定义共享类型和数据模型
  - [x] 1.1 在 `packages/shared/src/types/routing.ts` 中创建路由配置类型
    - 定义 `ProviderConfig`、`TaskRoute`、`RoutingConfig`、`ProviderAttempt`、`AggregateRouterError`
    - 从 `packages/shared/src/index.ts` 导出新类型
    - _Requirements: 2.2, 2.3_
  - [x] 1.2 扩展 `packages/shared/src/types/script.ts` 中的 LLMRequest
    - 添加 `TaskType` 枚举（planning、design、chapter_generation、one_shot_generation、optimization、default）
    - 添加 `SupportedLanguage` 类型（'en' | 'zh'）
    - 在 `LLMRequest` 接口中添加可选的 `taskType` 和 `language` 字段
    - _Requirements: 1.1, 1.3, 7.6_

- [x] 2. 实现 ConfigLoader（配置加载器）
  - [x] 2.1 创建 `packages/server/src/adapters/config-loader.ts`
    - 实现 `load(filePath?)`：从 JSON 文件加载配置，文件不存在返回 null
    - 实现 `validate(config)`：校验必填字段、provider 引用一致性、语言代码合法性
    - 实现 `serialize(config)` 和 `parse(json)`：序列化与反序列化
    - 实现 `applyEnvOverrides(config)`：环境变量覆盖 apiKey
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 6.1, 6.2, 6.4, 6.5_
  - [ ]* 2.2 编写 ConfigLoader 属性测试
    - **Property 1: 配置往返一致性** - 随机生成合法 RoutingConfig，serialize → parse 应产生等价对象
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [ ]* 2.3 编写 ConfigLoader 属性测试
    - **Property 2: 未知字段不影响解析** - 合法 RoutingConfig JSON 添加随机未知字段后解析结果不变
    - **Validates: Requirements 6.5**
  - [ ]* 2.4 编写 ConfigLoader 属性测试
    - **Property 3: 配置校验捕获缺失必填字段** - 随机移除必填字段后 validate 应报错
    - **Validates: Requirements 2.5, 6.4**
  - [ ]* 2.5 编写 ConfigLoader 属性测试
    - **Property 4: 配置校验捕获无效 Provider 引用** - routing 引用不存在的 provider 时 validate 应报错
    - **Validates: Requirements 2.6**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现语言指令模块
  - [x] 4.1 创建 `packages/server/src/adapters/language-directives.ts`
    - 定义 `LANGUAGE_DIRECTIVES` 映射表（en-US → 英文指令, zh-CN → 中文指令）
    - 实现 `getLanguageDirective(language, defaultLanguage)` 函数
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 5. 实现 LLMRouter（路由器）
  - [x] 5.1 创建 `packages/server/src/adapters/llm-router.ts`
    - 实现构造函数：根据 RoutingConfig 创建多个 LLMAdapter 实例
    - 实现 `resolveRoute(taskType)`：按 taskType 查找路由，未匹配回退到 default
    - 实现 `mergeParams(request, route)`：合并参数，请求优先
    - 实现 `injectLanguageDirective(request, language)`：在 systemPrompt 前注入语言指令
    - 实现 `send(request)`：路由 → 合并 → 语言注入 → 主模型 → fallback 链
    - 实现 `getProviderName()` 和 `getDefaultModel()`
    - 实现 `static fromEnv()`：从环境变量构建单提供商回退配置
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4, 7.3, 7.4, 7.5_
  - [ ]* 5.2 编写路由解析属性测试
    - **Property 5: 缺失/未知 TaskType 回退到 default** - 随机请求无 taskType 或未知 taskType 时解析到 default
    - **Validates: Requirements 1.2, 3.2, 5.2**
  - [ ]* 5.3 编写路由解析属性测试
    - **Property 6: 已知 TaskType 路由到正确 Provider** - 随机 RoutingConfig + 匹配 taskType 时选择正确 provider
    - **Validates: Requirements 3.1**
  - [ ]* 5.4 编写参数合并属性测试
    - **Property 7: 参数合并请求优先** - 随机 LLMRequest + TaskRoute，请求自身参数优先
    - **Validates: Requirements 3.3**
  - [ ]* 5.5 编写 Fallback 链属性测试
    - **Property 8: Fallback 链在可重试错误时依次执行** - 模拟主模型可重试失败，验证 fallback 顺序执行
    - **Validates: Requirements 4.1, 4.3**
  - [ ]* 5.6 编写聚合错误属性测试
    - **Property 9: 全部失败时聚合错误包含所有尝试记录** - 所有提供商失败时 attempts 数量正确
    - **Validates: Requirements 4.2**
  - [ ]* 5.7 编写不可重试错误属性测试
    - **Property 10: 不可重试错误跳过 Fallback** - 400/401/403 错误直接抛出，不尝试 fallback
    - **Validates: Requirements 4.5**
  - [ ]* 5.8 编写语言解析属性测试
    - **Property 11: 语言解析与指令注入** - 随机语言值（支持/不支持）+ RoutingConfig，验证正确的指令注入
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. 集成接线
  - [x] 7.1 创建示例配置文件 `config/llm-routing.example.json`
    - 包含多提供商配置示例和路由规则示例
    - _Requirements: 2.1_
  - [x] 7.2 修改应用启动逻辑，集成 LLMRouter
    - 在 `packages/server/src/app.ts` 或服务初始化处，使用 ConfigLoader 加载配置
    - 若配置文件存在，创建 LLMRouter；否则使用 `LLMRouter.fromEnv()` 回退
    - 将 LLMRouter 作为 ILLMAdapter 注入到 AuthoringService 等消费方
    - _Requirements: 2.4, 5.1, 5.3, 5.4_
  - [ ]* 7.3 编写集成单元测试
    - 测试完整请求流程：ConfigLoader → LLMRouter → LLMAdapter
    - 测试环境变量回退模式
    - _Requirements: 5.1, 5.2_

- [x] 8. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 检查点确保增量验证
