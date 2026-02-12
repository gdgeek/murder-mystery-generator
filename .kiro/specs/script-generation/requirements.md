# 需求文档：剧本生成子系统

## 简介

本子系统是线上剧本杀AI生成工具的核心生成模块，负责通过大语言模型（LLM）结合Skill模板自动生成完整的剧本杀内容。用户配置基本参数（玩家人数、时长、游戏类型、比例、背景设定等），系统调用LLM生成包含DM手册、玩家手册、游戏物料和分支叙事结构的完整剧本。生成的剧本作为独立资产存储，支持标签分类检索、反馈驱动优化和多语言生成。

本子系统范围包括：剧本生成参数配置、Skill库管理、LLM适配器、AI剧本生成引擎（DM手册、玩家手册、游戏物料、分支结构）、标签系统、反馈驱动优化（与生成相关的部分）、国际化支持（与生成相关的部分）。

## 术语表

- **Generator（生成引擎）**：核心AI生成模块，负责调用LLM并结合Skill模板生成剧本杀内容
- **Config（配置参数）**：用户定义的剧本生成参数集合，包含玩家人数、时长、游戏类型等
- **Script（剧本）**：由Generator生成的完整剧本杀内容包，包含DM手册、所有玩家手册和游戏物料
- **DM_Handbook（DM手册）**：供主持人使用的完整游戏主持指南
- **Player_Handbook（玩家手册）**：供每位玩家使用的角色剧本
- **Material（游戏物料）**：游戏过程中使用的线索卡、道具卡、投票卡等辅助材料
- **Skill（技能模板）**：预定义的剧本杀生成辅助模板和规则片段，按游戏类型分类
- **LLM_Adapter（LLM适配器）**：与大语言模型API交互的适配层，支持多种LLM提供商
- **Tag（标签）**：剧本的分类标签，用于检索和筛选
- **BranchStructure（分支结构）**：剧本的分支叙事结构，包含分支节点、投票选项和多结局
- **Feedback（反馈）**：玩家对剧本的评价数据，包含多维度评分
- **AggregatedFeedback（汇总反馈）**：某剧本所有评价的汇总统计数据

## 需求

### 需求 1：剧本生成参数配置

**用户故事：** 作为剧本创作者，我希望通过配置基本参数来定义剧本杀的基础设定，以便系统能根据我的需求生成定制化的剧本。

#### 验收标准

1. WHEN 用户创建新剧本项目时，THE Config SHALL 提供以下必填参数的配置界面：玩家人数（1-6人）、游戏时长（2-6小时，整数）、游戏类型（本格honkaku、新本格shin_honkaku、变格henkaku中选择一种）、目标年龄段（小学生elementary、中学生middle_school、大学生college、成年人adult中选择一种）
2. WHEN 用户设置游戏比例参数时，THE Config SHALL 接受还原比例和推理比例的数值输入（0-100），两项比例之和等于100
3. WHEN 用户设置背景参数时，THE Config SHALL 接受时代背景、地点设定、主题风格的非空文本输入
4. WHEN 用户提交的参数不符合约束条件时，THE Config SHALL 返回具体的参数校验错误信息，指明哪个参数不合法及其合法范围
5. WHEN 用户完成所有必填参数配置后，THE Config SHALL 生成一个完整的配置对象（含自动计算的轮次结构）并持久化存储
6. WHEN 用户选择游戏时长后，THE Config SHALL 根据时长自动适配游戏轮次结构：2小时适配2轮（总结20分钟），3小时适配3轮（总结30分钟），4小时适配4轮（总结30分钟），5小时适配4轮（总结40分钟），6小时适配5轮（总结40分钟）
7. WHEN Config生成轮次结构时，THE Config SHALL 为每轮分配阅读时间（10-15分钟）、搜证时间（15-20分钟）、推证/讨论时间（15-20分钟），并预留最终投票和真相揭示时间，所有轮次时间加总结时间不超过总时长
8. WHEN 用户选择目标年龄段后，THE Config SHALL 将年龄段信息包含在配置对象中传递给Generator

### 需求 2：Skill库管理

**用户故事：** 作为剧本创作者，我希望系统内置丰富的剧本杀Skill模板库，以便AI生成时能参考专业的剧本杀设计规则和模式。

#### 验收标准

1. THE Skill SHALL 包含以下类别的预定义模板：角色设计（character_design）、线索设计（clue_design）、时间线构建（timeline）、动机设计（motive）、诡计设计（trick）、还原逻辑（restoration）、推理链条（deduction_chain）
2. WHEN Generator请求特定类别的Skill时，THE Skill SHALL 返回该类别下所有可用的模板列表
3. WHEN 用户选择游戏类型为"本格"时，THE Skill SHALL 优先提供本格推理类Skill模板（如密室诡计、不在场证明、物证链条）
4. WHEN 用户选择游戏类型为"新本格"时，THE Skill SHALL 优先提供新本格类Skill模板（如叙述性诡计、时间线诡计、身份诡计）
5. WHEN 用户选择游戏类型为"变格"时，THE Skill SHALL 优先提供变格类Skill模板（如心理悬疑、氛围营造、道德困境）
6. THE Skill SHALL 支持以JSON格式存储和读取Skill模板数据
7. WHEN 读取Skill模板JSON数据后再序列化回JSON时，THE Skill SHALL 产生与原始数据等价的结果（往返一致性）

### 需求 3：AI剧本生成引擎 — DM手册生成

**用户故事：** 作为DM（主持人），我希望系统能调用LLM自动生成一份完整的DM手册，以便我能顺利组织和主持一场剧本杀游戏。

#### 验收标准

1. WHEN 用户提交有效的Config后，THE Generator SHALL 调用LLM_Adapter生成完整的Script，其中DM_Handbook包含以下章节：游戏概述、角色列表、完整时间线、线索分发表、各轮次流程指引、分支决策点定义、多结局描述、真相还原、结局判定规则
2. WHEN DM_Handbook包含线索分发表时，THE DM_Handbook SHALL 为每条线索指定分发时机（轮次索引）、接收角色和分发条件
3. WHEN DM_Handbook包含时间线时，THE DM_Handbook SHALL 确保时间线中的事件按时间顺序排列且无逻辑矛盾
4. WHEN DM_Handbook包含分支决策点时，THE DM_Handbook SHALL 为每个分支点定义投票问题、选项、以及各选项对应的后续剧情走向
5. WHEN DM_Handbook包含多结局时，THE DM_Handbook SHALL 为每个结局定义触发条件、结局叙述和每位玩家的个人结局
6. WHEN DM_Handbook包含结局判定规则时，THE DM_Handbook SHALL 定义明确的胜负条件和评分标准

### 需求 4：AI剧本生成引擎 — 玩家手册生成

**用户故事：** 作为玩家，我希望获得一份专属的角色手册，以便我能了解自己的角色并参与游戏。

#### 验收标准

1. WHEN Generator生成Player_Handbook时，THE Player_Handbook SHALL 包含以下内容：角色名称、角色背景故事、角色目标（至少一个主要目标和一个次要目标）、角色关系描述、已知线索、各轮次行动指引
2. WHEN Generator生成Script时，THE Generator SHALL 确保生成的玩家手册数量与Config中指定的玩家人数一致
3. WHEN Generator生成Player_Handbook时，THE Player_Handbook SHALL 确保每个玩家手册只包含该角色应知的信息，不泄露其他角色的秘密
4. WHEN Generator为同一Script生成多份Player_Handbook时，THE Generator SHALL 确保不同角色的背景故事在交叉引用时保持一致

### 需求 5：AI剧本生成引擎 — 游戏物料生成

**用户故事：** 作为DM，我希望系统能生成游戏所需的各种物料，以便线上游戏时能方便地分发和使用。

#### 验收标准

1. WHEN Generator生成Material时，THE Material SHALL 包含以下类型的物料：线索卡（clue_card）、道具卡（prop_card）、投票卡（vote_card）、场景描述卡（scene_card）
2. WHEN Material包含线索卡时，THE Material SHALL 确保每张线索卡有唯一标识符（clueId）、内容描述和关联角色
3. WHEN Material中的线索卡与DM_Handbook中的线索分发表关联时，THE Material SHALL 确保线索卡标识符与分发表中的引用一致

### 需求 6：AI剧本生成引擎 — 分支结构与版本管理

**用户故事：** 作为剧本创作者，我希望生成的剧本包含分支叙事结构和多结局，并支持版本管理，以便充分利用AI动态生成的优势。

#### 验收标准

1. WHEN Generator生成Script时，THE Generator SHALL 生成分支叙事结构（BranchStructure），包含多个分支节点（BranchNode）和多个结局（至少3个）
2. WHEN Generator生成分支结构时，THE Generator SHALL 确保从起始节点出发，通过任意投票选择组合，都能到达至少一个结局，不存在死路节点
3. WHEN Generator生成分支结构时，THE Generator SHALL 确保每个分支路径的线索链条完整且逻辑自洽
4. WHEN Generator完成生成后，THE Generator SHALL 将Script序列化为JSON格式存储，反序列化后与原始Script等价（往返一致性）
5. WHEN Generator基于反馈优化已有Script时，THE Generator SHALL 创建新版本而非覆盖原始版本，版本号自动递增（如v1.0→v1.1），保留完整的版本历史
6. WHEN Generator生成Script时，THE Generator SHALL 根据Config中的还原比例和推理比例调整内容侧重
7. IF LLM_Adapter调用失败，THEN THE Generator SHALL 返回包含错误类型和建议操作的错误信息

### 需求 7：标签系统

**用户故事：** 作为剧本创作者，我希望系统能自动为生成的剧本打标签，并支持手动添加自定义标签，以便剧本能被方便地检索和筛选。

#### 验收标准

1. WHEN Generator生成Script后，THE Tag_Service SHALL 自动为Script生成标签，包括：游戏类型、年龄段、玩家人数、时代背景、主题风格
2. WHEN 创作者手动添加自定义标签时，THE Tag_Service SHALL 将自定义标签与Script关联，标记为非自动生成
3. WHEN 用户按标签搜索剧本时，THE Tag_Service SHALL 返回所有匹配指定标签组合的剧本列表
4. THE Tag_Service SHALL 支持获取热门标签列表

### 需求 8：反馈驱动生成优化

**用户故事：** 作为剧本创作者，我希望系统能根据玩家反馈数据优化后续剧本生成，以便持续提升剧本质量。

#### 验收标准

1. WHEN Generator生成新Script时，THE Generator SHALL 查询历史评价数据，将平均评分低于6分的维度作为优化重点纳入LLM提示词
2. WHEN Generator生成新Script时，THE Generator SHALL 查询关联的Live_Suggestion数据，将高频建议纳入LLM提示词以优化生成内容
3. WHEN 用户选择对已有Script进行优化提炼时，THE Generator SHALL 汇总该Script所有评价和建议，作为优化输入生成新版本
4. WHEN 某Script累计收到的评价数量达到阈值（默认5次）且任一维度平均评分低于6分时，THE Generator SHALL 自动触发对该Script的优化，生成新版本并标记版本号
5. WHEN 自动优化完成后，THE Generator SHALL 通知剧本创建者新版本已生成，并提供优化摘要（哪些维度被优化、参考了哪些反馈）

### 需求 9：LLM适配层

**用户故事：** 作为系统管理员，我希望系统能灵活接入不同的大语言模型提供商，以便根据需要切换或升级AI能力。

#### 验收标准

1. THE LLM_Adapter SHALL 提供统一的接口（send方法）用于发送提示词和接收生成结果
2. WHEN 配置LLM提供商时，THE LLM_Adapter SHALL 支持通过环境变量配置API密钥（LLM_API_KEY）、端点地址（LLM_ENDPOINT）、模型名称（LLM_MODEL）和提供商名称（LLM_PROVIDER）
3. IF LLM API返回错误响应，THEN THE LLM_Adapter SHALL 实施最多3次的指数退避重试策略（基础延迟1秒，倍数2）
4. IF 重试次数耗尽后仍失败，THEN THE LLM_Adapter SHALL 返回包含错误详情的结构化错误对象（LLMError），包含状态码、重试次数、提供商名称和是否可重试标志
5. WHEN LLM_Adapter发送请求时，THE LLM_Adapter SHALL 记录请求的token数量和响应时间用于监控

### 需求 10：国际化支持（生成相关）

**用户故事：** 作为国际用户，我希望系统能根据我选择的语言生成对应语言的剧本内容。

#### 验收标准

1. WHEN Generator生成Script时，THE Generator SHALL 根据Config中的language字段生成对应语言的剧本内容
2. THE Config SHALL 支持language字段，默认值为"zh"（中文）
3. THE System SHALL 在后端API响应中支持根据请求语言返回对应语言的错误信息和提示文本
