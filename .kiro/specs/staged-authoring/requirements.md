# 需求文档：分阶段剧本创作工作流

## 简介

本功能为剧本杀AI生成后端新增分阶段创作工作流（Staged Authoring），灵感来源于Kiro的规格驱动开发流程。当前系统仅支持一键生成完整剧本（通过 `GeneratorService.generate(config)` 方法），本功能将生成过程拆分为三个阶段——企划（Planning）、大纲（Design）、生成（Execution）——每个阶段的产出物可由作者审阅、编辑和批准后再进入下一阶段。同时保留"一键生成模式"（Vibe Mode）作为快速生成选项，让作者可以在结构化创作和快速生成之间自由选择。

## 术语表

- **Authoring_Session（创作会话）**：一次完整的剧本创作过程实例，跟踪从草稿到完成的全部状态和阶段产出物
- **Script_Plan（企划书）**：企划阶段的产出物，包含世界观概述、角色概念、核心诡计方向、主题基调、时代氛围等高层设计
- **Script_Outline（剧本大纲）**：大纲阶段的产出物，包含详细时间线、角色关系图谱、诡计机制细节、线索链设计、分支结构骨架、轮次流程等中层设计
- **Chapter（章节）**：生成阶段中的一个独立生成单元，如DM手册、某个玩家手册、游戏物料集或分支结构详情
- **Author_Edit（作者编辑）**：作者对LLM生成内容的修改记录，包含原始版本和修改后版本
- **Phase_Output（阶段产出物）**：某个阶段的完整输出，包含LLM原始生成内容和作者编辑后的最终版本
- **Staged_Mode（分阶段模式）**：三阶段结构化创作模式，作者逐步审阅批准
- **Vibe_Mode（一键生成模式）**：跳过分阶段流程，直接调用现有 `generate` 方法一次性生成完整剧本
- **Generator（生成引擎）**：现有的核心AI生成模块，本功能对其进行扩展而非替换
- **Config（配置参数）**：现有的剧本生成参数配置对象（ScriptConfig）
- **Session_State（会话状态）**：创作会话的当前状态，遵循预定义的状态机转换规则

## 需求

### 需求 1：创作会话管理

**用户故事：** 作为剧本创作者，我希望创建一个创作会话来跟踪整个分阶段创作过程，以便我能随时查看进度、暂停和恢复创作。

#### 验收标准

1. WHEN 作者提交有效的 Config 并选择创作模式时，THE Authoring_Session SHALL 创建一个新的会话实例，包含唯一标识符、关联的 Config 引用、选择的模式（staged 或 vibe）和初始状态 `draft`
2. WHEN 作者查询某个 Authoring_Session 时，THE Authoring_Session SHALL 返回会话的完整状态信息，包括当前阶段、各阶段产出物和创建/更新时间
3. WHEN 作者查询会话列表时，THE Authoring_Session SHALL 支持按 configId 和当前状态进行筛选
4. WHEN Authoring_Session 被创建或更新时，THE Authoring_Session SHALL 将会话数据持久化存储到数据库
5. WHEN Authoring_Session 的状态发生变更时，THE Authoring_Session SHALL 记录状态变更时间戳
6. WHEN 将 Authoring_Session 序列化为 JSON 后再反序列化时，THE Authoring_Session SHALL 产生与原始数据等价的结果（往返一致性）

### 需求 2：创作会话状态机

**用户故事：** 作为剧本创作者，我希望创作过程遵循明确的阶段流转规则，以便我清楚当前所处阶段以及下一步操作。

#### 验收标准

1. THE Authoring_Session SHALL 支持以下状态集合：`draft`、`planning`、`plan_review`、`designing`、`design_review`、`executing`、`chapter_review`、`completed`、`generating`、`failed`
2. WHEN Authoring_Session 处于分阶段模式时，THE Session_State SHALL 仅允许以下状态转换路径：`draft → planning → plan_review → designing → design_review → executing → chapter_review → completed`，以及 `chapter_review → executing`（重新生成章节时）
3. WHEN Authoring_Session 处于一键生成模式时，THE Session_State SHALL 仅允许以下状态转换路径：`draft → generating → completed`
4. WHEN 请求一个不合法的状态转换时，THE Session_State SHALL 拒绝该转换并返回包含当前状态和目标状态的错误信息
5. IF 任何阶段的 LLM 调用失败，THEN THE Session_State SHALL 转换到 `failed` 状态，并记录失败原因和失败时的阶段信息
6. WHEN Authoring_Session 处于 `failed` 状态时，THE Session_State SHALL 允许重试操作，将状态回退到失败前的阶段起始状态

### 需求 3：企划阶段（Planning Phase）

**用户故事：** 作为剧本创作者，我希望系统先生成一份高层企划书供我审阅，以便我在投入详细设计之前确认整体方向。

#### 验收标准

1. WHEN Authoring_Session 从 `draft` 转换到 `planning` 状态时，THE Generator SHALL 基于关联的 Config 和匹配的 Skill 模板调用 LLM 生成 Script_Plan
2. WHEN Generator 生成 Script_Plan 时，THE Script_Plan SHALL 包含以下内容：世界观概述、角色概念列表（每个角色包含名称、角色定位、关系草图）、核心诡计方向、主题基调、时代氛围描述
3. WHEN Script_Plan 生成完成后，THE Authoring_Session SHALL 将状态转换为 `plan_review`，并将 Script_Plan 存储为该阶段的 Phase_Output
4. WHEN 作者在 `plan_review` 状态下提交编辑内容时，THE Authoring_Session SHALL 保存 Author_Edit 记录，包含 LLM 原始生成的 Script_Plan 和作者修改后的版本
5. WHEN 作者在 `plan_review` 状态下批准 Script_Plan 时，THE Authoring_Session SHALL 将状态转换为 `designing`，并将批准后的 Script_Plan（含作者编辑）作为下一阶段的输入
6. WHEN 作者在 `plan_review` 状态下提交附加备注时，THE Authoring_Session SHALL 将备注内容关联到 Script_Plan，供后续阶段的 LLM 提示词引用

### 需求 4：大纲阶段（Design Phase）

**用户故事：** 作为剧本创作者，我希望在企划批准后系统生成详细的剧本大纲，以便我在生成完整内容前审阅和调整剧本结构。

#### 验收标准

1. WHEN Authoring_Session 进入 `designing` 状态时，THE Generator SHALL 基于批准后的 Script_Plan、Config 和匹配的 Skill 模板调用 LLM 生成 Script_Outline
2. WHEN Generator 生成 Script_Outline 时，THE Script_Outline SHALL 包含以下内容：详细时间线、角色关系图谱（每对角色间的关系描述）、诡计机制细节、线索链设计（线索之间的逻辑关联）、分支结构骨架（主要分支点和结局方向）、轮次流程概要
3. WHEN Script_Outline 生成完成后，THE Authoring_Session SHALL 将状态转换为 `design_review`，并将 Script_Outline 存储为该阶段的 Phase_Output
4. WHEN 作者在 `design_review` 状态下提交编辑内容时，THE Authoring_Session SHALL 保存 Author_Edit 记录，包含 LLM 原始生成的 Script_Outline 和作者修改后的版本
5. WHEN 作者在 `design_review` 状态下批准 Script_Outline 时，THE Authoring_Session SHALL 将状态转换为 `executing`，并将批准后的 Script_Outline（含作者编辑）作为下一阶段的输入
6. WHEN Generator 生成 Script_Outline 时，THE Generator SHALL 在 LLM 提示词中包含作者在企划阶段添加的备注内容

### 需求 5：生成阶段（Execution Phase）

**用户故事：** 作为剧本创作者，我希望系统按章节逐步生成完整剧本内容，以便我能逐一审阅每个章节并在需要时请求重新生成。

#### 验收标准

1. WHEN Authoring_Session 进入 `executing` 状态时，THE Generator SHALL 基于批准后的 Script_Outline 和 Config 按以下顺序逐章节生成内容：DM手册、各玩家手册（每个玩家一个章节）、游戏物料集、分支结构详情
2. WHEN Generator 完成一个 Chapter 的生成后，THE Authoring_Session SHALL 将状态转换为 `chapter_review`，并将该 Chapter 存储为可独立审阅的单元
3. WHEN 作者在 `chapter_review` 状态下批准当前 Chapter 时，THE Authoring_Session SHALL 检查是否还有未生成的章节：若有则将状态转回 `executing` 继续生成下一章节；若所有章节均已批准则将状态转换为 `completed`
4. WHEN 作者在 `chapter_review` 状态下请求重新生成当前 Chapter 时，THE Generator SHALL 重新调用 LLM 生成该章节内容，并保留之前的生成版本作为历史记录
5. WHEN 作者在 `chapter_review` 状态下提交对当前 Chapter 的编辑时，THE Authoring_Session SHALL 保存 Author_Edit 记录，包含 LLM 原始生成内容和作者修改后的版本
6. WHEN 所有 Chapter 生成并批准完成后，THE Authoring_Session SHALL 将所有章节内容组装为一个完整的 Script 对象，其结构与现有 `generate` 方法的输出格式一致
7. WHEN Generator 生成各 Chapter 时，THE Generator SHALL 在 LLM 提示词中包含已批准的前序章节内容，确保章节间的一致性

### 需求 6：一键生成模式（Vibe Mode）

**用户故事：** 作为剧本创作者，我希望能选择跳过分阶段流程直接生成完整剧本，以便在不需要精细控制时快速获得结果。

#### 验收标准

1. WHEN 作者创建 Authoring_Session 并选择 vibe 模式时，THE Authoring_Session SHALL 将状态从 `draft` 直接转换为 `generating`
2. WHEN Authoring_Session 处于 `generating` 状态时，THE Generator SHALL 调用现有的 `generate(config)` 方法生成完整 Script
3. WHEN 一键生成完成后，THE Authoring_Session SHALL 将生成的 Script 关联到会话，并将状态转换为 `completed`
4. WHEN 一键生成模式的 Authoring_Session 完成后，THE Authoring_Session SHALL 提供与分阶段模式相同格式的 Script 输出

### 需求 7：阶段产出物存储与编辑追踪

**用户故事：** 作为剧本创作者，我希望系统保存每个阶段的LLM原始输出和我的编辑记录，以便我能回顾创作过程和对比修改内容。

#### 验收标准

1. WHEN Generator 完成某阶段的 LLM 调用后，THE Phase_Output SHALL 以 JSON 文档形式存储 LLM 原始生成内容
2. WHEN 作者提交编辑时，THE Author_Edit SHALL 记录编辑时间戳、原始内容引用和修改后的完整内容
3. WHEN 查询某阶段的 Phase_Output 时，THE Phase_Output SHALL 同时返回 LLM 原始版本和作者最终编辑版本（若有编辑）
4. WHEN 将 Phase_Output 序列化为 JSON 后再反序列化时，THE Phase_Output SHALL 产生与原始数据等价的结果（往返一致性）
5. WHEN 将 Author_Edit 序列化为 JSON 后再反序列化时，THE Author_Edit SHALL 产生与原始数据等价的结果（往返一致性）

### 需求 8：分阶段创作 REST API

**用户故事：** 作为前端开发者，我希望后端提供清晰的REST API来驱动分阶段创作流程，以便前端能实现完整的创作交互界面。

#### 验收标准

1. WHEN 前端发送创建会话请求时，THE API SHALL 提供 `POST /api/authoring-sessions` 端点，接受 configId 和 mode（staged/vibe）参数，返回创建的 Authoring_Session
2. WHEN 前端查询会话详情时，THE API SHALL 提供 `GET /api/authoring-sessions/:id` 端点，返回会话完整状态和各阶段产出物
3. WHEN 前端触发下一阶段时，THE API SHALL 提供 `POST /api/authoring-sessions/:id/advance` 端点，驱动状态机前进到下一阶段并触发相应的 LLM 生成
4. WHEN 前端提交阶段编辑时，THE API SHALL 提供 `PUT /api/authoring-sessions/:id/phases/:phase/edit` 端点，保存作者对当前阶段产出物的编辑
5. WHEN 前端批准当前阶段时，THE API SHALL 提供 `POST /api/authoring-sessions/:id/phases/:phase/approve` 端点，批准当前阶段并触发下一阶段
6. WHEN 前端请求重新生成章节时，THE API SHALL 提供 `POST /api/authoring-sessions/:id/chapters/:chapterIndex/regenerate` 端点，重新生成指定章节
7. WHEN API 请求参数不合法时，THE API SHALL 返回 HTTP 400 状态码和具体的错误描述
8. WHEN API 请求的资源不存在时，THE API SHALL 返回 HTTP 404 状态码和资源标识信息
