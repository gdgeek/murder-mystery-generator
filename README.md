# Murder Mystery Generator — 剧本杀 AI 生成器

AI 驱动的剧本杀内容生成子系统。用户配置基本参数（玩家人数、时长、游戏类型、比例、背景设定等），系统调用大语言模型结合 Skill 模板自动生成完整的剧本杀内容。

## 子系统范围

本项目仅负责**剧本生成**，不包含线上游玩、知识库、账户系统等。

- **ConfigService** — 参数校验、轮次结构自动适配
- **SkillService** — 按游戏类型管理预定义 Skill 模板（本格/新本格/变格）
- **LLMAdapter** — 统一 LLM 接口，支持多提供商、指数退避重试
- **GeneratorService** — 核心生成引擎（DM 手册、玩家手册、游戏物料、分支叙事结构）
- **TagService** — 自动标签生成、组合检索
- **反馈驱动优化** — 基于玩家评价数据优化后续生成

## 技术栈

- Node.js + Express + TypeScript
- MySQL + Redis
- Vitest + fast-check（属性测试）
- Docker

## 项目结构

```
murder-mystery-generator/
├── design-kb/                  # git submodule — 设计知识库（只读引用）
│   └── .kiro/
│       ├── specs/              # 完整系统需求、设计、微服务架构
│       ├── skills/             # 剧本杀创作知识
│       └── steering/           # 独立生成器工作流指引
├── .kiro/
│   ├── specs/script-generation/  # 本项目的需求、设计、任务
│   ├── skills/                   # 剧本杀创作 + 代码审查 skills
│   └── steering/                 # 开发约定、SOLID/Unix 审查原则
├── packages/
│   ├── shared/                 # 共享类型定义（待实现）
│   └── server/                 # 后端服务（待实现）
└── README.md
```

## 设计文档

设计知识库通过 git submodule 引入，包含完整的系统需求和架构设计：

| 文档 | 路径 |
|------|------|
| 本项目需求 | `.kiro/specs/script-generation/requirements.md` |
| 本项目设计 | `.kiro/specs/script-generation/design.md` |
| 本项目任务 | `.kiro/specs/script-generation/tasks.md` |
| 完整系统需求 | `design-kb/.kiro/specs/murder-mystery-ai-generator/requirements.md` |
| 完整系统设计 | `design-kb/.kiro/specs/murder-mystery-ai-generator/design.md` |
| 微服务架构 | `design-kb/.kiro/specs/microservice-architecture/` |

## 快速开始

```bash
# 克隆项目（含子模块）
git clone --recurse-submodules git@github.com:gdgeek/murder-mystery-generator.git
cd murder-mystery-generator

# 同步子模块到最新
git submodule update --remote design-kb
```

实现代码尚未开始，请参考 `.kiro/specs/script-generation/tasks.md` 中的任务计划。

## 游戏类型

| 类型 | 说明 |
|------|------|
| 本格 (Honkaku) | 公平推理，现实世界观下逻辑推理和证据链条为核心 |
| 新本格 (Shin-Honkaku) | 设定本格 — 在特殊世界观设定（超能力、异世界、特殊规则等）中进行公平推理，设定规则前置公开，诡计基于设定边界 |
| 变格 (Henkaku) | 突破传统推理，强调氛围、心理、情感体验 |

## License

Private
