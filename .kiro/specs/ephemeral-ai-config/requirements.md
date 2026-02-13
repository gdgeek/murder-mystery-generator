# 需求文档：临时 AI 配置（Ephemeral AI Config）

## 简介

当服务器未预配置 AI 提供商信息（无 API Key、Endpoint 等）时，前端 UI 提供一个 AI 配置输入区域，让用户在创建剧本时临时输入 AI 信息。用户输入的 AI 信息仅用于当前这一次剧本生成会话，生成完成后不会保留在服务器的任何持久化存储中。如果服务器已配置 AI，则不显示该输入区域，直接使用服务器配置。

## 术语表

- **Ephemeral_AI_Config（临时AI配置）**：用户通过前端输入的一次性 AI 提供商信息，包含 provider、apiKey、endpoint、model，仅在当前会话生命周期内有效
- **AI_Status（AI状态）**：服务器当前 AI 配置的可用性状态，分为 `configured`（已配置）和 `unconfigured`（未配置）
- **AI_Config_Form（AI配置表单）**：前端用于输入临时 AI 信息的表单组件
- **Temporary_Adapter（临时适配器）**：基于用户提供的临时 AI 配置创建的 LLM 适配器实例，不持久化，会话结束后销毁

## 需求

### 需求 1：AI 配置状态检测

**用户故事：** 作为用户，我希望系统能自动检测服务器是否已配置 AI，以便决定是否需要我手动输入 AI 信息。

#### 验收标准

1. THE Backend SHALL 提供 `GET /api/ai-status` 端点，返回当前 AI 配置状态（`configured` 或 `unconfigured`）
2. WHEN 服务器存在有效的 LLM 配置（通过 `config/llm-routing.json` 或环境变量 `LLM_API_KEY`）时，THE Backend SHALL 返回 `{ status: "configured", provider: "<provider_name>" }`
3. WHEN 服务器不存在有效的 LLM 配置时，THE Backend SHALL 返回 `{ status: "unconfigured" }`
4. THE Frontend SHALL 在页面加载时调用 `GET /api/ai-status` 检测 AI 配置状态

### 需求 2：前端 AI 配置输入表单

**用户故事：** 作为用户，当服务器未配置 AI 时，我希望在 UI 上输入 AI 信息，以便使用自己的 AI 服务生成剧本。

#### 验收标准

1. WHEN AI_Status 为 `unconfigured` 时，THE AI_Config_Form SHALL 在剧本配置表单上方显示 AI 配置输入区域
2. THE AI_Config_Form SHALL 提供以下输入字段：provider（下拉选择：openai / anthropic / doubao / custom）、apiKey（密码输入框）、endpoint（文本输入，根据 provider 自动填充默认值）、model（文本输入，根据 provider 自动填充默认值）
3. WHEN 用户选择 provider 时，THE AI_Config_Form SHALL 自动填充该 provider 的默认 endpoint 和 model 值（用户可修改）
4. WHEN AI_Status 为 `configured` 时，THE AI_Config_Form SHALL 不显示，前端使用服务器已有配置
5. WHEN 用户提交包含 AI 配置的表单时，THE AI_Config_Form SHALL 校验 apiKey 非空、endpoint 为有效 URL 格式、model 非空
6. IF AI 配置校验失败，THEN THE AI_Config_Form SHALL 在对应字段旁显示中文错误提示

### 需求 3：临时 AI 配置传递

**用户故事：** 作为用户，我希望输入的 AI 信息能随剧本生成请求一起发送到后端，以便后端使用我的 AI 服务。

#### 验收标准

1. WHEN 用户创建创作会话（`POST /api/authoring-sessions`）且 AI_Status 为 `unconfigured` 时，THE Frontend SHALL 在请求体中附加 `ephemeralAiConfig` 字段，包含 provider、apiKey、endpoint、model
2. WHEN 后端收到包含 `ephemeralAiConfig` 的创建会话请求时，THE Backend SHALL 使用该配置创建 Temporary_Adapter 用于本次会话的所有 LLM 调用
3. WHEN 后端收到不包含 `ephemeralAiConfig` 的请求且服务器已配置 AI 时，THE Backend SHALL 使用服务器默认的 LLM 适配器
4. WHEN 后端收到不包含 `ephemeralAiConfig` 的请求且服务器未配置 AI 时，THE Backend SHALL 返回 HTTP 400 错误，提示需要提供 AI 配置

### 需求 4：临时配置安全与生命周期

**用户故事：** 作为用户，我希望我输入的 AI 信息不会被服务器保存，以保护我的 API Key 安全。

#### 验收标准

1. THE Backend SHALL NOT 将 `ephemeralAiConfig` 中的 apiKey 写入数据库、文件系统或任何持久化存储
2. THE Backend SHALL 仅在内存中持有 Temporary_Adapter，当创作会话完成（`completed`）或失败（`failed`）后，THE Backend SHALL 释放该 Temporary_Adapter 引用
3. WHEN 将 AuthoringSession 序列化存储到数据库时，THE Backend SHALL 排除 `ephemeralAiConfig` 中的 apiKey 字段，仅保留 provider 和 model 信息用于显示
4. THE Backend SHALL 在 API 响应中不返回 apiKey 字段

### 需求 5：临时配置连通性验证

**用户故事：** 作为用户，我希望在开始生成前验证我输入的 AI 信息是否有效，以避免生成过程中因配置错误而失败。

#### 验收标准

1. THE Backend SHALL 提供 `POST /api/ai-status/verify` 端点，接受 `ephemeralAiConfig` 参数，验证 AI 配置的连通性
2. WHEN 验证请求发送时，THE Backend SHALL 使用提供的配置创建临时适配器并发送一个轻量级测试请求（如简短 prompt）
3. WHEN 测试请求成功时，THE Backend SHALL 返回 `{ valid: true, provider: "<name>", model: "<model>" }`
4. WHEN 测试请求失败时，THE Backend SHALL 返回 `{ valid: false, error: "<error_message>" }`
5. THE Frontend SHALL 在用户提交 AI 配置后、创建会话前调用验证端点，验证通过后才允许继续
