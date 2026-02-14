/**
 * 提示词构建器 - 为分阶段创作的每个阶段构建专用 LLM 提示词
 * Requirements: 3.1, 4.1, 4.6, 5.1, 5.7
 */

import {
  ScriptConfig,
  ScriptStyle,
  GameType,
  LLMRequest,
  SkillTemplate,
  ScriptPlan,
  ScriptOutline,
  ChapterType,
  Chapter,
} from '@murder-mystery/shared';

/** 每种风格对应的叙事指导描述 */
const STYLE_DIRECTIVES: Record<ScriptStyle, string> = {
  [ScriptStyle.DETECTIVE]: '正统侦探风格（悬疑）：以严密的逻辑推理为核心，叙事冷静克制，注重证据链和推理过程。语言风格沉稳、精确，营造紧张的悬疑氛围。角色对话偏理性分析，线索设计环环相扣。',
  [ScriptStyle.DRAMA]: '戏影侦探风格（搞笑）：以幽默搞笑为核心基调，大量使用谐音梗、无厘头桥段和喜剧反转。角色性格夸张滑稽，对话充满笑点和吐槽，场景设计荒诞有趣。在保持推理逻辑的同时让玩家笑声不断，线索可能藏在搞笑的误会和闹剧之中。整体氛围轻松欢乐，适合聚会娱乐。',
  [ScriptStyle.DISCOVER]: '寻迹侦探风格（探索）：以多分支、多结局的剧情架构为核心特色。设计大量隐藏内容、秘密房间、暗线剧情，玩家的不同选择会导向截然不同的故事走向和结局。线索层层嵌套，表面之下还有更深的秘密等待发掘。鼓励玩家主动探索和冒险，每次游玩都可能发现新的内容。注重可重玩性和探索的成就感。',
  [ScriptStyle.DESTINY]: '命运侦探风格（浪漫）：以命运交织和浪漫情感为基调，叙事唯美抒情，注重缘分和宿命感的营造。线索设计与情感线交织，角色之间有深层的命运羁绊，结局带有浪漫色彩。',
  [ScriptStyle.DREAM]: '幻梦侦探风格（叙诡）：采用梦幻叙事手法，真实与幻想交替描述，让玩家难辨真假。善用叙述性诡计，通过不可靠叙述者、时间错位、梦境嵌套等手法模糊现实边界。线索可能存在于梦境中也可能是现实的碎片，玩家需要分辨哪些是真实发生的、哪些是幻觉或梦境。语言风格迷离恍惚，场景在清醒与梦境间无缝切换。',
  [ScriptStyle.DIMENSION]: '赛博侦探风格（科幻）：融合高科技设定，场景中可以出现全息投影、传送门、太空飞船、AI助手、虚拟现实、量子通讯等未来科技元素。世界观充满赛博朋克或太空歌剧美学，线索可能涉及数据破解、科技装置、星际航行日志等。角色可以是黑客、星际探员、AI觉醒体等。语言风格前卫酷炫，科技感十足。',
  [ScriptStyle.DEATH]: '幽冥侦探风格（恐怖）：充满未知与恐惧的恐怖叙事。可融合多种恐怖子类型：民俗恐怖（乡村禁忌、祭祀仪式、民间传说）、日式恐怖（怨灵、诅咒、湿冷阴森的压迫感）、哥特式恐怖（古堡、吸血鬼、暗黑浪漫）、克苏鲁恐怖（不可名状之物、理智崩溃、宇宙级未知恐惧）。场景描写充满死亡气息和不祥预兆，角色面对超越认知的未知存在。线索设计融入超自然元素，真相可能触及人类理解的边界。',
};

export interface IPromptBuilder {
  buildPlanningPrompt(config: ScriptConfig, skills: SkillTemplate[]): LLMRequest;
  buildDesignPrompt(
    config: ScriptConfig,
    approvedPlan: ScriptPlan,
    skills: SkillTemplate[],
    authorNotes?: string,
  ): LLMRequest;
  buildChapterPrompt(
    config: ScriptConfig,
    approvedOutline: ScriptOutline,
    chapterType: ChapterType,
    chapterIndex: number,
    previousChapters: Chapter[],
    approvedPlan?: ScriptPlan,
  ): LLMRequest;
}

/** 构建配置参数描述段落 */
function buildConfigSection(config: ScriptConfig): string {
  let section = `【配置参数】
- 玩家人数：${config.playerCount}
- 游戏时长：${config.durationHours}小时
- 游戏类型：${config.gameType}
- 目标年龄段：${config.ageGroup}
- 还原比例：${config.restorationRatio}%
- 推理比例：${config.deductionRatio}%
- 时代背景：${config.era}
- 地点设定：${config.location}
- 主题风格：${config.theme}
- 轮次数：${config.roundStructure.totalRounds}

【叙事风格指导】
${STYLE_DIRECTIVES[config.style] || STYLE_DIRECTIVES[ScriptStyle.DETECTIVE]}
请在所有生成内容中严格遵循上述叙事风格，包括语言风格、氛围营造、角色对话语气、线索呈现方式等。`;

  if (config.gameType === GameType.SHIN_HONKAKU) {
    section += `\n\n【新本格（设定本格）特别说明】
本剧本为新本格推理类型。新本格的核心特征是：在故事世界中存在一个或多个"独特设定"（如超能力、特殊规则、奇幻元素、叙述性诡计等），这些设定在游戏开始前就会明确告知所有玩家，作为推理的前提条件。所有诡计和推理都必须在这些设定的框架内成立，不能违反已公开的设定规则。`;
    if (config.specialSetting) {
      section += `\n用户指定的设定方向：${config.specialSetting.settingDescription}`;
    }
  }

  return section;
}

/** 构建 Skill 模板参考段落 */
function buildSkillSection(skills: SkillTemplate[]): string {
  if (skills.length === 0) return '';
  return `\n\n【Skill模板参考】\n${skills.map(s => `[${s.name}] ${s.content}`).join('\n')}`;
}

/** 章节类型中文名映射 */
const CHAPTER_TYPE_LABELS: Record<ChapterType, string> = {
  dm_handbook: 'DM手册',
  player_handbook: '玩家手册',
  materials: '游戏物料集',
  branch_structure: '分支结构详情',
};

export class PromptBuilder implements IPromptBuilder {
  /**
   * 构建企划阶段提示词
   * Req 3.1: 基于 Config 和匹配的 Skill 模板调用 LLM 生成 ScriptPlan
   */
  buildPlanningPrompt(config: ScriptConfig, skills: SkillTemplate[]): LLMRequest {
    const isShinHonkaku = config.gameType === GameType.SHIN_HONKAKU;

    let outputFormat = `{
  "worldOverview": "世界观概述",
  "characters": [
    { "name": "角色名", "role": "角色定位", "relationshipSketch": "关系草图" }
  ],
  "coreTrickDirection": "核心诡计方向",
  "themeTone": "主题基调",
  "eraAtmosphere": "时代氛围描述"`;

    if (isShinHonkaku) {
      outputFormat += `,
  "specialSetting": {
    "settingName": "设定名称（如：灵魂交换、时间回溯等）",
    "settingDescription": "详细描述这个独特设定的内容，包括它如何运作、有什么限制",
    "settingRules": ["规则1：...", "规则2：...", "规则3：..."],
    "impactOnDeduction": "说明这个设定如何影响推理过程，玩家需要如何利用/考虑这个设定来推理"
  }`;
    }
    outputFormat += '\n}';

    const systemPrompt = `你是一个专业的剧本杀企划师。请根据给定的配置参数生成一份剧本企划书。
请严格按照以下JSON格式输出，不要输出任何JSON以外的内容。

输出格式：
${outputFormat}`;

    let requirements = `请根据以上配置生成剧本企划书，确保：
1. 角色数量 = ${config.playerCount}
2. 世界观与时代背景（${config.era}）和地点设定（${config.location}）一致
3. 核心诡计方向符合游戏类型（${config.gameType}）的特点
4. 主题基调与目标年龄段（${config.ageGroup}）匹配`;

    if (isShinHonkaku) {
      requirements += `
5. 【重要】必须设计一个独特且有趣的"特殊设定"（specialSetting），这是新本格推理的核心。设定应当：
   - 新颖有创意，不落俗套
   - 规则清晰明确，玩家能理解
   - 与诡计设计紧密结合，推理必须依赖这个设定
   - 设定本身不能直接揭示凶手，而是作为推理的工具/前提`;
    }

    const prompt = `${buildConfigSection(config)}${buildSkillSection(skills)}

${requirements}`;

    return {
      prompt,
      systemPrompt,
      maxTokens: isShinHonkaku ? 6144 : 4096,
      temperature: 0.8,
    };
  }

  /**
   * 构建大纲阶段提示词
   * Req 4.1: 基于批准后的 ScriptPlan、Config 和 Skill 模板生成 ScriptOutline
   * Req 4.6: 在提示词中包含作者备注内容
   */
  buildDesignPrompt(
    config: ScriptConfig,
    approvedPlan: ScriptPlan,
    skills: SkillTemplate[],
    authorNotes?: string,
  ): LLMRequest {
    const systemPrompt = `你是一个专业的剧本杀编剧。请根据已批准的企划书生成详细的剧本大纲。
请严格按照以下JSON格式输出，不要输出任何JSON以外的内容。

输出格式：
{
  "detailedTimeline": [{ "time": "时间", "event": "事件", "involvedCharacters": ["角色名"] }],
  "characterRelationships": [{ "characterA": "角色A", "characterB": "角色B", "relationship": "关系描述" }],
  "trickMechanism": "诡计机制细节",
  "clueChainDesign": [{ "clueId": "线索ID", "description": "描述", "leadsTo": ["关联线索ID"] }],
  "branchSkeleton": [{ "nodeId": "节点ID", "description": "描述", "options": ["选项"], "endingDirections": ["结局方向"] }],
  "roundFlowSummary": [{ "roundIndex": 0, "focus": "重点", "keyEvents": ["关键事件"] }]
}`;

    const planSection = `【已批准的企划书】
- 世界观：${approvedPlan.worldOverview}
- 角色概念：${approvedPlan.characters.map(c => `${c.name}（${c.role}）- ${c.relationshipSketch}`).join('；')}
- 核心诡计方向：${approvedPlan.coreTrickDirection}
- 主题基调：${approvedPlan.themeTone}
- 时代氛围：${approvedPlan.eraAtmosphere}`;

    const settingSection = approvedPlan.specialSetting
      ? `\n\n【新本格独特设定 — 游戏开始前公开给所有玩家】
- 设定名称：${approvedPlan.specialSetting.settingName}
- 设定描述：${approvedPlan.specialSetting.settingDescription}
- 设定规则：\n${approvedPlan.specialSetting.settingRules.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}
- 对推理的影响：${approvedPlan.specialSetting.impactOnDeduction}
注意：大纲中的所有诡计、线索、分支设计都必须在此设定框架内成立。`
      : '';

    const notesSection = authorNotes
      ? `\n\n【作者备注】\n${authorNotes}`
      : '';

    const prompt = `${buildConfigSection(config)}

${planSection}${settingSection}${buildSkillSection(skills)}${notesSection}

请根据以上企划书生成详细的剧本大纲，确保：
1. 时间线覆盖所有关键事件
2. 角色关系图谱覆盖所有角色对之间的关系
3. 线索链设计逻辑自洽，每条线索有明确的关联
4. 分支结构包含主要决策点和结局方向
5. 轮次流程与配置的轮次数（${config.roundStructure.totalRounds}）一致`;

    return {
      prompt,
      systemPrompt,
      maxTokens: 8192,
      temperature: 0.7,
    };
  }

  /**
   * 构建章节生成提示词
   * Req 5.1: 按顺序逐章节生成（DM手册、玩家手册、物料、分支结构）
   * Req 5.7: 提示词中包含已批准的前序章节内容
   */
  buildChapterPrompt(
    config: ScriptConfig,
    approvedOutline: ScriptOutline,
    chapterType: ChapterType,
    chapterIndex: number,
    previousChapters: Chapter[],
    approvedPlan?: ScriptPlan,
  ): LLMRequest {
    const chapterLabel = CHAPTER_TYPE_LABELS[chapterType];

    const systemPrompt = `你是一个专业的剧本杀编剧。请根据已批准的剧本大纲生成${chapterLabel}内容。
请严格按照JSON格式输出，不要输出任何JSON以外的内容。`;

    const outlineSection = `【已批准的剧本大纲】
${JSON.stringify(approvedOutline, null, 2)}`;

    // 新本格独特设定注入
    const settingSection = approvedPlan?.specialSetting
      ? `\n\n【新本格独特设定 — 游戏开始前公开给所有玩家】
- 设定名称：${approvedPlan.specialSetting.settingName}
- 设定描述：${approvedPlan.specialSetting.settingDescription}
- 设定规则：\n${approvedPlan.specialSetting.settingRules.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}
- 对推理的影响：${approvedPlan.specialSetting.impactOnDeduction}
注意：本章节内容必须在此设定框架内成立，不得违反已公开的设定规则。`
      : '';

    // Req 5.7: 包含前序章节内容确保一致性
    const previousSection = previousChapters.length > 0
      ? `\n\n【已生成的前序章节】\n${previousChapters.map(ch => `--- ${CHAPTER_TYPE_LABELS[ch.type]}（索引${ch.index}）---\n${JSON.stringify(ch.content, null, 2)}`).join('\n\n')}`
      : '';

    let chapterInstruction: string;

    switch (chapterType) {
      case 'dm_handbook':
        chapterInstruction = `请生成DM手册，包含：overview（概述）、characters（角色摘要列表）、timeline（时间线）、clueDistribution（线索分发表）、roundGuides（轮次指引）、branchDecisionPoints（分支决策点）、endings（结局描述）、truthReveal（真相揭示）、judgingRules（判定规则）。`;
        break;
      case 'player_handbook': {
        // 计算当前是第几个玩家手册（chapterIndex 1..N 对应玩家 0..N-1）
        const playerIndex = chapterIndex - 1;
        chapterInstruction = `请生成第${playerIndex + 1}个玩家手册（共${config.playerCount}个玩家），包含：characterId、characterName、backgroundStory、primaryGoal、secondaryGoals、relationships、knownClues、roundActions、secrets。确保只包含该角色应知的信息。`;
        break;
      }
      case 'materials':
        chapterInstruction = `请生成游戏物料集，包含所有线索卡、道具卡、投票卡、场景卡等物料。每个物料包含：id、type（clue_card/prop_card/vote_card/scene_card）、content、associatedCharacterId（可选）、metadata。确保每张线索卡的clueId在DM手册线索分发表中都有对应条目。`;
        break;
      case 'branch_structure':
        chapterInstruction = `请生成分支结构详情，包含：nodes（分支节点列表）、edges（分支边列表）、endings（结局列表）。确保从起始节点出发，任意路径都能到达至少一个结局。`;
        break;
    }

    const prompt = `${buildConfigSection(config)}

${outlineSection}${settingSection}${previousSection}

【当前任务】生成第${chapterIndex + 1}章：${chapterLabel}

${chapterInstruction}`;

    return {
      prompt,
      systemPrompt,
      maxTokens: 8192,
      temperature: 0.7,
    };
  }
}
