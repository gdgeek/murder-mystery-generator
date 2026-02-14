# 需求文档：会话韧性与错误恢复

## 简介

当前分阶段创作工作流已具备基本的错误处理（`failed` 状态 + `retry`），但在实际使用中仍存在让用户"卡住"的场景：LLM 调用中途失败导致前半段成果丢失、AI Key 过期后无法更换、session ID 不够显眼导致无法恢复、以及每步 token 花费不透明。本功能聚焦于提升流程韧性，确保用户在任何出错场景下都能优雅地恢复，不丢失已有成果。

核心原则：
- **接口原子化、单一职责**：每个 API 端点只做一件事，复杂的恢复编排逻辑放在 UI 层
- **永不丢失已有成果**：每个阶段的中间产出在生成完成后立即持久化，失败不影响已保存的内容
- **session ID 是用户的"存档号"**：明确展示给用户，用户可以随时通过它恢复进度
- **每步报告 token 花费**：每次 LLM 调用后，返回本次调用的 token 用量和累计用量

## 术语表

- **Step_Token_Report（步骤Token报告）**：单次 LLM 调用的 token 用量快照，包含 promptTokens、completionTokens、totalTokens
- **Session_Resume（会话恢复）**：用户通过 session ID 重新加载一个之前的创作会话，继续未完成的工作
- **AI_Key_Update（AI密钥更新）**：在会话进行中更换临时 AI 配置（如 API Key 过期或额度用完时）
- **Checkpoint（检查点）**：每个阶段产出物生成成功后的持久化保存点，确保失败不影响已保存内容
- **Graceful_Degradation（优雅降级）**：并行批量生成中部分失败时，保留成功的章节，仅重试失败的部分

## 需求

### 需求 1：每步 Token 用量报告

**用户故事：** 作为剧本创作者，我希望每次 LLM 调用后能看到本次花费了多少 token，以及累计花费，以便我掌控成本。

#### 验收标准

1. WHEN 任何 LLM 调用（planning、designing、chapter 生成）完成后，THE AuthoringSession SHALL 在响应中包含 `lastStepTokens` 字段，记录本次调用的 promptTokens、completionTokens、totalTokens
2. WHEN 客户端轮询 `GET /api/authoring-sessions/:id` 时，THE Response SHALL 同时包含 `tokenUsage`（累计）和 `lastStepTokens`（最近一次调用）
3. WHEN 并行批量生成完成后，THE `lastStepTokens` SHALL 为该批次所有成功调用的 token 用量之和
4. WHEN LLM 调用失败时，THE `lastStepTokens` SHALL 不更新（保留上一次成功调用的值）

### 需求 2：Session ID 显性化与会话恢复

**用户故事：** 作为剧本创作者，我希望 session ID 被明确展示给我，并且我可以通过它随时恢复之前的创作进度。

#### 验收标准

1. WHEN 创作会话创建成功后，THE UI SHALL 在显眼位置展示完整的 session ID，并提供一键复制功能
2. WHEN 用户输入一个 session ID 并请求恢复时，THE Backend SHALL 通过 `GET /api/authoring-sessions/:id` 返回完整的会话状态，包括所有已保存的阶段产出物
3. WHEN 用户通过 session ID 恢复会话时，THE UI SHALL 根据会话当前状态自动跳转到对应的步骤，并恢复所有已有内容的显示
4. WHEN 恢复的会话处于 `failed` 状态时，THE UI SHALL 显示失败原因和可用的恢复操作（重试、更换 AI Key）
5. WHEN 恢复的会话处于生成中状态（planning/designing/executing/generating）时，THE UI SHALL 自动开始轮询等待结果

### 需求 3：会话中更换 AI 配置

**用户故事：** 作为剧本创作者，当 AI Key 过期或额度用完导致生成失败时，我希望能更换 AI 配置后继续，而不是从头开始。

#### 验收标准

1. THE Backend SHALL 提供 `PUT /api/authoring-sessions/:id/ai-config` 端点，接受新的 `ephemeralAiConfig`，仅在会话处于 `failed` 或 review 状态（`plan_review`、`design_review`、`chapter_review`）时允许更换
2. WHEN 更换 AI 配置成功后，THE Backend SHALL 用新配置创建新的临时适配器替换旧的，并更新 `aiConfigMeta`
3. WHEN 更换 AI 配置时会话处于非允许状态（如正在生成中）时，THE Backend SHALL 返回 HTTP 409 Conflict，提示当前状态不允许更换
4. WHEN 更换 AI 配置后用户触发重试时，THE Backend SHALL 使用新的适配器进行 LLM 调用
5. THE UI SHALL 在失败状态下显示"更换 AI 配置"按钮，点击后弹出 AI 配置表单，提交后自动触发重试

### 需求 4：并行批量生成的部分失败恢复

**用户故事：** 作为剧本创作者，当并行生成多个章节时如果部分失败，我希望保留成功的章节，只重试失败的部分。

#### 验收标准

1. WHEN 并行批量生成中部分章节失败时，THE AuthoringSession SHALL 保存所有成功生成的章节，并在 `parallelBatch.failedIndices` 中记录失败的章节索引
2. WHEN 存在失败章节时，THE AuthoringSession SHALL 进入 `chapter_review` 状态，允许用户先审阅已成功的章节
3. THE Backend SHALL 提供 `POST /api/authoring-sessions/:id/retry-failed-chapters` 端点，仅重新生成 `parallelBatch.failedIndices` 中记录的失败章节
4. WHEN 重试失败章节成功后，THE AuthoringSession SHALL 将新生成的章节合并到已有章节列表中，并清除对应的 failedIndices
5. WHEN 用户在 `chapter_review` 状态下审阅完所有成功章节后，THE UI SHALL 提示存在未生成的失败章节，并提供"重试失败章节"按钮

### 需求 5：阶段产出物的检查点保存

**用户故事：** 作为剧本创作者，我希望每个阶段的成果在生成完成后立即保存，即使后续步骤失败也不会丢失前面的工作。

#### 验收标准

1. WHEN planning 阶段的 Script_Plan 生成成功后，THE AuthoringService SHALL 立即将 planOutput 持久化到数据库，然后再进行状态转换
2. WHEN designing 阶段的 Script_Outline 生成成功后，THE AuthoringService SHALL 立即将 outlineOutput 持久化到数据库，然后再进行状态转换
3. WHEN 章节生成成功后（无论单个还是批量），THE AuthoringService SHALL 立即将成功的章节持久化到数据库
4. WHEN 会话从 `failed` 状态恢复重试时，THE AuthoringService SHALL 保留所有之前已成功保存的阶段产出物，不清除任何已有数据
5. WHEN 用户通过 session ID 恢复会话时，THE Backend SHALL 返回所有已持久化的阶段产出物，即使会话当前处于 `failed` 状态

### 需求 6：UI 层的恢复流程编排

**用户故事：** 作为剧本创作者，我希望在出错时 UI 能清晰地引导我进行恢复操作，而不是让我面对一个无法操作的界面。

#### 验收标准

1. WHEN 会话进入 `failed` 状态时，THE UI SHALL 显示：失败原因、"重试"按钮、"更换 AI 配置并重试"按钮、已完成的阶段产出物（可查看但不可编辑）
2. WHEN 用户点击"重试"时，THE UI SHALL 调用 `POST /retry` 然后 `POST /advance`，并开始轮询
3. WHEN 用户点击"更换 AI 配置并重试"时，THE UI SHALL 先弹出 AI 配置表单，验证通过后调用 `PUT /ai-config`，再调用 `POST /retry` 和 `POST /advance`
4. THE UI SHALL 在页面顶部提供"恢复会话"入口，用户可输入 session ID 恢复之前的创作
5. THE UI SHALL 在创建会话后将 session ID 写入 URL hash（已有）并在 session 信息区域显眼展示，附带复制按钮
6. WHEN 并行批量生成存在失败章节时，THE UI SHALL 在章节审阅界面显示失败章节列表和"重试失败章节"按钮
