# 需求文档

## 简介

为现有的谋杀之谜剧本生成器 Express API 集成 OpenAPI 3.0 规范和 Swagger UI。该功能将自动从现有路由和类型定义生成 OpenAPI 3.0 文档，并通过 Swagger UI 提供交互式 API 文档浏览界面，方便开发者和前端团队理解和测试 API。

## 术语表

- **OpenAPI_Spec**: 符合 OpenAPI 3.0 标准的 JSON/YAML 格式 API 描述文档
- **Swagger_UI**: 基于 OpenAPI 规范自动生成的交互式 API 文档浏览界面
- **Express_App**: 基于 Express 框架的后端应用程序（packages/server）
- **路由模块**: Express 中定义 API 端点的模块文件（configs、scripts、tags、authoring、ai-status）
- **Schema**: OpenAPI 规范中描述请求/响应数据结构的 JSON Schema 定义
- **JSDoc_注解**: 在路由代码中添加的 OpenAPI 描述注解

## 需求

### 需求 1：OpenAPI 3.0 规范文档生成

**用户故事：** 作为开发者，我希望系统能生成完整的 OpenAPI 3.0 规范文档，以便前端团队和外部开发者能准确理解所有 API 端点。

#### 验收标准

1. THE OpenAPI_Spec SHALL 包含所有已注册的 API 端点定义，涵盖 configs、scripts、tags、authoring-sessions、ai-status 和 health 路由
2. WHEN 定义 API 端点时，THE OpenAPI_Spec SHALL 为每个端点包含 HTTP 方法、路径、请求参数、请求体 Schema、响应 Schema 和状态码描述
3. THE OpenAPI_Spec SHALL 在 components/schemas 中定义所有共享数据模型（ScriptConfig、Script、Tag、AuthoringSession、EphemeralAiConfig 等）
4. THE OpenAPI_Spec SHALL 使用中文作为端点描述和 Schema 说明的语言
5. WHEN OpenAPI_Spec 被序列化为 JSON 后再解析，THE 系统 SHALL 产生与原始对象等价的结果（往返一致性）

### 需求 2：Swagger UI 集成

**用户故事：** 作为开发者，我希望通过浏览器访问交互式 API 文档界面，以便能直观地浏览和测试 API 端点。

#### 验收标准

1. WHEN 用户访问 /api-docs 路径时，THE Express_App SHALL 返回 Swagger UI 页面
2. THE Swagger_UI SHALL 从 OpenAPI_Spec 加载并展示所有 API 端点信息
3. WHEN Swagger_UI 页面加载完成后，THE Swagger_UI SHALL 允许用户直接在界面中发送 API 请求并查看响应
4. THE Swagger_UI SHALL 按路由模块对 API 端点进行分组展示（使用 OpenAPI tags 机制）

### 需求 3：JSDoc/注解驱动的规范定义

**用户故事：** 作为开发者，我希望通过在路由代码中添加注解来定义 OpenAPI 规范，以便规范与代码保持同步。

#### 验收标准

1. THE 系统 SHALL 使用 JSDoc 注解（swagger-jsdoc 库）从路由文件中提取 OpenAPI 定义
2. WHEN 路由文件中包含 @openapi 注解时，THE 系统 SHALL 将注解内容解析为 OpenAPI 路径定义
3. WHEN Express_App 启动时，THE 系统 SHALL 自动扫描所有路由文件并合并生成完整的 OpenAPI_Spec

### 需求 4：Schema 与共享类型一致性

**用户故事：** 作为开发者，我希望 OpenAPI Schema 定义与 packages/shared 中的 TypeScript 类型保持一致，以便避免文档与实际接口不匹配。

#### 验收标准

1. THE OpenAPI_Spec 中的 Schema 定义 SHALL 与 packages/shared/src/types/ 中的 TypeScript 类型定义在字段名称和类型上保持一致
2. WHEN TypeScript 类型中定义了枚举值时，THE OpenAPI_Spec SHALL 在对应 Schema 中使用 enum 约束列出所有合法值
3. WHEN TypeScript 类型中字段标记为可选（?）时，THE OpenAPI_Spec SHALL 将该字段从 required 列表中排除

### 需求 5：错误响应规范

**用户故事：** 作为开发者，我希望 OpenAPI 规范中包含所有错误响应的定义，以便前端能正确处理各种错误场景。

#### 验收标准

1. THE OpenAPI_Spec SHALL 为每个端点定义所有可能的错误响应状态码（400、404、500）
2. WHEN 端点返回错误时，THE OpenAPI_Spec SHALL 定义统一的错误响应 Schema，包含 error 字段和可选的 details 字段
3. THE OpenAPI_Spec SHALL 为每个错误状态码提供中文描述说明
