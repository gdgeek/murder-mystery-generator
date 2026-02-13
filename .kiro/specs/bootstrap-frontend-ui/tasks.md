# Implementation Plan: Bootstrap 前端配置界面

## Overview

将 `packages/web` 作为 pnpm monorepo 中的新包初始化，使用 Vite + TypeScript 构建，通过 CDN 引入 Bootstrap 5。按模块逐步实现：先搭建基础架构（路由、API 客户端），再实现核心纯逻辑（校验、轮次计算），然后构建 UI 组件，最后集成串联。

## Tasks

- [x] 1. 初始化 packages/web 项目结构
  - 创建 `packages/web/package.json`（依赖 `@murder-mystery/shared`、`vite`、`typescript`、`vitest`、`fast-check`）
  - 创建 `packages/web/tsconfig.json`
  - 创建 `packages/web/vite.config.ts`（配置 dev server proxy 到后端）
  - 创建 `packages/web/index.html`（引入 Bootstrap 5 CDN CSS/JS，包含 `<div id="app">` 容器和 navbar）
  - 创建 `packages/web/src/main.ts` 入口文件（初始化路由）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1_

- [ ] 2. 实现 Hash 路由器和 API 客户端
  - [x] 2.1 实现 `src/router.ts`
    - 定义 Route 接口和 Router 类
    - 监听 hashchange 事件，解析 hash 路径并调用对应视图 render 函数
    - 未匹配路由回退到首页
    - _Requirements: 1.7, 7.2_

  - [ ]* 2.2 编写路由器属性测试
    - **Property 6: 路由解析正确性**
    - **Validates: Requirements 7.2**

  - [x] 2.3 实现 `src/api-client.ts`
    - 定义 ApiError 类（包含 statusCode、message、details）
    - 实现 ApiClient 类，封装 get/post 方法
    - 可配置 baseUrl，所有请求自动拼接前缀
    - 非 2xx 响应抛出 ApiError
    - _Requirements: 1.5, 1.6_

  - [ ]* 2.4 编写 API 客户端属性测试
    - **Property 1: Base URL 拼接正确性**
    - **Validates: Requirements 1.6**

- [ ] 3. 实现表单校验器和轮次计算器
  - [x] 3.1 实现 `src/validators.ts`
    - 实现 `validateConfigForm(data)` 纯函数，校验所有配置字段
    - 实现 `validateSpecialSetting(data)` 纯函数，校验特殊设定字段
    - 校验规则与后端 ConfigService.validate 对齐
    - 错误提示使用中文
    - 当 gameType 为 shin_honkaku 时额外校验 specialSetting
    - _Requirements: 2.3, 2.4, 3.4_

  - [ ]* 3.2 编写表单校验属性测试
    - **Property 3: 表单校验正确性**
    - **Validates: Requirements 2.3, 2.4, 3.4**

  - [x] 3.3 实现 `src/round-calculator.ts`
    - 实现 `calculateRoundStructure(durationHours)` 纯函数
    - 时长到轮次映射：2→2, 3→3, 4→4, 5→4, 6→5
    - 计算每轮阅读、搜证、讨论时间分配
    - 无效输入返回 null
    - _Requirements: 4.1, 4.3_

  - [ ]* 3.4 编写轮次计算属性测试
    - **Property 4: 轮次结构计算正确性**
    - **Validates: Requirements 4.1, 4.3**

- [x] 4. Checkpoint - 确保纯逻辑模块测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. 实现 Toast 通知和轮次预览组件
  - [x] 5.1 实现 `src/components/toast.ts`
    - 实现 showToast 函数，使用 Bootstrap Toast API
    - 支持 success/danger/warning 类型
    - _Requirements: 7.4_

  - [x] 5.2 实现 `src/components/round-preview.ts`
    - 实现 RoundPreview 类，接收容器元素
    - update(durationHours) 调用 calculateRoundStructure 并渲染 Bootstrap 表格
    - 无效输入时显示占位提示
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. 实现配置表单组件
  - [x] 6.1 实现 `src/components/config-form.ts`
    - 渲染完整 Bootstrap 表单（playerCount、durationHours、gameType、ageGroup、restorationRatio 滑块、era、location、theme、language）
    - restorationRatio 滑块 input 事件实时更新 deductionRatio 显示
    - gameType 切换到 shin_honkaku 时显示特殊设定区域（settingTypes 复选框、settingDescription、settingConstraints）
    - gameType 切换离开 shin_honkaku 时隐藏并清空特殊设定
    - durationHours 变化时更新 RoundPreview
    - 提交时调用 validateConfigForm，失败时添加 is-invalid 类和错误提示
    - 校验通过后调用 apiClient.post('/api/configs', data)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 6.2 编写比例互补属性测试
    - **Property 2: 还原比例与推理比例互补不变量**
    - **Validates: Requirements 2.2**

- [ ] 7. 实现生成跟踪组件
  - [x] 7.1 实现 `src/components/generation-tracker.ts`
    - 实现 GenerationTracker 类
    - startGeneration(configId) 调用 POST /api/scripts/generate
    - 收到 202 后启动 3 秒间隔轮询 GET /api/scripts/jobs/:jobId
    - 轮询期间显示 Bootstrap spinner 和状态文本
    - completed 时停止轮询，显示成功提示和查看链接
    - failed 时停止轮询，显示错误信息
    - 连续 3 次失败时停止轮询，显示重试按钮
    - destroy() 清理定时器
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 7.2 编写生成跟踪单元测试
    - 模拟 fetch 测试轮询状态转换
    - 测试连续失败计数和重试逻辑
    - _Requirements: 5.4, 5.5, 5.6_

- [ ] 8. 实现剧本列表组件
  - [x] 8.1 实现 `src/components/script-list.ts`
    - 实现 ScriptList 类
    - 加载时调用 GET /api/scripts?limit=10&offset=0
    - Bootstrap 卡片列表展示（标题、版本号、状态、创建时间）
    - 空列表显示"暂无剧本"占位
    - 分页按钮控制翻页
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.2 编写分页偏移量属性测试
    - **Property 5: 分页偏移量计算正确性**
    - **Validates: Requirements 6.4**

- [ ] 9. 实现视图层并集成路由
  - [x] 9.1 实现 `src/views/home.ts`
    - 首页视图，展示简介和快捷入口
    - _Requirements: 7.1_

  - [x] 9.2 实现 `src/views/config.ts`
    - 配置视图，组合 ConfigForm + RoundPreview + GenerationTracker
    - 配置创建成功后显示生成按钮，点击后启动 GenerationTracker
    - _Requirements: 2.5, 5.1_

  - [x] 9.3 实现 `src/views/scripts.ts`
    - 剧本列表视图，挂载 ScriptList 组件
    - _Requirements: 6.1, 6.2_

  - [x] 9.4 在 `src/main.ts` 中注册路由并启动
    - 注册 home/config/scripts 三个路由
    - 初始化 ApiClient
    - 启动路由器
    - _Requirements: 1.7, 7.2_

- [x] 10. Final checkpoint - 确保所有功能集成正常
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 纯逻辑模块（validators、round-calculator）优先实现并测试，确保核心逻辑正确
- 属性测试使用 fast-check 库，每个属性至少 100 次迭代
- 单元测试使用 Vitest + jsdom 环境
- 前端直接引用 `@murder-mystery/shared` 中的类型定义
