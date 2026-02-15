---
inclusion: auto
---

# 开发约定

## 项目定位

本项目是 AI 剧本杀生成器的「剧本生成子系统」，仅负责剧本内容的 AI 生成。
设计文档通过 git submodule 引入，位于 `design-kb/` 目录（只读引用，不在其中写代码）。

## 权威设计文档（通过 submodule 同步）

以下文档是类型定义和设计契约的权威来源，代码必须与之一致：

- 完整系统需求：#[[file:design-kb/.kiro/specs/murder-mystery-ai-generator/requirements.md]]
- 完整系统设计：#[[file:design-kb/.kiro/specs/murder-mystery-ai-generator/design.md]]
- 本项目实现状态：#[[file:design-kb/.kiro/specs/murder-mystery-ai-generator/implementation-status.md]]
- 微服务架构：#[[file:design-kb/.kiro/specs/microservice-architecture/architecture.md]]
- 创建服务 API 契约：#[[file:design-kb/.kiro/specs/microservice-architecture/services/creation-service.md]]
- 事件总线格式：#[[file:design-kb/.kiro/specs/microservice-architecture/event-bus.md]]
- 通信协议与错误码：#[[file:design-kb/.kiro/specs/microservice-architecture/communication.md]]
- 子项目开发指南：#[[file:design-kb/.kiro/specs/microservice-architecture/dev-guide.md]]

## 本项目 Spec

- 需求文档：#[[file:.kiro/specs/script-generation/requirements.md]]
- 设计文档：#[[file:.kiro/specs/script-generation/design.md]]
- 任务计划：#[[file:.kiro/specs/script-generation/tasks.md]]

## 子系统范围

仅包含：
- ConfigService（参数校验、轮次结构）
- SkillService（模板管理）
- LLMAdapter（多提供商、重试）
- GeneratorService（DM手册、玩家手册、物料、分支结构）
- TagService（自动标签、检索）
- 反馈驱动优化（与生成相关的部分）
- i18n（与生成相关的部分）

不包含：线上游玩、WebSocket、AI DM、知识库子系统、账户系统、成就收藏、排行榜、插件系统、视频生成、设计师系统、经济系统等。

## 关键约束

1. 类型命名必须与 design-kb 中的定义完全一致（ScriptConfig, Script, DMHandbook, GameType, AgeGroup, SkillCategory 等）
2. 从 design-kb 迁移代码时保持接口不变，仅调整 import 路径
3. 所有服务通过函数导出或构造函数注入依赖，便于测试
4. 技术栈：Node.js + Express + TypeScript, MySQL + Redis, Vitest + fast-check
5. Monorepo 结构：packages/shared（类型）、packages/server（后端服务）
6. 使用中文编写文档和注释
7. Docker 容器部署：每次修改代码后，必须先在容器内执行 build 再 restart，否则容器运行的是旧的编译产物。流程：`docker exec murder-mystery-generator-server-1 sh -c "cd /app && pnpm --filter @gdgeek/murder-mystery-shared build && pnpm --filter @murder-mystery/server build"` → `docker restart murder-mystery-generator-server-1`
