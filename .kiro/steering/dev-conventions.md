---
inclusion: auto
---

# 开发约定

## 项目定位

本项目是 AI 剧本杀生成器的「剧本生成子系统」，仅负责剧本内容的 AI 生成。
设计文档通过 git submodule 引入，位于 `design-kb/` 目录（只读引用，不在其中写代码）。

## 权威设计文档（通过 submodule 同步）

知识库已大幅简化，采用 KISS 原则，从微服务架构改为三系统平台（剧本生成 + 物料生成 + 游戏玩家）。
以下文档是设计契约的权威来源：

- 三系统平台需求：#[[file:design-kb/.kiro/specs/murder-mystery-system/requirements.md]]
- 三系统平台设计：#[[file:design-kb/.kiro/specs/murder-mystery-system/design.md]]
- 三系统平台任务：#[[file:design-kb/.kiro/specs/murder-mystery-system/tasks.md]]

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

不包含：物料生成系统（murder-mystery-material）、游戏玩家系统（murder-mystery-game）。这两个系统在独立仓库中开发。

## 关键约束

1. 类型命名必须与 design-kb 中的定义完全一致（ScriptConfig, Script, DMHandbook, GameType, AgeGroup, SkillCategory 等）
2. 从 design-kb 迁移代码时保持接口不变，仅调整 import 路径
3. 所有服务通过函数导出或构造函数注入依赖，便于测试
4. 技术栈：Node.js + Express + TypeScript, MySQL + Redis, Vitest + fast-check
5. Monorepo 结构：packages/shared（类型）、packages/server（后端服务）
6. 使用中文编写文档和注释
7. Docker 容器部署：每次修改代码后，必须先在容器内执行 build 再 restart，否则容器运行的是旧的编译产物。流程：`docker exec murder-mystery-generator-server-1 sh -c "cd /app && pnpm --filter @gdgeek/murder-mystery-shared build && pnpm --filter @murder-mystery/server build"` → `docker restart murder-mystery-generator-server-1`
