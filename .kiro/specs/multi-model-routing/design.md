# 设计文档：多模型路由 (Multi-Model Routing)

## 概述

本设计在现有 `LLMAdapter` 之上引入路由层 `LLMRouter`，实现按任务类型分发请求到不同模型提供商、Fallback 链容错、外部化 JSON 配置、以及多语言 systemPrompt 注入。`LLMRouter` 实现 `ILLMAdapter` 接口，可作为现有 `LLMAdapter` 的直接替代品注入到 `AuthoringService` 等消费方中，实现零侵入式迁移。

核心设计决策：
- Router 不替换 LLMAdapter，而是在其之上编排多个 LLMAdapter 实例
- 配置加载与校验独立为 `ConfigLoader` 模块，职责单一
- 语言指令通过 systemPrompt 前缀注入，不修改用户原始 prompt

## 架构

```mermaid
graph TD
    A[AuthoringService / PromptBuilder] -->|send(request)| B[LLMRouter]
    B -->|loadConfig| C[ConfigLoader]
    C -->|读取| D[config/llm-routing.json]
    C -->|回退| E[环境变量]
    B -->|route by taskType| F{路由决策}
    F -->|主模型| G[LLMAdapter 实例 A]
    F -->|fallback 1| H[LLMAdapter 实例 B]
    F -->|fallback N| I[LLMAdapter 实例 N]
    G -->|HTTP| J[Provider A API]
    H -->|HTTP| K[Provider B API]
    I -->|HTTP| L[Provider N API]
```

请求流程：
1. 调用方通过 `ILLMAdapter.send(request)` 发送请求，request 可携带 `taskType` 和 `language`
2. `LLMRouter` 根据 `taskType`（默认 `default`）查找路由配置，确定主模型和 fallback 链
3. Router 合并路由配置中的 `temperature`/`maxTokens` 参数（请求自身参数优先）
4. Router 根据语言设置在 systemPrompt 前注入语言指令
5. Router 将请求发送到主模型对应的 `LLMAdapter` 实例
6. 若主模型返回可重试错误且重试耗尽，按 fallback 链顺序尝试下一个提供商
7. 若所有提供商均失败，抛出聚合错误

## 组件与接口

### 1. ConfigLoader（配置加载器）

位置：`packages/server/src/adapters/config-loader.ts`

职责：加载、校验、序列化路由配置。

```typescript
export class ConfigLoader {
  /**
   * 从文件路径加载并校验配置。
   * 若文件不存在，返回 null（由 Router 回退到环境变量）。
   * 若文件格式无效，抛出含具体校验错误的异常。
   */
  static load(filePath?: string): RoutingConfig | null;

  /**
   * 校验配置对象，返回校验错误列表。
   * 检查：必填字段、routing 引用的 provider 是否存在、语言代码合法性。
   */
  static validate(config: unknown): ValidationError[];

  /**
   * 将 RoutingConfig 序列化为 JSON 字符串。
   */
  static serialize(config: RoutingConfig): string;

  /**
   * 从 JSON 字符串解析为 RoutingConfig。
   */
  static parse(json: string): RoutingConfig;

  /**
   * 应用环境变量覆盖 provider 的 apiKey。
   * 格式：LLM_PROVIDER_{PROVIDER_NAME}_API_KEY
   */
  static applyEnvOverrides(config: RoutingConfig): RoutingConfig;
}
```

### 2. LLMRouter（路由器）

位置：`packages/server/src/adapters/llm-router.ts`

职责：实现 `ILLMAdapter` 接口，按任务类型路由请求，执行 fallback 链，注入语言指令。

```typescript
export class LLMRouter implements ILLMAdapter {
  private adapters: Map<string, LLMAdapter>;  // providerName → LLMAdapter 实例
  private config: RoutingConfig;

  constructor(config: RoutingConfig);

  /**
   * 发送请求：路由 → 参数合并 → 语言注入 → 主模型 → fallback。
   * 扩展 LLMRequest 以支持 taskType 和 language 字段。
   */
  async send(request: LLMRequest): Promise<LLMResponse>;

  /** 返回默认路由的提供商名称 */
  getProviderName(): string;

  /** 返回默认路由的模型名称 */
  getDefaultModel(): string;

  /**
   * 根据 taskType 解析路由规则，未匹配时回退到 default。
   */
  private resolveRoute(taskType?: string): TaskRoute;

  /**
   * 合并路由配置参数到请求中（请求自身参数优先）。
   */
  private mergeParams(request: LLMRequest, route: TaskRoute): LLMRequest;

  /**
   * 根据语言设置在 systemPrompt 前注入语言指令。
   */
  private injectLanguageDirective(request: LLMRequest, language: string): LLMRequest;

  /**
   * 判断错误是否可重试（429 或 5xx）。
   */
  private isRetryableError(error: LLMError): boolean;

  /**
   * 从环境变量构建单提供商回退配置。
   */
  static fromEnv(): LLMRouter;
}
```

### 3. 扩展 LLMRequest 类型

位置：`packages/shared/src/types/script.ts`（修改现有文件）

```typescript
/** 任务类型枚举 */
export enum TaskType {
  PLANNING = 'planning',
  DESIGN = 'design',
  CHAPTER_GENERATION = 'chapter_generation',
  ONE_SHOT_GENERATION = 'one_shot_generation',
  OPTIMIZATION = 'optimization',
  DEFAULT = 'default',
}

/** 支持的语言 */
export type SupportedLanguage = 'en' | 'zh';

/** LLM 请求（扩展） */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  taskType?: TaskType;    // 新增
  language?: SupportedLanguage;  // 新增
}
```

### 4. 语言指令映射

位置：`packages/server/src/adapters/language-directives.ts`

```typescript
/** 语言指令映射表 */
export const LANGUAGE_DIRECTIVES: Record<SupportedLanguage, string> = {
  en: 'Please respond in English.',
  zh: '请使用中文回答。',
};

/**
 * 获取语言指令。若语言不支持，返回默认语言的指令。
 */
export function getLanguageDirective(
  language: string,
  defaultLanguage: SupportedLanguage,
): string;
```

## 数据模型

### RoutingConfig（路由配置）

```typescript
/** 提供商配置 */
export interface ProviderConfig {
  providerName: string;
  apiKey: string;
  endpoint: string;
  defaultModel: string;
}

/** 任务路由规则 */
export interface TaskRoute {
  provider: string;       // 引用 ProviderConfig.providerName
  model?: string;         // 覆盖 provider 的 defaultModel
  temperature?: number;
  maxTokens?: number;
  fallback?: string[];    // 按优先级排列的备选 provider 名称列表
}

/** 路由配置根结构 */
export interface RoutingConfig {
  providers: ProviderConfig[];
  routing: Record<string, TaskRoute>;  // key = TaskType 字符串
  defaultLanguage?: SupportedLanguage; // 默认 'en'
}
```

位置：`packages/shared/src/types/routing.ts`（新文件）

### 配置文件示例

```json
{
  "providers": [
    {
      "providerName": "openai",
      "apiKey": "${LLM_PROVIDER_OPENAI_API_KEY}",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "defaultModel": "gpt-4"
    },
    {
      "providerName": "anthropic",
      "apiKey": "${LLM_PROVIDER_ANTHROPIC_API_KEY}",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "defaultModel": "claude-3-sonnet"
    }
  ],
  "routing": {
    "planning": {
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 0.8,
      "maxTokens": 4096,
      "fallback": ["anthropic"]
    },
    "chapter_generation": {
      "provider": "anthropic",
      "model": "claude-3-sonnet",
      "temperature": 0.7,
      "maxTokens": 8192,
      "fallback": ["openai"]
    },
    "default": {
      "provider": "openai",
      "fallback": ["anthropic"]
    }
  },
  "defaultLanguage": "zh"
}
```

### 聚合错误

```typescript
/** Fallback 链中单次尝试的记录 */
export interface ProviderAttempt {
  provider: string;
  error: string;
  statusCode?: number;
  retryAttempts: number;
}

/** 聚合错误：所有提供商均失败时抛出 */
export class AggregateRouterError extends Error {
  attempts: ProviderAttempt[];
  constructor(attempts: ProviderAttempt[]);
}
```

## 正确性属性 (Correctness Properties)

*属性（Property）是在系统所有合法执行中都应成立的特征或行为——本质上是对系统应做什么的形式化陈述。属性是人类可读规格与机器可验证正确性保证之间的桥梁。*

### Property 1: 配置往返一致性 (Config Round-Trip)

*For any* 合法的 `RoutingConfig` 对象，将其序列化为 JSON 字符串后再解析回对象，所得结果 SHALL 与原对象等价。

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 2: 未知字段不影响解析

*For any* 合法的 `RoutingConfig` JSON 字符串，在其中添加任意未知字段后解析，所得 `RoutingConfig` 对象 SHALL 与不含未知字段时的解析结果等价。

**Validates: Requirements 6.5**

### Property 3: 配置校验捕获缺失必填字段

*For any* `RoutingConfig` JSON 对象，若移除任一必填字段，`ConfigLoader.validate()` SHALL 返回包含该字段名称的校验错误。

**Validates: Requirements 2.5, 6.4**

### Property 4: 配置校验捕获无效 Provider 引用

*For any* `RoutingConfig` 对象，若 `routing` 中某条目引用的 `provider` 名称不在 `providers` 列表中，`ConfigLoader.validate()` SHALL 返回校验错误。

**Validates: Requirements 2.6**

### Property 5: 缺失/未知 TaskType 回退到 default 路由

*For any* `LLMRequest`，若其 `taskType` 未指定或在 `routing` 配置中不存在，`LLMRouter.resolveRoute()` SHALL 返回 `default` 对应的路由规则。

**Validates: Requirements 1.2, 3.2, 5.2**

### Property 6: 已知 TaskType 路由到正确 Provider

*For any* `RoutingConfig` 和 `LLMRequest`，若 `taskType` 在 `routing` 中已定义，`LLMRouter.resolveRoute()` SHALL 返回该 `taskType` 对应的路由规则，且主 provider 与配置一致。

**Validates: Requirements 3.1**

### Property 7: 参数合并请求优先

*For any* `LLMRequest` 和 `TaskRoute`，合并后的请求中 `temperature` 和 `maxTokens` SHALL 优先使用请求自身的值；仅当请求未指定时，才使用路由配置中的值。

**Validates: Requirements 3.3**

### Property 8: Fallback 链在可重试错误时依次执行

*For any* 配置了 fallback 链的路由，当主模型返回可重试错误（429 或 5xx）且重试耗尽时，Router SHALL 按 fallback 链顺序尝试下一个提供商，且每个提供商独立执行重试逻辑。

**Validates: Requirements 4.1, 4.3**

### Property 9: 全部失败时聚合错误包含所有尝试记录

*For any* fallback 链中所有提供商均失败的场景，抛出的 `AggregateRouterError` 的 `attempts` 数组长度 SHALL 等于主模型 + fallback 链的提供商总数，且每条记录包含 provider 名称和错误信息。

**Validates: Requirements 4.2**

### Property 10: 不可重试错误跳过 Fallback

*For any* `LLMRequest`，当主模型返回不可重试错误（HTTP 400、401、403）时，Router SHALL 直接抛出该错误，不尝试 fallback 链中的任何提供商。

**Validates: Requirements 4.5**

### Property 11: 语言解析与指令注入

*For any* `LLMRequest` 和 `RoutingConfig`，有效语言 SHALL 按以下优先级确定：请求的 `language`（若为支持的语言）> 配置的 `defaultLanguage`。Router SHALL 在 `systemPrompt` 前注入对应语言的指令文本。对于不支持的语言值，SHALL 回退到 `defaultLanguage`。

**Validates: Requirements 7.3, 7.4, 7.5**

## 错误处理

| 场景 | 处理方式 | 需求 |
|------|---------|------|
| 配置文件不存在 | 回退到环境变量，构建单提供商配置 | 2.4, 5.1 |
| 配置文件格式无效 | 抛出含具体校验错误的异常，阻止启动 | 2.5 |
| routing 引用不存在的 provider | 校验阶段报错，阻止启动 | 2.6 |
| taskType 未匹配 | 回退到 `default` 路由 | 1.2, 3.2 |
| 主模型可重试错误 (429/5xx) | 重试耗尽后按 fallback 链切换 | 4.1 |
| 主模型不可重试错误 (400/401/403) | 直接抛出，跳过 fallback | 4.5 |
| 所有提供商均失败 | 抛出 `AggregateRouterError`，含所有尝试记录 | 4.2 |
| 不支持的语言代码 | 回退到 `defaultLanguage` | 7.5 |
| 环境变量未设置且无配置文件 | 抛出配置缺失错误 | 5.1 |

## 测试策略

### 测试框架

- 单元测试与属性测试：Vitest + fast-check
- 每个属性测试至少运行 100 次迭代

### 单元测试

覆盖具体示例和边界情况：
- ConfigLoader：加载有效/无效配置文件、环境变量回退、环境变量覆盖 apiKey
- LLMRouter：TaskType 枚举值验证、单提供商向后兼容模式
- 语言指令：默认语言为 `en`、支持 `en`/`zh` 两种语言
- Fallback 日志：验证每次切换时记录了正确的日志信息

### 属性测试

每个正确性属性对应一个独立的属性测试：

| 属性 | 测试标签 | 生成器 |
|------|---------|--------|
| Property 1 | Feature: multi-model-routing, Property 1: Config round-trip | 随机生成合法 RoutingConfig |
| Property 2 | Feature: multi-model-routing, Property 2: Unknown fields ignored | 合法 RoutingConfig + 随机未知字段 |
| Property 3 | Feature: multi-model-routing, Property 3: Missing field validation | 合法 RoutingConfig 随机移除必填字段 |
| Property 4 | Feature: multi-model-routing, Property 4: Invalid provider reference | RoutingConfig 中 routing 引用不存在的 provider |
| Property 5 | Feature: multi-model-routing, Property 5: Default route fallback | 随机 LLMRequest（无 taskType 或未知 taskType） |
| Property 6 | Feature: multi-model-routing, Property 6: Known taskType routing | 随机 RoutingConfig + 匹配的 taskType |
| Property 7 | Feature: multi-model-routing, Property 7: Parameter merge priority | 随机 LLMRequest + TaskRoute 参数组合 |
| Property 8 | Feature: multi-model-routing, Property 8: Fallback chain execution | 模拟主模型可重试失败 + fallback 成功 |
| Property 9 | Feature: multi-model-routing, Property 9: Aggregate error completeness | 模拟所有提供商失败 |
| Property 10 | Feature: multi-model-routing, Property 10: Non-retryable skips fallback | 模拟不可重试错误 |
| Property 11 | Feature: multi-model-routing, Property 11: Language resolution | 随机语言值（支持/不支持）+ RoutingConfig |

### 属性测试库

使用 `fast-check`（项目已有依赖），配合 Vitest 的 `it` 测试用例。每个属性测试以注释标注对应的设计属性编号和需求编号。
