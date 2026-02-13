# 需求文档：多模型路由 (Multi-Model Routing)

## 简介

当前系统使用单一 LLMAdapter，所有 LLM 调用共享同一个模型/提供商/密钥。本功能将引入多模型路由层，支持按任务类型分配不同模型、跨提供商 Fallback 链、以及外部化 JSON 配置文件，从而提升成本效率和系统韧性。

## 术语表

- **Router（路由器）**: 根据任务类型和配置，将 LLM 请求分发到对应模型提供商的组件
- **TaskType（任务类型）**: LLM 请求的用途标识，如 `planning`、`design`、`chapter_generation`、`one_shot_generation`
- **ModelTier（模型层级）**: 按任务类型分配的模型配置，包含提供商、模型名称和参数
- **FallbackChain（回退链）**: 当主模型失败时，按优先级依次尝试的备选模型列表
- **ProviderConfig（提供商配置）**: 单个 LLM 提供商的连接信息，包括 API 密钥、端点和默认模型
- **RoutingConfig（路由配置）**: 外部化 JSON 配置文件的根结构，包含所有提供商和任务路由规则
- **LLMRequest**: 发送给 LLM 的请求对象，包含 prompt、systemPrompt、maxTokens、temperature 等字段
- **SupportedLanguage（支持语言）**: 系统支持的语言代码，当前包括 `en`（英文）和 `zh`（中文）
- **LanguageDirective（语言指令）**: 注入到 systemPrompt 中的语言提示，指导 LLM 使用指定语言生成响应

## 需求

### 需求 1：任务类型标识

**用户故事：** 作为开发者，我希望 LLM 请求携带任务类型标识，以便路由器根据任务类型选择合适的模型。

#### 验收标准

1. WHEN 构建 LLM 请求时，THE LLMRequest SHALL 支持可选的 `taskType` 字段，取值为预定义的任务类型枚举
2. WHEN `taskType` 未指定时，THE Router SHALL 使用默认任务类型 `default` 进行路由
3. THE TaskType 枚举 SHALL 包含以下值：`planning`、`design`、`chapter_generation`、`one_shot_generation`、`optimization`、`default`

### 需求 2：外部化模型配置

**用户故事：** 作为运维人员，我希望通过 JSON 配置文件管理多模型路由规则，以便无需修改代码即可调整模型分配。

#### 验收标准

1. THE RoutingConfig SHALL 从 JSON 配置文件（默认路径 `config/llm-routing.json`）加载路由规则
2. THE RoutingConfig SHALL 包含 `providers` 字段，定义多个提供商的连接信息（apiKey、endpoint、defaultModel、providerName）
3. THE RoutingConfig SHALL 包含 `routing` 字段，为每个 TaskType 指定主模型和回退链
4. WHEN JSON 配置文件不存在时，THE Router SHALL 回退到现有环境变量配置（LLM_API_KEY、LLM_ENDPOINT、LLM_MODEL、LLM_PROVIDER），保持向后兼容
5. WHEN JSON 配置文件存在但格式无效时，THE ConfigLoader SHALL 抛出包含具体校验错误信息的异常
6. THE ConfigLoader SHALL 在启动时校验配置文件，确保所有 routing 条目引用的 provider 在 providers 中已定义
7. THE RoutingConfig SHALL 支持通过环境变量覆盖 provider 的 apiKey 字段（格式：`LLM_PROVIDER_{PROVIDER_NAME}_API_KEY`）

### 需求 3：按任务类型路由

**用户故事：** 作为开发者，我希望不同创作阶段自动使用不同模型，以便在创意质量和成本之间取得平衡。

#### 验收标准

1. WHEN 收到带有 `taskType` 的 LLM 请求时，THE Router SHALL 根据 routing 配置选择对应的主模型提供商和模型
2. WHEN routing 配置中未定义某个 `taskType` 的路由规则时，THE Router SHALL 使用 `default` 任务类型的路由规则
3. THE Router SHALL 将路由配置中指定的 `temperature` 和 `maxTokens` 参数合并到请求中，请求自身的参数优先级更高

### 需求 4：Fallback 链

**用户故事：** 作为运维人员，我希望当主模型不可用时系统自动切换到备选模型，以便提高服务可用性。

#### 验收标准

1. WHEN 主模型返回可重试错误（HTTP 429 或 5xx）且重试耗尽时，THE Router SHALL 按 fallback 链顺序尝试下一个提供商
2. WHEN fallback 链中所有提供商均失败时，THE Router SHALL 抛出包含所有尝试记录的聚合错误
3. THE Router SHALL 对 fallback 链中的每个提供商独立执行重试逻辑（使用现有的指数退避策略）
4. THE Router SHALL 在每次 fallback 切换时记录日志，包含失败提供商名称、错误码和切换目标
5. WHEN 主模型返回不可重试错误（如 HTTP 400、401、403）时，THE Router SHALL 直接抛出错误，跳过 fallback 链

### 需求 5：向后兼容

**用户故事：** 作为开发者，我希望在不配置多模型路由的情况下系统行为与之前完全一致，以便平滑迁移。

#### 验收标准

1. WHEN 未提供 JSON 配置文件且环境变量已设置时，THE Router SHALL 创建单提供商配置，行为与现有 LLMAdapter 一致
2. WHEN 调用方未传入 `taskType` 时，THE Router SHALL 使用 `default` 路由规则
3. THE ILLMAdapter 接口 SHALL 保持不变，Router 作为新的路由层在 ILLMAdapter 之上工作
4. THE Router SHALL 实现 ILLMAdapter 接口，使其可以作为现有 LLMAdapter 的替代品注入

### 需求 6：配置文件解析与序列化

**用户故事：** 作为开发者，我希望配置文件的加载和校验逻辑可靠且可测试，以便确保配置正确性。

#### 验收标准

1. THE ConfigLoader SHALL 将 JSON 配置文件解析为强类型的 RoutingConfig 对象
2. THE ConfigLoader SHALL 将 RoutingConfig 对象序列化回等价的 JSON 字符串
3. FOR ALL 合法的 RoutingConfig 对象，解析其序列化结果 SHALL 产生与原对象等价的对象（往返一致性）
4. WHEN 配置文件缺少必填字段时，THE ConfigLoader SHALL 返回包含缺失字段名称的校验错误
5. WHEN 配置文件包含未知字段时，THE ConfigLoader SHALL 忽略未知字段并正常解析

### 需求 7：多语言支持

**用户故事：** 作为开发者，我希望系统支持多语言的 LLM 提示词和响应，以便为不同语言的用户提供本地化体验。

#### 验收标准

1. THE RoutingConfig SHALL 包含 `defaultLanguage` 字段，默认值为 `en`（英文）
2. THE RoutingConfig SHALL 支持 `en`（英文）和 `zh`（中文）两种语言选项
3. WHEN 发送 LLM 请求时，THE Router SHALL 根据当前语言设置在 systemPrompt 中注入语言指令
4. WHEN 请求中携带 `language` 字段时，THE Router SHALL 使用请求级别的语言设置覆盖配置文件中的默认语言
5. WHEN 语言设置为不支持的值时，THE Router SHALL 回退到 `defaultLanguage` 配置值
6. THE LLMRequest SHALL 支持可选的 `language` 字段，取值为支持的语言代码
