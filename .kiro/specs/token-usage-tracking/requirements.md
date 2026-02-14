# 需求文档：Token 用量追踪

## 简介

在创作工作流 UI 中追踪并展示 AI Token 消耗情况。当前系统在每次 LLM 调用后返回 `tokenUsage`（prompt / completion / total），但该数据仅被打印到控制台日志，未被持久化或暴露给前端。本功能将在每个创作会话（AuthoringSession）中累计所有 LLM 调用的 Token 用量，通过现有会话 API 暴露给客户端，并在测试 UI 中实时展示。

## 术语表

- **Token_Usage_Tracker**：负责累计和管理单个创作会话中所有 LLM 调用 Token 用量的组件
- **AuthoringSession**：创作会话对象，贯穿整个分步创作工作流
- **TokenUsage**：已有类型，包含 `prompt`、`completion`、`total` 三个数值字段
- **CumulativeTokenUsage**：会话级累计 Token 用量数据结构，包含累计的 prompt、completion、total 以及 LLM 调用次数
- **LLMAdapter**：负责向 LLM 发送请求并返回包含 `tokenUsage` 的响应的适配器
- **Authoring_UI**：内嵌测试 UI，展示分步创作工作流的前端页面

## 需求

### 需求 1：会话级 Token 用量累计

**用户故事：** 作为开发者，我希望系统在每次 LLM 调用后自动累计 Token 用量到当前会话，以便追踪整个创作过程的 AI 消耗。

#### 验收标准

1. WHEN AuthoringService 完成一次 LLM 调用并收到 LLMResponse, THE Token_Usage_Tracker SHALL 将该次调用的 prompt、completion、total 值累加到会话的 CumulativeTokenUsage 中
2. WHEN AuthoringService 完成一次 LLM 调用, THE Token_Usage_Tracker SHALL 将 LLM 调用次数（callCount）递增 1
3. WHEN 多个章节并行生成时, THE Token_Usage_Tracker SHALL 正确累计所有并行 LLM 调用的 Token 用量，不丢失任何调用的数据
4. THE CumulativeTokenUsage SHALL 包含 promptTokens、completionTokens、totalTokens 和 callCount 四个数值字段，且所有字段初始值为 0

### 需求 2：Token 用量数据持久化与 API 暴露

**用户故事：** 作为前端开发者，我希望通过现有的会话 API 获取 Token 用量数据，以便在 UI 中展示。

#### 验收标准

1. THE AuthoringSession 类型 SHALL 包含一个 `tokenUsage` 字段，类型为 CumulativeTokenUsage
2. WHEN 客户端调用 `GET /api/authoring-sessions/:id`, THE 系统 SHALL 在响应中包含该会话的累计 tokenUsage 数据
3. WHEN 会话状态更新被保存到数据库时, THE 系统 SHALL 同时持久化当前的 CumulativeTokenUsage 数据

### 需求 3：UI 实时展示 Token 消耗

**用户故事：** 作为用户，我希望在创作工作流 UI 中实时看到当前会话的 Token 消耗情况，以便了解 AI 资源使用量。

#### 验收标准

1. WHILE 创作会话处于活跃状态（非 draft、非 completed）, THE Authoring_UI SHALL 在页面上展示当前会话的累计 Token 用量信息
2. WHEN UI 通过轮询获取到新的会话数据时, THE Authoring_UI SHALL 更新页面上显示的 Token 用量数值
3. THE Authoring_UI SHALL 分别展示 prompt tokens、completion tokens、total tokens 和 LLM 调用次数
4. WHEN 会话处于 completed 状态时, THE Authoring_UI SHALL 展示最终的 Token 用量汇总

### 需求 4：Token 用量累计的正确性保证

**用户故事：** 作为开发者，我希望 Token 用量的累计计算是准确的，以便信任展示的数据。

#### 验收标准

1. FOR ALL 有效的 TokenUsage 值序列, THE Token_Usage_Tracker 累计后的 totalTokens SHALL 等于所有单次调用 total 值之和
2. FOR ALL 有效的 TokenUsage 值序列, THE Token_Usage_Tracker 累计后的 promptTokens SHALL 等于所有单次调用 prompt 值之和
3. FOR ALL 有效的 TokenUsage 值序列, THE Token_Usage_Tracker 累计后的 completionTokens SHALL 等于所有单次调用 completion 值之和
4. FOR ALL CumulativeTokenUsage 状态, THE totalTokens SHALL 等于 promptTokens 加 completionTokens
5. IF 某次 LLM 调用失败（未返回 TokenUsage）, THEN THE Token_Usage_Tracker SHALL 保持当前累计值不变，不累加任何数据
