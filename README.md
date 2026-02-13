# Murder Mystery Generator — 剧本杀 AI 生成器

AI 驱动的剧本杀内容生成系统。用户配置参数（玩家人数、时长、游戏类型、风格、背景设定等），系统通过分阶段创作工作流调用大语言模型，结合 Skill 模板自动生成完整的剧本杀内容。

## 核心功能

- **分阶段创作工作流** — 配置 → 企划 → 大纲 → 章节逐步生成，每步可审阅/编辑/批准
- **多模型路由** — 支持 OpenAI、Anthropic、DeepSeek 等多 LLM 提供商，按任务类型智能路由
- **7 种叙事风格** — Detective/Drama/Discover/Destiny/Dream/Dimension/Death，每种风格影响 LLM 提示词
- **内嵌测试 UI** — 暗色玻璃拟态风格的 Web 面板，支持分步创作和快速配置
- **会话持久化** — URL hash 保存 session，刷新页面自动恢复进度

## 风格系统

| 风格 | 代号 | 特色 |
|------|------|------|
| 悬疑 | Detective 正统侦探 | 严密逻辑推理，冷静克制，证据链环环相扣 |
| 搞笑 | Drama 戏影侦探 | 谐音梗、无厘头、喜剧反转 |
| 探索 | Discover 寻迹侦探 | 多分支多结局，隐藏内容，高可重玩性 |
| 浪漫 | Destiny 命运侦探 | 命运交织，浪漫情感，宿命羁绊 |
| 叙诡 | Dream 幻梦侦探 | 梦幻叙事，真假不分，叙述性诡计 |
| 科幻 | Dimension 赛博侦探 | 全息投影、传送门、太空飞船等高科技设定 |
| 恐怖 | Death 幽冥侦探 | 民俗/日式/哥特/克苏鲁恐怖，充满未知 |

## 生成物料

完成创作后，系统生成并存储以下完整物料：

- **DM 手册** — 概述、角色摘要、时间线、线索分发表、轮次指引、分支决策点、结局、真相揭示、判定规则
- **玩家手册** (×N) — 每位玩家独立手册：背景故事、目标、关系、已知线索、轮次行动、秘密
- **游戏物料** — 线索卡、道具卡、投票卡、场景卡
- **分支结构** — 分支节点、边、多结局（含触发条件和叙事）

## 技术栈

- Node.js + Express + TypeScript (pnpm monorepo)
- MySQL 8.0 + Redis
- Vitest + fast-check（属性测试）
- Docker Compose（本地开发）

## 项目结构

```
murder-mystery-generator/
├── packages/
│   ├── shared/                 # 共享类型定义
│   │   └── src/types/          # Config, Script, Authoring 等类型
│   ├── server/                 # 后端服务
│   │   └── src/
│   │       ├── routes/         # API 路由 (configs, authoring, scripts, tags, ui)
│   │       ├── services/       # 业务逻辑
│   │       │   ├── authoring/  # 分阶段创作 (状态机, prompt构建, 阶段解析)
│   │       │   ├── config.service.ts
│   │       │   ├── skill.service.ts
│   │       │   └── generator.service.ts
│   │       ├── adapters/       # LLM 适配器 + 多模型路由
│   │       └── db/             # 数据库迁移
│   └── web/                    # 前端包 (备用)
├── config/                     # LLM 路由配置
├── design-kb/                  # git submodule — 设计知识库
├── .kiro/
│   ├── specs/                  # 功能规格 (script-generation, staged-authoring, etc.)
│   ├── skills/                 # 剧本杀创作知识库
│   └── steering/               # 开发约定
└── docker-compose.yml
```

## 快速开始

```bash
# 克隆项目（含子模块）
git clone --recurse-submodules git@github.com:gdgeek/murder-mystery-generator.git
cd murder-mystery-generator

# 启动所有服务
docker compose up -d

# 访问测试 UI
open http://localhost:3000/
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/configs` | 创建剧本配置 |
| GET | `/api/configs/:id` | 获取配置详情 |
| POST | `/api/authoring-sessions` | 创建创作会话 |
| GET | `/api/authoring-sessions/:id` | 获取会话状态（轮询） |
| POST | `/api/authoring-sessions/:id/advance` | 推进到下一阶段 |
| PUT | `/api/authoring-sessions/:id/phases/:phase/edit` | 编辑阶段内容 |
| POST | `/api/authoring-sessions/:id/phases/:phase/approve` | 批准阶段 |
| POST | `/api/authoring-sessions/:id/assemble` | 组装最终剧本 |

## 游戏类型

| 类型 | 说明 |
|------|------|
| 本格 (Honkaku) | 公平推理，现实世界观下逻辑推理和证据链条为核心 |
| 新本格 (Shin-Honkaku) | 特殊世界观设定中进行公平推理，设定规则前置公开 |
| 变格 (Henkaku) | 突破传统推理，强调氛围、心理、情感体验 |

## License

Private
