# 需求文档：角色优先两阶段生成

## 简介

本功能将现有的剧本生成子系统（script-generation）从一次性生成流程改造为"角色优先"的两阶段生成流程。第一阶段根据配置参数生成角色设定（主角和NPC的性格、背景、关系、动机等），第二阶段基于已生成的角色设定生成完整的故事内容（时间线、诡计、线索、分支结构等）。两阶段之间用户可选择审查和调整角色设定，从而在故事生成前确保角色基础符合预期。

本功能范围包括：角色设定数据模型定义、第一阶段角色生成引擎、角色设定审查与调整接口、角色设定持久化与复用、第二阶段故事生成引擎、两阶段生成任务编排、以及对现有异步生成流程的适配。

## 术语表

- **Generator（生成引擎）**：核心AI生成模块，负责调用LLM并结合Skill模板生成剧本杀内容
- **Config（配置参数）**：用户定义的剧本生成参数集合，包含玩家人数、时长、游戏类型等
- **CharacterProfile（角色设定）**：第一阶段生成的角色完整设定，包含性别、血型、MBTI类型、性格特征、背景故事、外貌描述、人物关系、核心动机和秘密
- **CharacterType（角色类型）**：区分玩家角色（player）和NPC角色（npc）。玩家角色由玩家扮演，NPC角色由DM控制或作为故事背景角色
- **Character（角色）**：持久化到 MySQL 的角色基本设计，包含生日、性格、能力等与具体剧本无关的基础设定，可跨剧本复用
- **ScriptCharacterSet（剧本角色关系）**：角色与剧本的关联记录（`script_character_sets` 表），通过 characterId 和 scriptId 连接角色与剧本，包含该角色在某个剧本中的动机、经历概述、叙事功能等剧本相关信息
- **StoryContent（故事内容）**：第二阶段基于角色设定生成的完整故事，包含时间线、诡计、线索、分支结构等
- **GenerationPhase（生成阶段）**：两阶段生成流程中的阶段标识，分为 character（角色阶段）和 story（故事阶段）
- **CharacterDraft（角色草稿）**：第一阶段生成后、用户审查前的角色设定中间产物
- **LLM_Adapter（LLM适配器）**：与大语言模型API交互的适配层
- **Script（剧本）**：最终生成的完整剧本杀内容包
- **Skill（技能模板）**：预定义的剧本杀生成辅助模板

## 需求

### 需求 1：角色设定数据模型

**用户故事：** 作为剧本创作者，我希望系统能以结构化的方式表达角色设定，以便我能清晰地审查和调整每个角色的核心属性。

#### 验收标准

1. THE CharacterProfile SHALL 包含以下必填字段：角色唯一标识（characterId）、角色名称（characterName）、角色类型（characterType，取值为 player 或 npc）、性别（gender）、血型（bloodType，取值为 A/B/O/AB）、MBTI类型（mbtiType，如 INTJ、ENFP 等16种类型）、性格特征描述（personality）、外貌描述（appearance，用于后续角色形象生成）、背景故事（backgroundStory）、核心动机（primaryMotivation）、秘密列表（secrets，至少一项）
2. THE CharacterProfile SHALL 包含以下关系字段：与其他角色的关系列表（relationships），每条关系包含目标角色标识（targetCharacterId）、目标角色名称（targetCharacterName）、关系类型（relationshipType）和关系描述（description）
3. THE CharacterProfile SHALL 包含以下可选字段：次要动机列表（secondaryMotivations）、特殊能力或特质（specialTraits）、角色在故事中的功能定位（narrativeRole，如凶手、侦探、目击者、嫌疑人等）
4. WHEN 角色设定集合包含N个CharacterProfile时，THE CharacterProfile SHALL 确保每个角色的relationships中引用的targetCharacterId都指向集合中存在的其他角色
5. WHEN CharacterProfile被序列化为JSON后再反序列化时，THE CharacterProfile SHALL 产生与原始对象等价的结果（往返一致性）

### 需求 2：第一阶段 — 角色设定生成

**用户故事：** 作为剧本创作者，我希望系统能根据配置参数先生成一组角色设定，以便我在故事生成前审查角色是否符合预期。

#### 验收标准

1. WHEN 用户提交有效的Config后，THE Generator SHALL 调用LLM_Adapter执行第一阶段生成，仅生成角色设定（CharacterProfile列表），不生成故事内容
2. WHEN Generator执行第一阶段生成时，THE Generator SHALL 在LLM提示词中包含以下配置信息：玩家人数、游戏类型、目标年龄段、时代背景、地点设定、主题风格
3. WHEN Generator执行第一阶段生成时，THE Generator SHALL 从SkillService获取角色设计（character_design）和动机设计（motive）类别的Skill模板，注入LLM提示词
4. WHEN 第一阶段生成完成后，THE Generator SHALL 返回的CharacterProfile中，characterType为player的角色数量与Config中指定的玩家人数一致，同时可包含若干characterType为npc的角色（NPC数量由LLM根据故事需要自行决定）
5. WHEN 第一阶段生成完成后，THE Generator SHALL 确保生成的角色之间存在至少一组对立关系和至少一组合作关系
6. WHEN Generator执行第一阶段生成时，THE Generator SHALL 确保生成的角色性格特征（personality）与其MBTI类型（mbtiType）和血型（bloodType）之间保持合理的一致性。例如，INTJ类型的角色应体现出独立思考和战略规划的性格特征，而非外向社交型性格
7. WHEN Config的gameType为shin_honkaku且包含specialSetting时，THE Generator SHALL 在第一阶段提示词中包含特殊设定信息，确保角色设定与特殊世界观设定兼容
8. WHEN 第一阶段生成角色时，THE Generator SHALL 在LLM提示词中要求为每个角色生成详细的外貌描述（appearance），包括体貌特征、穿着风格等，以便后续用于角色形象图片生成
9. IF 第一阶段LLM调用失败，THEN THE Generator SHALL 返回包含阶段标识（character）和错误详情的结构化错误信息

### 需求 3：角色设定审查与调整

**用户故事：** 作为剧本创作者，我希望在故事生成前能审查和调整角色设定，以便确保角色基础符合我的创作意图。

#### 验收标准

1. WHEN 第一阶段生成完成后，THE Generator SHALL 将角色设定作为CharacterDraft存储，状态标记为待审查（pending_review）
2. WHEN 用户审查角色设定时，THE Generator SHALL 提供获取当前CharacterDraft的接口，返回完整的角色设定列表
3. WHEN 用户修改某个角色的设定字段后，THE Generator SHALL 更新对应的CharacterProfile并重新校验角色间关系引用的一致性
4. WHEN 用户确认角色设定后，THE Generator SHALL 将CharacterDraft状态更新为已确认（confirmed），允许进入第二阶段生成
5. WHEN 用户选择跳过审查直接生成时，THE Generator SHALL 自动将CharacterDraft状态设为已确认，立即进入第二阶段生成
6. IF 用户修改角色设定导致关系引用不一致（如删除了被其他角色引用的角色），THEN THE Generator SHALL 返回具体的一致性校验错误信息

### 需求 4：第二阶段 — 基于角色的故事生成

**用户故事：** 作为剧本创作者，我希望系统能基于已确认的角色设定生成完整的故事内容，以便角色和故事之间保持高度一致。

#### 验收标准

1. WHEN 用户触发第二阶段生成时，THE Generator SHALL 读取已确认的CharacterDraft，将完整的角色设定注入LLM提示词
2. WHEN Generator执行第二阶段生成时，THE Generator SHALL 在LLM提示词中包含完整的角色设定（性格、背景、关系、动机、秘密），以及原始Config中的所有配置参数
3. WHEN Generator执行第二阶段生成时，THE Generator SHALL 从SkillService获取所有类别的Skill模板（线索设计、时间线、诡计设计、还原逻辑、推理链条等），注入LLM提示词
4. WHEN 第二阶段生成完成后，THE Generator SHALL 生成完整的StoryContent，包含：DM手册（时间线、线索分发表、轮次指引、分支决策点、结局）、玩家手册（仅为characterType为player的角色生成，基于角色设定扩展的完整手册）、游戏物料（线索卡、道具卡等）、分支结构、可游玩结构（PlayableStructure）
5. WHEN 第二阶段生成玩家手册时，THE Generator SHALL 确保每个玩家手册的角色名称、背景故事和关系描述与第一阶段确认的CharacterProfile保持一致，且仅为characterType为player的角色生成玩家手册
6. WHEN 第二阶段生成DM手册时，THE Generator SHALL 确保时间线中涉及的角色与第一阶段确认的角色集合一致（包含player和npc角色），不引入未定义的角色
7. IF 第二阶段LLM调用失败，THEN THE Generator SHALL 返回包含阶段标识（story）和错误详情的结构化错误信息，且已确认的CharacterDraft保持不变，允许用户重新触发第二阶段

### 需求 5：两阶段生成任务编排

**用户故事：** 作为剧本创作者，我希望两阶段生成流程能通过异步任务管理，以便我能随时查看生成进度和当前阶段状态。

#### 验收标准

1. WHEN 用户启动两阶段生成时，THE Generator SHALL 创建一个生成任务（GenerateJob），任务状态依次经历：pending → generating_characters → characters_ready → generating_story → completed
2. WHEN 生成任务处于generating_characters状态时，THE Generator SHALL 执行第一阶段角色生成，完成后将状态更新为characters_ready
3. WHEN 生成任务处于characters_ready状态时，THE Generator SHALL 等待用户确认角色设定或选择跳过审查后，再将状态更新为generating_story并执行第二阶段
4. WHEN 用户查询生成任务状态时，THE Generator SHALL 返回当前阶段标识（character或story）、阶段状态、以及角色设定数据（如果第一阶段已完成）
5. IF 任一阶段生成失败，THEN THE Generator SHALL 将任务状态更新为failed，并记录失败的阶段标识和错误信息
6. WHEN 用户选择跳过审查的自动模式时，THE Generator SHALL 在第一阶段完成后自动进入第二阶段，无需等待用户确认

### 需求 6：反馈驱动的角色优化

**用户故事：** 作为剧本创作者，我希望系统在基于反馈优化剧本时也采用两阶段流程，以便角色设定能根据反馈单独优化。

#### 验收标准

1. WHEN Generator基于反馈优化已有Script时，THE Generator SHALL 先从原始Script中提取角色设定，结合反馈数据生成优化后的角色设定
2. WHEN 反馈数据中角色相关维度（如角色深度、角色动机合理性）评分低于6分时，THE Generator SHALL 在第一阶段优化提示词中重点标注这些维度
3. WHEN 角色设定优化完成后，THE Generator SHALL 基于优化后的角色设定执行第二阶段故事生成，创建新版本Script

### 需求 7：向后兼容

**用户故事：** 作为系统管理员，我希望新的两阶段生成流程不破坏现有的一次性生成功能，以便系统能平滑过渡。

#### 验收标准

1. THE Generator SHALL 支持通过生成模式参数（generationMode）选择一次性生成（oneshot）或两阶段生成（character_first），默认值为oneshot
2. WHEN generationMode为oneshot时，THE Generator SHALL 保持现有的一次性生成行为不变
3. WHEN generationMode为character_first时，THE Generator SHALL 执行两阶段生成流程
4. THE Generator SHALL 确保两种生成模式产出的最终Script对象结构一致，下游消费方无需区分生成模式

### 需求 8：角色持久化与跨剧本复用

**用户故事：** 作为剧本创作者，我希望已确认的角色设定能持久化保存到数据库，并在后续创建新剧本时复用已有角色，以便角色能积累多段剧本"经历"形成丰富的角色档案。

#### 验收标准

1. THE System SHALL 提供 `characters` 表存储角色基本设计，包含以下字段：角色唯一标识（id）、角色名称（name）、角色类型（characterType，取值为 player 或 npc）、性别（gender）、生日（birthday）、血型（bloodType，取值为 A/B/O/AB）、MBTI类型（mbtiType）、性格特征（personality）、能力/特长（abilities）、外貌描述（appearance）、标签列表（tags，JSON数组）、创建时间（createdAt）、更新时间（updatedAt）
2. THE System SHALL 提供 `script_character_sets` 关联表连接角色与剧本，包含以下字段：关联唯一标识（id）、角色标识（characterId）、剧本标识（scriptId）、角色在此剧本中的类型（characterType，取值为 player 或 npc）、该角色在此剧本中的动机（motivation）、经历概述（experienceSummary）、叙事功能定位（narrativeRole）、角色在此剧本中的秘密列表（secrets，JSON数组）、关联创建时间（createdAt）
3. WHEN 用户在第一阶段确认角色设定（CharacterDraft status → confirmed）时，THE System SHALL 将每个 CharacterProfile 持久化到 `characters` 表（如果该角色不存在），并在 `script_character_sets` 表中创建与当前剧本的关联记录
4. WHEN 用户启动新的两阶段生成时，THE System SHALL 提供接口列出已保存的角色列表，允许用户选择已有角色作为第一阶段的输入，跳过或部分跳过角色生成
5. WHEN 用户选择复用已有角色时，THE System SHALL 从 `characters` 表读取角色基本设计，结合新剧本的 Config 参数生成该角色在新剧本中的动机和经历，写入 `script_character_sets` 关联记录
6. WHEN 用户查询某个角色的详情时，THE System SHALL 返回角色基本设计以及该角色参与过的所有剧本列表（经历列表），每条经历包含剧本标题、动机和经历概述
7. WHEN 第二阶段故事生成完成后，THE System SHALL 自动更新 `script_character_sets` 中对应记录的经历概述（experienceSummary），基于生成的故事内容提取该角色的关键经历
8. THE System SHALL 提供角色 CRUD API：创建角色（POST）、查询角色列表（GET，支持按名称/标签筛选）、查询角色详情含经历（GET）、更新角色基本设计（PUT）、删除角色（DELETE，仅当无关联剧本时允许）
