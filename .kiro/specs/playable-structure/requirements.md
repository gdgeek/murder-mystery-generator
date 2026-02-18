# 需求文档：可游玩结构（Playable Structure）

## 简介

当前剧本杀AI生成系统输出的剧本内容（DM手册、玩家手册）缺乏明确的可游玩结构，无法让玩家按顺序体验故事。本功能引入"幕"（Act）的概念，将剧本内容重组为线性可游玩的序列：序幕（背景+角色介绍）→ 第1幕（故事→目标→投票）→ 第2幕 → ... → 终幕（最终投票+结局揭示）。改进涉及类型定义、DM手册结构、玩家手册结构、LLM提示词模板和向后兼容迁移。

## 术语表

- **Act（幕）**：剧本的基本游玩单元，包含故事叙述、搜证目标、交流建议和投票/决策环节
- **Prologue（序幕）**：游戏开始前的背景介绍和角色分配阶段
- **Finale（终幕）**：游戏最后的最终投票、真相揭示和结局阶段
- **ActNarrative（幕叙述）**：每幕开始时由DM朗读或玩家阅读的故事推进文本
- **ActObjective（幕目标）**：每幕中玩家需要完成的搜证和调查目标
- **ActDiscussion（交流建议）**：每幕搜证结束后、投票前的玩家交流环节，提供讨论话题和引导
- **ActVote（幕投票）**：每幕结束时的投票或决策环节，影响后续剧情走向
- **PlayableScript（可游玩剧本）**：按幕组织的完整剧本结构，可直接用于线上游玩
- **Generator（生成引擎）**：核心AI生成模块，负责调用LLM生成剧本内容
- **DM_Handbook（DM手册）**：供主持人使用的完整游戏主持指南
- **Player_Handbook（玩家手册）**：供每位玩家使用的角色剧本
- **LegacyScript（旧版剧本）**：采用旧结构（无幕概念）的已有剧本数据

## 需求

### 需求 1：幕（Act）数据结构定义

**用户故事：** 作为开发者，我希望系统有明确的"幕"数据结构，以便剧本内容能按可游玩的顺序组织。

#### 验收标准

1. THE PlayableScript SHALL 定义包含序幕（Prologue）、多个中间幕（Act）和终幕（Finale）的有序结构
2. WHEN 定义Act时，THE Act SHALL 包含以下字段：幕索引（actIndex）、幕标题（title）、故事叙述文本（narrative）、搜证目标列表（objectives）、本幕分发的线索ID列表（clueIds）、交流建议（discussion）、投票/决策定义（vote）
3. WHEN 定义Prologue时，THE Prologue SHALL 包含以下字段：故事背景叙述（backgroundNarrative）、世界观描述（worldSetting）、角色介绍列表（characterIntros）
4. WHEN 定义Finale时，THE Finale SHALL 包含以下字段：最终投票定义（finalVote）、真相揭示文本（truthReveal）、结局列表（endings）
5. WHEN 定义ActVote时，THE ActVote SHALL 包含以下字段：投票问题（question）、选项列表（options）、每个选项对后续剧情的影响描述（impact）
6. WHEN 定义ActDiscussion时，THE ActDiscussion SHALL 包含以下字段：讨论话题列表（topics）、引导问题（guidingQuestions）、建议讨论时长（suggestedMinutes）

### 需求 2：DM手册按幕重组

**用户故事：** 作为DM（主持人），我希望DM手册按幕组织，每幕有明确的主持指引，以便我能按顺序引导玩家完成游戏。

#### 验收标准

1. WHEN Generator生成DM_Handbook时，THE DM_Handbook SHALL 包含按幕组织的主持指引（actGuides），每幕指引包含：幕索引、DM朗读文本、本幕关键事件提示、线索分发指令、交流环节引导话题、投票主持说明、DM私密备注
2. WHEN DM_Handbook包含序幕指引时，THE DM_Handbook SHALL 提供开场白文本、角色分配说明和游戏规则介绍
3. WHEN DM_Handbook包含终幕指引时，THE DM_Handbook SHALL 提供最终投票主持流程、真相揭示朗读文本和各结局触发条件判定说明
4. WHEN DM_Handbook包含线索分发指令时，THE DM_Handbook SHALL 为每幕明确指定哪些线索卡分发给哪些角色，以及分发的触发条件

### 需求 3：玩家手册按幕重组

**用户故事：** 作为玩家，我希望我的角色手册按幕组织，每幕有该角色视角的故事片段和行动目标，以便我能按顺序体验游戏。

#### 验收标准

1. WHEN Generator生成Player_Handbook时，THE Player_Handbook SHALL 包含按幕组织的角色内容（actContents），每幕内容包含：幕索引、该角色视角的故事片段（personalNarrative）、本幕行动目标（objectives）、本幕可获得的线索提示（clueHints）、交流建议（discussionSuggestions）、本幕角色私密信息（secretInfo）
2. WHEN Player_Handbook包含序幕内容时，THE Player_Handbook SHALL 提供角色背景故事、角色关系描述和初始已知信息
3. WHEN Player_Handbook包含终幕内容时，THE Player_Handbook SHALL 提供最终陈述指引和投票建议
4. WHEN 同一幕中不同角色的personalNarrative涉及相同事件时，THE Generator SHALL 确保事件描述在不同角色视角间保持事实一致性

### 需求 4：LLM提示词模板适配

**用户故事：** 作为开发者，我希望LLM提示词模板能引导AI按幕结构生成内容，以便生成结果直接符合可游玩结构。

#### 验收标准

1. WHEN Generator构建系统提示词时，THE Generator SHALL 在提示词中定义按幕组织的JSON输出格式，包含prologue、acts数组和finale
2. WHEN Generator构建用户提示词时，THE Generator SHALL 指示LLM为每幕生成完整的故事叙述、搜证目标、线索分发、交流建议和投票环节
3. WHEN Generator构建提示词时，THE Generator SHALL 指示LLM确保幕与幕之间的故事叙述具有连贯性和递进性
4. WHEN Generator解析LLM返回内容时，THE Generator SHALL 验证返回的JSON包含完整的幕结构（prologue、至少一个act、finale）

### 需求 5：幕结构与配置轮次的映射

**用户故事：** 作为剧本创作者，我希望幕的数量自动匹配配置中的轮次数，以便游戏时长与内容量相匹配。

#### 验收标准

1. WHEN Generator生成PlayableScript时，THE Generator SHALL 确保中间幕的数量等于Config中roundStructure.totalRounds的值
2. WHEN Generator生成每幕内容时，THE Generator SHALL 参考对应轮次的时间分配（readingMinutes对应叙述长度、investigationMinutes对应搜证目标复杂度、discussionMinutes对应交流建议深度和投票讨论深度）
3. WHEN Config的轮次结构发生变化时，THE Generator SHALL 自动调整生成的幕数量以匹配新的轮次数

### 需求 6：向后兼容与数据迁移

**用户故事：** 作为系统管理员，我希望新结构能兼容已有的旧版剧本数据，以便系统升级不影响已有内容。

#### 验收标准

1. THE PlayableScript SHALL 在Script类型中作为可选字段存在，旧版Script无此字段时系统正常运行
2. WHEN 系统读取旧版Script（无playableStructure字段）时，THE System SHALL 正常展示旧版内容而非报错
3. WHEN 提供迁移工具将旧版Script转换为新结构时，THE MigrationTool SHALL 将旧版roundGuides映射为Act的DM指引、将旧版roundActions映射为Act的玩家内容、将旧版branchDecisionPoints映射为对应幕的投票定义
4. WHEN MigrationTool完成转换后，THE MigrationTool SHALL 保留原始旧版数据不做修改

### 需求 7：幕结构校验

**用户故事：** 作为开发者，我希望系统能校验生成的幕结构的完整性和一致性，以便确保生成质量。

#### 验收标准

1. WHEN Generator生成PlayableScript后，THE Generator SHALL 校验每幕的线索ID在Material的线索卡中都存在对应条目
2. WHEN Generator生成PlayableScript后，THE Generator SHALL 校验所有线索卡在各幕的线索分发中都被引用（无遗漏线索）
3. WHEN Generator生成PlayableScript后，THE Generator SHALL 校验每幕的投票选项都有明确的后续影响定义
4. WHEN Generator生成PlayableScript后，THE Generator SHALL 校验玩家手册的幕数量与DM手册的幕数量一致
5. WHEN PlayableScript序列化为JSON后再反序列化时，THE System SHALL 产生与原始结构等价的结果（往返一致性）
