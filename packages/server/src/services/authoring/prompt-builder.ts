/**
 * 提示词构建器 - 为分阶段创作的每个阶段构建专用 LLM 提示词
 * Requirements: 3.1, 4.1, 4.6, 5.1, 5.7
 */

import {
  ScriptConfig,
  LLMRequest,
  SkillTemplate,
  ScriptPlan,
  ScriptOutline,
  ChapterType,
  Chapter,
} from '@murder-mystery/shared';

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
  ): LLMRequest;
}

/** 构建配置参数描述段落 */
function buildConfigSection(config: ScriptConfig): string {
  return `【配置参数】
- 玩家人数：${config.playerCount}
- 游戏时长：${config.durationHours}小时
- 游戏类型：${config.gameType}
- 目标年龄段：${config.ageGroup}
- 还原比例：${config.restorationRatio}%
- 推理比例：${config.deductionRatio}%
- 时代背景：${config.era}
- 地点设定：${config.location}
- 主题风格：${config.theme}
- 轮次数：${config.roundStructure.totalRounds}`;
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
    const systemPrompt = `你是一个专业的剧本杀企划师。请根据给定的配置参数生成一份剧本企划书。
请严格按照以下JSON格式输出，不要输出任何JSON以外的内容。

输出格式：
{
  "worldOverview": "世界观概述",
  "characters": [
    { "name": "角色名", "role": "角色定位", "relationshipSketch": "关系草图" }
  ],
  "coreTrickDirection": "核心诡计方向",
  "themeTone": "主题基调",
  "eraAtmosphere": "时代氛围描述"
}`;

    const prompt = `${buildConfigSection(config)}${buildSkillSection(skills)}

请根据以上配置生成剧本企划书，确保：
1. 角色数量 = ${config.playerCount}
2. 世界观与时代背景（${config.era}）和地点设定（${config.location}）一致
3. 核心诡计方向符合游戏类型（${config.gameType}）的特点
4. 主题基调与目标年龄段（${config.ageGroup}）匹配`;

    return {
      prompt,
      systemPrompt,
      maxTokens: 4096,
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

    const notesSection = authorNotes
      ? `\n\n【作者备注】\n${authorNotes}`
      : '';

    const prompt = `${buildConfigSection(config)}

${planSection}${buildSkillSection(skills)}${notesSection}

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
  ): LLMRequest {
    const chapterLabel = CHAPTER_TYPE_LABELS[chapterType];

    const systemPrompt = `你是一个专业的剧本杀编剧。请根据已批准的剧本大纲生成${chapterLabel}内容。
请严格按照JSON格式输出，不要输出任何JSON以外的内容。`;

    const outlineSection = `【已批准的剧本大纲】
${JSON.stringify(approvedOutline, null, 2)}`;

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

${outlineSection}${previousSection}

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
