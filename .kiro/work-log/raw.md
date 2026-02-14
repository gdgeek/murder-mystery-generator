# 工作日志

---
### 2026-02-14 00:10
**问题：** 为项目创建并执行 OpenAPI 3.0 集成的完整 spec（Swagger UI + JSDoc 注解覆盖所有 API 端点）
**解决：** 执行了 openapi-integration spec 的全部 11 个必需任务：安装依赖、创建 swagger 配置模块、定义 22+ 共享 Schema、为 configs/scripts/tags/authoring/ai-status 路由和 health 端点添加 @openapi 注解、集成 Swagger UI 到 Express App、编写 49 个单元测试验证 spec 结构和端点覆盖。
**涉及文件：** packages/server/src/swagger.ts, packages/server/src/app.ts, packages/server/src/routes/configs.ts, packages/server/src/routes/scripts.ts, packages/server/src/routes/tags.ts, packages/server/src/routes/authoring.ts, packages/server/src/routes/ai-status.ts, packages/server/src/swagger.test.ts
---

### 2026-02-14 00:30
**问题：** 访问 /api-docs/ (带尾部斜杠) 返回 "Cannot GET /api-docs/"
**解决：** swagger-ui-express v5 的已知问题，将 swaggerUi.serve 和 swaggerUi.setup 分开注册，并为 /api-docs 和 /api-docs/ 都注册 setup handler。
**涉及文件：** packages/server/src/app.ts
---

### 2026-02-14 00:35
**问题：** 修复所有失败的测试并推送到 CI
**解决：** 修了 4 个测试失败：llm-adapter.test.ts 的 mock Response 缺少 text() 方法，generator.service.test.ts 的 validateGenerated 已改为 warn 而非 throw。全部 394 测试通过后 git push。
**涉及文件：** packages/server/src/adapters/llm-adapter.test.ts, packages/server/src/services/generator.service.test.ts
---

### 2026-02-14 00:47
**问题：** CI 构建失败（tsconfig.build.json 配置问题导致大量 TS 编译错误）
**解决：** 修复 tsconfig.build.json：清空 paths 避免 rootDir 冲突、排除测试文件、添加 skipLibCheck。修复 app.ts 和 generator.service.ts 的类型转换、configs.ts 的 Router 类型注解。清理误提交的 shared build artifacts。
**涉及文件：** packages/server/tsconfig.build.json, packages/server/src/app.ts, packages/server/src/services/generator.service.ts, packages/server/src/routes/configs.ts
---

### 2026-02-14 01:00
**问题：** 每次生成剧本杀后记录 AI 模型和版本号
**解决：** 在 Script 接口添加 aiProvider 和 aiModel 可选字段，在 GeneratorService.generate() 和 AuthoringService.assembleScript() 中通过 llmAdapter 获取并填充这两个字段。
**涉及文件：** packages/shared/src/types/script.ts, packages/server/src/services/generator.service.ts, packages/server/src/services/authoring/authoring.service.ts
---

### 2026-02-14 01:05
**问题：** 创建 hook 自动记录每次问答日志，并支持手动触发生成每日工作日记
**解决：** 创建了 agentStop hook（log-qa-entry）在每次对话结束后自动追加问答记录到 .kiro/work-log/raw.md。用户后续可手动触发总结 hook 生成日报。
**涉及文件：** .kiro/hooks/log-qa-entry.json
---

---
### 2026-02-14 16:16
**问题：** 继续完成上次未完成的两个任务：Task 5（AI模型版本记录）的验证和 Task 6（每日工作日记 hook）的第二个 hook 创建
**解决：** 确认 Task 5 的 aiProvider/aiModel 代码已提交，运行全部 394 个测试和 build 均通过。创建了第二个 hook `daily-summary.kiro.hook`（userTriggered 类型），用于手动触发生成每日工作日记。两个 hook 和工作日志一起提交推送到 main。
**涉及文件：** .kiro/hooks/daily-summary.kiro.hook, .kiro/work-log/raw.md
---

---
### 2026-02-14 16:25
**问题：** 每日工作日记 hook 需要增加昨日工作评价和改进建议
**解决：** 更新了 daily-summary.kiro.hook 的日记模板，新增「工作评价」（从效率、代码质量、问题解决思路等角度客观评价）和「改进建议」（给出具体可执行的改进行动项）两个板块。
**涉及文件：** .kiro/hooks/daily-summary.kiro.hook
---

---
### 2026-02-14 16:30
**问题：** 制作简单的 UI 展示工作日志，并在主界面上添加打开链接
**解决：** 新增后端 API 端点（/api/work-log/raw、/api/work-log/diary、/api/work-log/diary/:date）读取 .kiro/work-log 下的原始日志和每日日记。主界面 tab 栏新增「工作日志」标签页，包含原始记录和每日日记两个子视图，支持 markdown 渲染和日记详情展开。394 测试和 build 通过后推送。
**涉及文件：** packages/server/src/routes/work-log.ts, packages/server/src/app.ts, packages/server/src/routes/ui.ts
---

---
### 2026-02-14 16:40
**问题：** 确保工作日志记录中不包含敏感信息（密码、API Key、个人隐私等）
**解决：** 在 log-qa-entry 和 daily-summary 两个 hook 的 prompt 中增加了安全要求：严禁记录 API Key、密码、Token、Secret、数据库凭证、个人隐私等敏感信息，涉及时一律用 [已脱敏] 替代。检查了现有 raw.md 内容，确认无敏感信息泄露。
**涉及文件：** .kiro/hooks/log-qa-entry.kiro.hook, .kiro/hooks/daily-summary.kiro.hook
---

---
### 2026-02-14 16:50
**问题：** 主页健康检查指示器一直显示"检查中"，无法变为"在线"
**解决：** 工作日志 tab 的 JS 代码中误用 `$`（querySelector，返回单元素）代替 `$$`（querySelectorAll），导致 forEach 报错，后续健康检查 IIFE 未能执行。将两处 `$('.wl-sw')` 和 `$('.tb')` 改为 `$$`，重启容器后恢复正常。
**涉及文件：** packages/server/src/routes/ui.ts
---

---
### 2026-02-14 17:00
**问题：** 从上次会话继续完成 Task 6（Docker 构建约束 steering 规则），提交推送并执行容器内 build + restart
**解决：** 将已编辑的 `.kiro/steering/dev-conventions.md`（新增约束 #7：Docker 容器部署需先 build 再 restart）和工作日志一起 commit 并 push 到 main。随后在容器内执行 shared + server build，restart 容器，验证健康检查返回正常。
**涉及文件：** .kiro/steering/dev-conventions.md, .kiro/work-log/raw.md
---

---
### 2026-02-14 17:20
**问题：** UI 页面控制台报错 "Uncaught SyntaxError: Invalid regular expression: missing /"，健康检查一直显示"检查中"
**解决：** 根本原因是 TypeScript 模板字符串（backtick）会解释转义序列，导致 `renderMd` 中的 `/\*\*(.+?)\*\*/g` 编译后变成无效正则 `/**(.+?)**/g`，`/\n/g` 变成匹配空白。改用 `new RegExp('[*][*](.+?)[*][*]','g')` 和 `new RegExp('\\n','g')` 避免转义丢失。同时修复 onclick 中 `\'none\'` 改为 `&quot;none&quot;`。构建重启后恢复正常。
**涉及文件：** packages/server/src/routes/ui.ts
---

---
### 2026-02-14 17:25
**问题：** 提交并推送代码以触发 CI
**解决：** 将工作日志变更 commit 并 push 到 main 分支，触发 GitHub Actions CI 流水线。
**涉及文件：** .kiro/work-log/raw.md
---
