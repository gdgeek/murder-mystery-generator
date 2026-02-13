# 需求文档：Bootstrap 前端配置界面

## 简介

为剧本杀 AI 生成工具构建一个基于 Bootstrap 5 的前端 Web 界面，作为 pnpm monorepo 中的 `packages/web` 包。采用静态 HTML + 原生 JavaScript（TypeScript 编译）的轻量方案，通过 Bootstrap 5 CDN 引入样式，调用已有的 Express 后端 API 完成剧本配置创建、生成任务发起与状态跟踪、剧本列表浏览等核心功能。界面语言为中文。

## 术语表

- **Frontend**：基于 Bootstrap 5 的前端 Web 应用，位于 `packages/web`，使用 Vite 构建
- **API_Client**：前端中封装 HTTP 请求的模块，负责与后端 API 通信
- **Config_Form**：剧本配置创建表单组件
- **Round_Preview**：轮次结构预览组件，根据时长自动计算并展示轮次结构
- **Generation_Tracker**：生成任务状态跟踪组件，轮询后端获取生成进度
- **Script_List**：剧本列表浏览组件
- **ScriptConfig**：剧本生成配置数据模型（包含 playerCount、durationHours、gameType、ageGroup、restorationRatio、deductionRatio、era、location、theme、language、roundStructure、specialSetting 等字段）
- **RoundStructure**：轮次结构数据模型，包含每轮的阅读、搜证、讨论时间分配
- **SpecialSetting**：新本格特殊设定数据模型，包含设定类型、描述和限制条件

## 需求

### 需求 1：项目初始化与基础架构

**用户故事：** 作为开发者，我希望前端项目作为 monorepo 中的独立包正确初始化，以便与现有后端协同工作。

#### 验收标准

1. THE Frontend SHALL 作为 `packages/web` 包存在于 pnpm monorepo 中，包含独立的 `package.json`
2. THE Frontend SHALL 通过 CDN 链接引入 Bootstrap 5 CSS 和 JS
3. THE Frontend SHALL 使用 Vite 作为开发服务器和构建工具
4. THE Frontend SHALL 使用 TypeScript 编写业务逻辑
5. THE API_Client SHALL 提供统一的 HTTP 请求封装（基于 fetch API），所有 API 调用通过该模块发出
6. WHEN API_Client 发送请求时，THE API_Client SHALL 使用可配置的 base URL 作为 API 地址前缀
7. THE Frontend SHALL 采用单页面多视图结构，通过 hash 路由在不同视图之间切换

### 需求 2：剧本配置表单

**用户故事：** 作为用户，我希望通过表单配置剧本生成参数，以便指定游戏参数并启动剧本生成。

#### 验收标准

1. THE Config_Form SHALL 提供以下字段的输入控件：playerCount（数字输入，范围 1-6）、durationHours（数字输入，范围 2-6）、gameType（下拉选择：本格 honkaku / 新本格 shin_honkaku / 变格 henkaku）、ageGroup（下拉选择：小学生 elementary / 中学生 middle_school / 大学生 college / 成年人 adult）、restorationRatio（范围滑块 0-100）、deductionRatio（自动计算为 100 - restorationRatio 并显示）、era（文本输入）、location（文本输入）、theme（文本输入）、language（文本输入，默认值 zh）
2. WHEN restorationRatio 滑块值发生变化时，THE Config_Form SHALL 实时更新 deductionRatio 显示值为 100 减去 restorationRatio，确保两者之和始终为 100
3. WHEN 用户提交配置表单时，THE Config_Form SHALL 对所有字段进行前端校验：playerCount 为 1-6 的整数、durationHours 为 2-6 的整数、gameType 为有效枚举值、ageGroup 为有效枚举值、restorationRatio 为 0-100 的整数、era 非空、location 非空、theme 非空
4. IF 表单校验失败，THEN THE Config_Form SHALL 在对应字段旁显示具体的中文错误提示信息，使用 Bootstrap 的 is-invalid 样式类
5. WHEN 表单校验通过并提交时，THE API_Client SHALL 向 `POST /api/configs` 发送请求，成功后将返回的配置 ID 展示给用户

### 需求 3：新本格特殊设定（条件显示）

**用户故事：** 作为用户，当我选择新本格游戏类型时，我希望能配置特殊世界观设定。

#### 验收标准

1. WHEN gameType 选择为 shin_honkaku 时，THE Config_Form SHALL 显示特殊设定（specialSetting）的额外输入区域
2. THE Config_Form SHALL 在特殊设定区域提供以下控件：settingTypes 多选复选框（超能力 setting_superpower / 异世界 setting_fantasy / 特殊规则 setting_special_rule / 叙述性诡计 setting_narrative_trick）、settingDescription 多行文本域、settingConstraints 多行文本域
3. WHEN gameType 不是 shin_honkaku 时，THE Config_Form SHALL 隐藏特殊设定输入区域并清空其中的值
4. WHEN gameType 为 shin_honkaku 且用户提交表单时，THE Config_Form SHALL 校验 settingTypes 至少选择一项、settingDescription 非空

### 需求 4：轮次结构预览

**用户故事：** 作为用户，我希望在选择游戏时长后看到自动计算的轮次结构预览，以便了解游戏节奏。

#### 验收标准

1. WHEN durationHours 值发生变化时，THE Round_Preview SHALL 根据时长自动计算并展示轮次结构：2小时 2轮、3小时 3轮、4小时 4轮、5小时 4轮、6小时 5轮
2. THE Round_Preview SHALL 以表格或卡片形式展示每轮的阅读时间、搜证时间、讨论时间，以及总结时间、最终投票时间和真相揭示时间
3. THE Round_Preview SHALL 在 durationHours 为空或无效时显示占位提示文本

### 需求 5：生成任务发起与状态跟踪

**用户故事：** 作为用户，我希望在配置创建成功后发起剧本生成，并实时看到生成进度。

#### 验收标准

1. WHEN 配置创建成功后，THE Frontend SHALL 显示"开始生成"按钮，点击后向 `POST /api/scripts/generate` 发送请求（传入 configId）
2. WHEN 生成请求返回 202 响应时，THE Generation_Tracker SHALL 自动启动轮询，每 3 秒向 `GET /api/scripts/jobs/:jobId` 发送请求
3. WHILE Generation_Tracker 正在轮询时，THE Frontend SHALL 显示 Bootstrap spinner 加载指示器和当前任务状态文本
4. WHEN 轮询检测到任务状态变为 completed 时，THE Generation_Tracker SHALL 停止轮询并显示成功提示，提供查看剧本的链接
5. WHEN 轮询检测到任务状态变为 failed 时，THE Generation_Tracker SHALL 停止轮询并显示错误信息
6. IF 轮询请求连续失败 3 次，THEN THE Generation_Tracker SHALL 停止轮询并显示网络错误提示，提供手动重试按钮

### 需求 6：剧本列表浏览

**用户故事：** 作为用户，我希望浏览已生成的剧本列表，以便查看历史生成结果。

#### 验收标准

1. THE Script_List SHALL 以 Bootstrap 卡片列表形式展示剧本，每张卡片显示剧本标题、版本号、状态和创建时间
2. WHEN 页面加载时，THE API_Client SHALL 向 `GET /api/scripts` 发送请求获取剧本列表
3. WHEN 剧本列表为空时，THE Script_List SHALL 显示"暂无剧本"的占位提示
4. THE Script_List SHALL 支持分页加载，每页显示 10 条记录

### 需求 7：全局布局与导航

**用户故事：** 作为用户，我希望有清晰的导航结构，以便在不同功能之间快速切换。

#### 验收标准

1. THE Frontend SHALL 提供 Bootstrap Navbar 顶部导航栏，包含以下导航项：首页、创建配置、剧本列表
2. THE Frontend SHALL 使用 hash 路由（#/、#/config、#/scripts）实现视图切换，避免整页刷新
3. THE Frontend SHALL 采用响应式布局，在移动端和桌面端均可正常使用
4. WHEN API 请求发生错误时，THE Frontend SHALL 使用 Bootstrap Toast 组件显示统一的中文错误提示
