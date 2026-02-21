# 需求文档：角色沉浸式叙事故事生成

## 简介

当前剧本杀AI生成系统的玩家手册中，每幕的 `personalNarrative` 字段仅包含简短的角色视角故事片段，缺乏沉浸感和代入感。本功能将该字段升级为丰富的第二人称（"你"）沉浸式叙事文本，让每位玩家在阅读时能真正"成为"自己的角色。叙事内容将以第二人称视角描写每一幕发生的事件，如"你走进昏暗的大厅，注意到角落里有一个可疑的身影"，包含角色的内心活动、情感反应、对其他角色的主观判断，以及角色所相信的误导性信息（如被栽赃的角色会以"你"的视角描述可疑情境，持有错误信念的角色会将错误信息当作事实叙述）。覆盖范围包括序幕、每一幕和终幕，为所有玩家角色生成完整的沉浸式叙事体验。

## 术语表

- **ImmersiveNarrative（沉浸式叙事）**：以第二人称（"你"）视角撰写的富文本故事，将玩家直接置于角色的处境中，描述角色的所见所闻、内心活动、情感反应和主观判断，目的是让玩家产生强烈的代入感
- **MisleadingBelief（误导性信念）**：角色基于自身视角和有限信息所持有的错误或片面认知，在叙事中作为"事实"呈现给玩家，增加推理难度和角色扮演深度
- **NarrativeVoice（叙事语气）**：角色在第二人称叙事中的独特表达风格，由角色的性格特征（personality）、MBTI类型和背景决定，影响对"你"的描述方式和情感基调
- **Generator（生成引擎）**：核心AI生成模块，负责调用LLM生成剧本内容
- **PlayerActContent（玩家幕内容）**：玩家手册中每幕的角色专属内容结构
- **PlayerPrologueContent（玩家序幕内容）**：玩家手册中序幕的角色专属内容结构
- **PlayerFinaleContent（玩家终幕内容）**：玩家手册中终幕的角色专属内容结构
- **CharacterProfile（角色设定）**：角色的完整设定信息，包含性格、背景、动机、秘密、关系等
- **PlayableStructure（可游玩结构）**：按幕组织的完整剧本结构
- **Act（幕）**：剧本的基本游玩单元
- **NarrativeConsistency（叙事一致性）**：不同角色对同一事件的叙述在客观事实层面保持一致，仅在主观感受和信息掌握程度上存在差异

## 需求

### 需求 1：序幕沉浸式叙事生成

**用户故事：** 作为玩家，我希望在序幕阶段就能阅读到以第二人称（"你"）视角撰写的沉浸式背景故事，以便我从游戏一开始就能代入角色。

#### 验收标准

1. WHEN Generator生成PlayerPrologueContent时，THE Generator SHALL 生成一段以第二人称（"你"）视角撰写的沉浸式叙事文本（immersiveNarrative），内容基于该角色的backgroundStory、personality和relationships
2. WHEN Generator生成序幕沉浸式叙事时，THE Generator SHALL 在叙事中融入角色的内心独白和情感基调，体现角色的NarrativeVoice
3. WHEN 角色的CharacterProfile包含secrets时，THE Generator SHALL 在序幕叙事中以暗示或伏笔的方式埋入角色秘密相关的线索，但不直接揭露秘密内容
4. WHEN 角色持有MisleadingBelief时，THE Generator SHALL 在序幕叙事中将该误导性信念作为角色认知的一部分自然呈现，不标注其为误导信息

### 需求 2：每幕沉浸式叙事生成

**用户故事：** 作为玩家，我希望在每一幕都能阅读到以第二人称（"你"）视角描写的故事，以便我了解这一幕中我的角色经历了什么、看到了什么、想了什么。

#### 验收标准

1. WHEN Generator生成PlayerActContent时，THE Generator SHALL 将personalNarrative字段生成为不少于300字的第二人称（"你"）沉浸式叙事文本，描述该角色在本幕中的经历、观察和内心活动
2. WHEN Generator生成每幕叙事时，THE Generator SHALL 基于以下输入生成内容：该幕的全局叙述（Act.narrative）、角色的CharacterProfile（personality、primaryMotivation、secrets）、角色在本幕的objectives和clueHints、以及前序幕的叙事内容
3. WHEN 角色在某幕中涉及关键事件时，THE Generator SHALL 在叙事中以角色的主观视角描述该事件，包含角色的情感反应和对事件的个人解读
4. WHEN 角色在某幕中持有MisleadingBelief时，THE Generator SHALL 在叙事中将误导性信息以角色的确信口吻呈现，使玩家自然接受角色的认知视角
5. WHEN 角色的narrativeRole为murderer时，THE Generator SHALL 在叙事中合理隐藏角色的犯罪行为，以角色的视角提供看似合理的替代解释或刻意回避关键细节
6. WHEN 角色的narrativeRole为suspect时，THE Generator SHALL 在叙事中呈现可能让该角色显得可疑的情境描述，同时保留角色自身的无辜视角

### 需求 3：终幕沉浸式叙事生成

**用户故事：** 作为玩家，我希望在终幕阶段也能阅读到第二人称视角的叙事，以便我在最终投票和陈述前有充分的角色代入感。

#### 验收标准

1. WHEN Generator生成PlayerFinaleContent时，THE Generator SHALL 生成一段以第二人称（"你"）视角撰写的终幕沉浸式叙事文本（immersiveNarrative），描述角色在最终阶段的心理状态和对整个事件的回顾
2. WHEN Generator生成终幕叙事时，THE Generator SHALL 基于角色在前序所有幕中的经历和积累的信息，呈现角色对事件全貌的个人理解
3. WHEN 角色的narrativeRole为murderer时，THE Generator SHALL 在终幕叙事中体现角色面对最终审判的心理压力，同时维持角色的伪装叙事视角

### 需求 4：叙事语气与角色一致性

**用户故事：** 作为玩家，我希望叙事文本的语气和风格能反映我角色的性格特征，以便不同角色的叙事读起来有明显的个性差异。

#### 验收标准

1. WHEN Generator生成ImmersiveNarrative时，THE Generator SHALL 根据角色的personality和mbtiType调整叙事的用词风格、句式结构和情感表达方式
2. WHEN 角色的personality描述为内向型特征时，THE Generator SHALL 在叙事中增加内心独白和观察描写的比重，减少对话和社交互动的描写
3. WHEN 角色的personality描述为外向型特征时，THE Generator SHALL 在叙事中增加与他人互动、对话回忆和社交场景的描写比重
4. THE Generator SHALL 确保同一角色在序幕、各幕和终幕中的叙事语气保持一致的NarrativeVoice，不出现风格突变

### 需求 5：跨角色叙事一致性

**用户故事：** 作为DM，我希望不同角色对同一事件的叙述在客观事实层面保持一致，以便游戏逻辑不出现矛盾。

#### 验收标准

1. WHEN 同一幕中多个角色的叙事涉及相同事件时，THE Generator SHALL 确保事件的客观要素（时间、地点、参与者、可观察行为）在不同角色叙事中保持一致
2. WHEN 不同角色对同一事件持有不同主观解读时，THE Generator SHALL 仅在主观感受、动机推测和信息掌握程度上体现差异，客观事实描述保持一致
3. WHEN Generator生成某角色的叙事时，THE Generator SHALL 仅包含该角色在该幕中合理可知的信息，不泄露该角色不应知道的其他角色秘密或未获得的线索内容

### 需求 6：LLM提示词模板适配

**用户故事：** 作为开发者，我希望LLM提示词模板能有效引导AI生成高质量的沉浸式叙事，以便生成结果符合沉浸感和一致性要求。

#### 验收标准

1. WHEN Generator构建沉浸式叙事生成的提示词时，THE Generator SHALL 在系统提示词中定义第二人称（"你"）叙事的写作规范，包括：视角限制（仅描述角色可感知的内容）、人称要求（全程使用"你"作为叙事主语）、语气要求（匹配角色性格）、误导信息处理规则（以角色确信口吻呈现）
2. WHEN Generator构建每幕叙事的用户提示词时，THE Generator SHALL 注入以下上下文：角色完整设定（CharacterProfile）、本幕全局叙述（Act.narrative）、本幕角色目标和线索提示、前序幕叙事摘要、角色在本幕应持有的MisleadingBelief列表
3. WHEN Generator解析LLM返回的叙事内容时，THE Generator SHALL 验证返回文本为第二人称视角（包含"你"作为叙事主语）且字数不少于300字
4. WHEN Generator为同一幕的多个角色生成叙事时，THE Generator SHALL 在提示词中包含本幕的事件事实摘要，确保各角色叙事的客观事实基础一致

### 需求 7：数据结构扩展

**用户故事：** 作为开发者，我希望现有的数据结构能支持存储沉浸式叙事内容，以便系统能正确保存和传递生成的叙事文本。

#### 验收标准

1. THE PlayerPrologueContent SHALL 包含新增字段 immersiveNarrative（string类型），用于存储序幕的第二人称沉浸式叙事文本
2. THE PlayerActContent SHALL 将现有的personalNarrative字段升级为存储不少于300字的第二人称沉浸式叙事文本，保持字段名称不变以确保向后兼容
3. THE PlayerFinaleContent SHALL 包含新增字段 immersiveNarrative（string类型），用于存储终幕的第二人称沉浸式叙事文本
4. WHEN PlayableStructure序列化为JSON后再反序列化时，THE System SHALL 产生与原始结构等价的结果，包含所有沉浸式叙事字段（往返一致性）
5. WHEN 系统读取不包含immersiveNarrative字段的旧版PlayerPrologueContent或PlayerFinaleContent时，THE System SHALL 将immersiveNarrative视为空字符串，正常运行不报错

