/**
 * GeneratorService - 核心AI剧本生成引擎
 * Requirements: 3.1, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 6.5, 6.6, 10.1
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ScriptConfig,
  Script,
  ScriptStatus,
  ScriptFilters,
  SkillCategory,
  SkillTemplate,
  GameType,
  AgeGroup,
  ScriptStyle,
  RoundStructure,
  DMHandbook,
  PlayerHandbook,
  Material,
  MaterialType,
  BranchStructure,
  ClueDistributionEntry,
  AggregatedFeedback,
  LLMError,
  PlayableStructure,
  PlayablePlayerHandbook,
  GenerationMode,
  CharacterDraft,
  CharacterDraftStatus,
  CharacterProfile,
  FullCharacterProfile,
  ValidationError,
} from '@gdgeek/murder-mystery-shared';
import { ILLMAdapter } from '../adapters/llm-adapter.interface';
import { SkillService } from './skill.service';
import { pool } from '../db/mysql';
import { redis } from '../db/redis';

/** All skill categories to fetch for generation */
const ALL_CATEGORIES = Object.values(SkillCategory) as SkillCategory[];

/** Job status stored in Redis */
export interface GenerateJob {
  jobId: string;
  configId: string;
  status:
    | 'pending'
    | 'generating'              // oneshot mode
    | 'completed'
    | 'failed'
    | 'generating_characters'   // character_first: phase 1 generating
    | 'characters_ready'        // character_first: characters done, awaiting review
    | 'generating_story';       // character_first: phase 2 generating
  generationMode: GenerationMode;  // default 'oneshot'
  currentPhase?: 'character' | 'story';
  scriptId?: string;
  error?: string;
  errorPhase?: 'character' | 'story';
  createdAt: string;
  updatedAt: string;
}

const JOB_PREFIX = 'generate_job:';
const JOB_TTL = 86400; // 24h

export const CHARACTER_DRAFT_PREFIX = 'character_draft:';
export const CHARACTER_DRAFT_TTL = 86400; // 24h

export class GeneratorService {
  constructor(
    private llmAdapter: ILLMAdapter,
    private skillService: SkillService,
  ) {}

  /**
   * Start async generation: return jobId immediately, run LLM in background.
   * Progress stored in Redis, final result in MySQL.
   */
  async startGenerate(config: ScriptConfig): Promise<GenerateJob> {
    const jobId = uuidv4();
    const now = new Date().toISOString();
    const job: GenerateJob = {
      jobId,
      configId: config.id,
      status: 'pending',
      generationMode: 'oneshot',
      createdAt: now,
      updatedAt: now,
    };
    await redis.set(JOB_PREFIX + jobId, JSON.stringify(job), 'EX', JOB_TTL);

    // Fire and forget — run in background
    this.runGenerate(jobId, config).catch(() => {});

    return job;
  }

  /** Get job status from Redis */
  async getJob(jobId: string): Promise<GenerateJob | null> {
    const raw = await redis.get(JOB_PREFIX + jobId);
    if (!raw) return null;
    return JSON.parse(raw) as GenerateJob;
  }

  /** Background generation runner */
  private async runGenerate(jobId: string, config: ScriptConfig): Promise<void> {
      try {
        await this.updateJob(jobId, { status: 'generating' });
        console.log(`[Job ${jobId}] Starting generation for config ${config.id}`);

        const script = await this.generate(config);

        await this.updateJob(jobId, { status: 'completed', scriptId: script.id });
        console.log(`[Job ${jobId}] Completed. Script ID: ${script.id}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Job ${jobId}] Failed:`, errorMsg);
        await this.updateJob(jobId, { status: 'failed', error: errorMsg });
      }
    }

  /** Update job fields in Redis */
  private async updateJob(jobId: string, updates: Partial<GenerateJob>): Promise<void> {
    const raw = await redis.get(JOB_PREFIX + jobId);
    if (!raw) return;
    const job = JSON.parse(raw) as GenerateJob;
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    await redis.set(JOB_PREFIX + jobId, JSON.stringify(job), 'EX', JOB_TTL);
  }

  /**
   * Generate a complete script from config.
   * Requirements: 3.1, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.6, 10.1
   */
  async generate(config: ScriptConfig, feedback?: AggregatedFeedback): Promise<Script> {
    // 1. Get matching skill templates
    const skills = await this.skillService.getForGeneration(config.gameType, ALL_CATEGORIES);

    // 2. Build prompts
    const systemPrompt = this.buildSystemPrompt(config);
    const userPrompt = this.buildUserPrompt(config, skills, feedback);

    // 3. Call LLM
    const response = await this.llmAdapter.send({
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 20000,
    });

    // 4. Parse and validate
    const parsed = this.parseGeneratedContent(response.content);
    this.validateGenerated(parsed, config);

    // 4b. Parse and validate playable structure (if present)
    let playableStructure: PlayableStructure | undefined;
    const rawParsed = parsed as Record<string, unknown>;
    if (rawParsed.playableStructure) {
      try {
        playableStructure = this.parsePlayableContent(rawParsed.playableStructure);
        this.validatePlayableStructure(playableStructure, config, parsed.materials);
        this.validateNarrativeContent(playableStructure);
      } catch (e) {
        console.warn(`[generate] PlayableStructure parsing/validation warning: ${(e as Error).message}`);
      }
    }

    // 5. Build script object
    const script: Script = {
      id: uuidv4(),
      version: 'v1.0',
      configId: config.id,
      config,
      title: parsed.title || `${config.theme} - ${config.era}`,
      dmHandbook: parsed.dmHandbook,
      playerHandbooks: parsed.playerHandbooks,
      materials: parsed.materials,
      branchStructure: parsed.branchStructure,
      playableStructure,
      tags: [],
      status: ScriptStatus.READY,
      aiProvider: this.llmAdapter.getProviderName(),
      aiModel: this.llmAdapter.getDefaultModel(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 6. Store
    await this.storeScript(script);

    return script;
  }

  /** Build system prompt defining output JSON format */
  buildSystemPrompt(config: ScriptConfig): string {
    const langInstruction = config.language === 'zh'
      ? '请用中文生成所有内容。'
      : `Please generate all content in language: ${config.language}.`;

    let specialSettingInstruction = '';
    if (config.gameType === GameType.SHIN_HONKAKU && config.specialSetting) {
      specialSettingInstruction = `
【新本格特殊设定要求】
- 设定描述：${config.specialSetting.settingDescription}
- 设定限制：${config.specialSetting.settingConstraints}
- 所有特殊设定规则必须在DM手册overview和每个玩家手册开篇完整公开
- 诡计必须基于设定规则的边界或盲区设计，不得违反已公开的设定规则
- 推理链条在设定规则体系内必须严格自洽`;
    }

    return `你是一个专业的剧本杀内容生成器。${langInstruction}
${specialSettingInstruction}

【沉浸式叙事写作规范】
1. 视角限制：所有沉浸式叙事必须以第二人称（"你"）作为叙事主语，全程使用"你"描述角色的所见所闻、行为和感受
2. 信息边界：每个角色的叙事仅包含该角色在该幕中合理可感知的信息，不泄露其他角色的秘密或未获得的线索
3. 语气匹配：根据角色的 personality 和 mbtiType 调整叙事风格：
   - 内向型角色（I开头的MBTI）：增加内心独白和观察描写比重
   - 外向型角色（E开头的MBTI）：增加互动、对话回忆和社交场景描写
4. 误导信息处理：角色持有的误导性信念以角色确信口吻呈现，不标注为误导信息
5. 凶手视角：narrativeRole 为 murderer 的角色，叙事中合理隐藏犯罪行为，提供看似合理的替代解释
6. 嫌疑人视角：narrativeRole 为 suspect 的角色，叙事中呈现可能显得可疑的情境，同时保留无辜视角
7. 字数要求：personalNarrative 字段只需写1-2句话的角色视角摘要（沉浸式叙事将在后续步骤单独生成）
8. 序幕叙事：immersiveNarrative 留空（将在后续步骤单独生成）
9. 终幕叙事：immersiveNarrative 留空（将在后续步骤单独生成）
10. 同一角色在序幕、各幕和终幕中的叙事语气保持一致的 NarrativeVoice，不出现风格突变

请严格按照以下JSON格式输出完整剧本内容。不要输出任何JSON以外的内容。
【重要】immersiveNarrative 字段请留空字符串，personalNarrative 字段只需1-2句话摘要。沉浸式叙事将在后续步骤单独生成。

输出格式：
{
  "title": "剧本标题",
  "dmHandbook": { "overview": "", "characters": [], "timeline": [], "clueDistribution": [], "roundGuides": [], "branchDecisionPoints": [], "endings": [], "truthReveal": "", "judgingRules": { "winConditions": "", "scoringCriteria": "" } },
  "playerHandbooks": [ { "characterId": "", "characterName": "", "backgroundStory": "", "primaryGoal": "", "secondaryGoals": [], "relationships": [], "knownClues": [], "roundActions": [], "secrets": [] } ],
  "materials": [ { "id": "", "type": "clue_card|prop_card|vote_card|scene_card", "content": "", "clueId": "", "associatedCharacterId": "", "metadata": {} } ],
  "branchStructure": { "nodes": [], "edges": [], "endings": [] },
  "playableStructure": {
    "prologue": {
      "backgroundNarrative": "故事背景叙述",
      "worldSetting": "世界观描述",
      "characterIntros": [{ "characterId": "", "characterName": "", "publicDescription": "" }]
    },
    "acts": [{
      "actIndex": 1,
      "title": "幕标题",
      "narrative": "全局故事叙述（DM朗读）",
      "objectives": ["搜证目标"],
      "clueIds": ["本幕分发的线索ID"],
      "discussion": { "topics": ["讨论话题"], "guidingQuestions": ["引导问题"], "suggestedMinutes": 10 },
      "vote": { "question": "投票问题", "options": [{ "id": "", "text": "", "impact": "" }] }
    }],
    "finale": {
      "finalVote": { "question": "", "options": [{ "id": "", "text": "", "impact": "" }] },
      "truthReveal": "真相揭示文本",
      "endings": [{ "endingId": "", "name": "", "triggerCondition": "", "narrative": "", "playerEndingSummaries": [{ "characterId": "", "ending": "" }] }]
    },
    "dmHandbook": {
      "prologueGuide": { "openingScript": "", "characterAssignmentNotes": "", "rulesIntroduction": "" },
      "actGuides": [{ "actIndex": 1, "readAloudText": "", "keyEventHints": [], "clueDistributionInstructions": [{ "clueId": "", "targetCharacterId": "", "condition": "" }], "discussionGuidance": "", "voteHostingNotes": "", "dmPrivateNotes": "" }],
      "finaleGuide": { "finalVoteHostingFlow": "", "truthRevealScript": "", "endingJudgmentNotes": "" }
    },
    "playerHandbooks": [{
      "characterId": "",
      "characterName": "",
      "prologueContent": { "characterId": "", "backgroundStory": "", "relationships": [], "initialKnowledge": [], "immersiveNarrative": "" },
      "actContents": [{ "actIndex": 1, "characterId": "", "personalNarrative": "简短角色视角摘要", "objectives": [], "clueHints": [], "discussionSuggestions": [], "secretInfo": "" }],
      "finaleContent": { "characterId": "", "closingStatementGuide": "", "votingSuggestion": "", "immersiveNarrative": "" }
    }]
  }
}`;
  }

  /** Build user prompt with config, skills, and optional feedback */
  buildUserPrompt(config: ScriptConfig, skills: SkillTemplate[], feedback?: AggregatedFeedback): string {
    const configSection = `【配置参数】
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

    const skillSection = skills.length > 0
      ? `\n【Skill模板参考】\n${skills.map(s => `[${s.name}] ${s.content}`).join('\n')}`
      : '';

    let feedbackSection = '';
    if (feedback) {
      const lowScoreDimensions = feedback.dimensions
        .filter(d => d.averageScore < 6)
        .map(d => `${d.dimension}(平均${d.averageScore.toFixed(1)}分)`);

      if (lowScoreDimensions.length > 0) {
        feedbackSection = `\n【优化重点】以下维度评分较低，请重点优化：${lowScoreDimensions.join('、')}`;
      }
      if (feedback.frequentSuggestions.length > 0) {
        feedbackSection += `\n【高频建议】${feedback.frequentSuggestions.join('；')}`;
      }
    }

    const narrativeContextInstruction = `

【跨角色叙事一致性要求】
请在生成每幕叙事前，先确定该幕的事件事实摘要（时间、地点、参与者、可观察行为），
然后基于该摘要为每个角色生成各自视角的叙事。不同角色对同一事件的客观要素描述必须一致，
仅在主观感受、动机推测和信息掌握程度上体现差异。

【沉浸式叙事字段说明】
- prologueContent.immersiveNarrative：序幕第二人称沉浸式叙事
- actContents[].personalNarrative：每幕第二人称沉浸式叙事（不少于300字）
- finaleContent.immersiveNarrative：终幕第二人称沉浸式叙事`;

    return `${configSection}${skillSection}${feedbackSection}

请根据以上配置生成完整的剧本杀内容，确保：
1. 玩家手册数量 = ${config.playerCount}
2. 每张线索卡的clueId在DM手册线索分发表中都有对应条目
3. 分支结构从起始节点出发，任意路径都能到达至少一个结局
4. 每个玩家手册只包含该角色应知的信息
5. playableStructure中的中间幕（acts）数量 = ${config.roundStructure.totalRounds}
6. 每幕包含完整的游玩序列：故事叙述→搜证目标→交流建议→投票/决策
7. 幕与幕之间的故事叙述保持连贯性和递进性，情节层层推进
8. 每幕的线索分发指令（clueDistributionInstructions）中的clueId与该幕的clueIds一致
9. playableStructure.playerHandbooks中每个角色的actContents数量 = ${config.roundStructure.totalRounds}
10. 序幕（prologue）包含完整的背景叙述和角色介绍，终幕（finale）包含最终投票和真相揭示
${narrativeContextInstruction}`;
  }

  /** Parse LLM response JSON */
  parseGeneratedContent(content: string): {
      title: string;
      dmHandbook: DMHandbook;
      playerHandbooks: PlayerHandbook[];
      materials: Material[];
      branchStructure: BranchStructure;
    } {
      let jsonStr = content.trim();

      // Strategy 1: Extract from markdown code fences
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Strategy 2: Find the outermost { ... } block
      if (!jsonStr.startsWith('{')) {
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        // Log first 500 chars for debugging
        console.error('[parseGeneratedContent] Failed to parse JSON. First 500 chars:', jsonStr.slice(0, 500));
        throw new Error('Failed to parse LLM response as JSON');
      }
    }

  /** Parse and validate playable structure from LLM response.
   * Requirements: 4.4
   */
  parsePlayableContent(raw: unknown): PlayableStructure {
    if (!raw || typeof raw !== 'object') {
      throw new Error('PlayableStructure is missing or not an object');
    }

    const obj = raw as Record<string, unknown>;
    const missing: string[] = [];

    if (!obj.prologue) missing.push('prologue');
    if (!Array.isArray(obj.acts) || obj.acts.length === 0) missing.push('acts');
    if (!obj.finale) missing.push('finale');
    if (!obj.dmHandbook) missing.push('dmHandbook');
    if (!Array.isArray(obj.playerHandbooks) || obj.playerHandbooks.length === 0) missing.push('playerHandbooks');

    if (missing.length > 0) {
      throw new Error(`PlayableStructure missing required fields: ${missing.join(', ')}`);
    }

    // Default immersiveNarrative for LLM output missing the field
    const playable = raw as PlayableStructure;
    for (const ph of playable.playerHandbooks) {
      if (ph.prologueContent && ph.prologueContent.immersiveNarrative === undefined) {
        ph.prologueContent.immersiveNarrative = '';
      }
      if (ph.finaleContent && ph.finaleContent.immersiveNarrative === undefined) {
        ph.finaleContent.immersiveNarrative = '';
      }
    }

    return playable;
  }


  /** Validate generated content against config constraints */
  validateGenerated(
      parsed: { playerHandbooks: PlayerHandbook[]; dmHandbook: DMHandbook; materials: Material[]; branchStructure: BranchStructure },
      config: ScriptConfig,
    ): void {
      // Log warnings instead of throwing to allow partial results through
      if (parsed.playerHandbooks.length !== config.playerCount) {
        console.warn(
          `[validateGenerated] Player handbook count mismatch: expected ${config.playerCount}, got ${parsed.playerHandbooks.length}`,
        );
      }

      try {
        this.validateClueConsistency(parsed.dmHandbook.clueDistribution, parsed.materials);
      } catch (e) {
        console.warn(`[validateGenerated] Clue consistency warning: ${(e as Error).message}`);
      }

      try {
        this.validateBranchReachability(parsed.branchStructure);
      } catch (e) {
        console.warn(`[validateGenerated] Branch reachability warning: ${(e as Error).message}`);
      }
    }

  /**
   * Validate PlayableStructure consistency.
   * Logs warnings for each validation failure rather than throwing.
   * Requirements: 5.1, 7.1, 7.2, 7.3, 7.4
   */
  validatePlayableStructure(playable: PlayableStructure, config: ScriptConfig, materials: Material[]): void {
    // 1. acts.length === config.roundStructure.totalRounds
    if (playable.acts.length !== config.roundStructure.totalRounds) {
      console.warn(
        `[validatePlayableStructure] Act count mismatch with config: expected ${config.roundStructure.totalRounds}, got ${playable.acts.length}`,
      );
    }

    // 2. acts.length === dmHandbook.actGuides.length
    if (playable.acts.length !== playable.dmHandbook.actGuides.length) {
      console.warn(
        `[validatePlayableStructure] Act count mismatch with DM actGuides: expected ${playable.acts.length}, got ${playable.dmHandbook.actGuides.length}`,
      );
    }

    // 3. Each playerHandbook.actContents.length === acts.length
    for (const ph of playable.playerHandbooks) {
      if (ph.actContents.length !== playable.acts.length) {
        console.warn(
          `[validatePlayableStructure] Player ${ph.characterId} actContents count mismatch: expected ${playable.acts.length}, got ${ph.actContents.length}`,
        );
      }
    }

    // 4. All clueIds across acts exist in materials as clue_card
    const clueCards = materials.filter(m => m.type === MaterialType.CLUE_CARD);
    const materialClueIds = new Set(
      clueCards.map(c => (c as unknown as { clueId: string }).clueId).filter(Boolean),
    );
    const allActClueIds = new Set<string>();

    for (const act of playable.acts) {
      for (const clueId of act.clueIds) {
        allActClueIds.add(clueId);
        if (!materialClueIds.has(clueId)) {
          console.warn(
            `[validatePlayableStructure] Clue ${clueId} in act ${act.actIndex} but not found in materials`,
          );
        }
      }
    }

    // 5. All clue_card materials are referenced in at least one act's clueIds
    for (const clueId of materialClueIds) {
      if (!allActClueIds.has(clueId)) {
        console.warn(
          `[validatePlayableStructure] Clue ${clueId} in materials but not referenced in any act`,
        );
      }
    }

    // 6. Each act's clueDistributionInstructions clueIds match act.clueIds
    for (let i = 0; i < playable.acts.length; i++) {
      const act = playable.acts[i];
      const guide = playable.dmHandbook.actGuides[i];
      if (!guide) continue;

      const actClueSet = new Set(act.clueIds);
      const distClueSet = new Set(
        guide.clueDistributionInstructions.map(d => d.clueId),
      );

      for (const clueId of distClueSet) {
        if (!actClueSet.has(clueId)) {
          console.warn(
            `[validatePlayableStructure] Clue ${clueId} in actGuide[${i}] distribution but not in act[${i}].clueIds`,
          );
        }
      }
      for (const clueId of actClueSet) {
        if (!distClueSet.has(clueId)) {
          console.warn(
            `[validatePlayableStructure] Clue ${clueId} in act[${i}].clueIds but not in actGuide[${i}] distribution`,
          );
        }
      }
    }
  }

  /**
   * Validate immersive narrative content in playable structure.
   * Checks second-person perspective ("你") and minimum word count.
   * Logs warnings for each validation failure rather than throwing.
   * Requirements: 6.3
   */
  validateNarrativeContent(playable: PlayableStructure): void {
    for (const ph of playable.playerHandbooks) {
      const charId = ph.characterId;

      // Validate each act's personalNarrative: must contain "你" and be >= 300 chars
      for (const ac of ph.actContents) {
        if (!ac.personalNarrative.includes('你')) {
          console.warn(
            `[validateNarrativeContent] Player ${charId} act ${ac.actIndex} personalNarrative does not contain "你"`,
          );
        }
        if (ac.personalNarrative.length < 300) {
          console.warn(
            `[validateNarrativeContent] Player ${charId} act ${ac.actIndex} personalNarrative length ${ac.personalNarrative.length} < 300`,
          );
        }
      }

      // Validate prologueContent.immersiveNarrative: if non-empty, must contain "你"
      if (ph.prologueContent.immersiveNarrative && !ph.prologueContent.immersiveNarrative.includes('你')) {
        console.warn(
          `[validateNarrativeContent] Player ${charId} prologueContent.immersiveNarrative does not contain "你"`,
        );
      }

      // Validate finaleContent.immersiveNarrative: if non-empty, must contain "你"
      if (ph.finaleContent.immersiveNarrative && !ph.finaleContent.immersiveNarrative.includes('你')) {
        console.warn(
          `[validateNarrativeContent] Player ${charId} finaleContent.immersiveNarrative does not contain "你"`,
        );
      }
    }
  }


  /** Validate clue IDs are consistent between distribution and materials */
  validateClueConsistency(distribution: ClueDistributionEntry[], materials: Material[]): void {
    const clueCards = materials.filter(m => m.type === MaterialType.CLUE_CARD);
    const materialClueIds = new Set(clueCards.map(c => (c as unknown as { clueId: string }).clueId).filter(Boolean));
    const distributionClueIds = new Set(distribution.map(d => d.clueId));

    for (const clueId of distributionClueIds) {
      if (!materialClueIds.has(clueId)) {
        throw new Error(`Clue ${clueId} in distribution but not in materials`);
      }
    }
    for (const clueId of materialClueIds) {
      if (!distributionClueIds.has(clueId)) {
        throw new Error(`Clue ${clueId} in materials but not in distribution`);
      }
    }
  }

  /** Validate all branch paths reach at least one ending */
  validateBranchReachability(branch: BranchStructure): void {
    if (branch.nodes.length === 0) return;

    const endingIds = new Set(branch.endings.map(e => e.id));
    const startNode = branch.nodes[0];

    // BFS from start node
    const visited = new Set<string>();
    const queue = [startNode.id];
    let reachesEnding = false;

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = branch.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      for (const option of node.options) {
        if (option.endingId && endingIds.has(option.endingId)) {
          reachesEnding = true;
        }
        if (option.nextNodeId) {
          queue.push(option.nextNodeId);
        }
      }
    }

    if (!reachesEnding && branch.endings.length > 0) {
      throw new Error('Branch structure has unreachable endings');
    }
  }

  /** Serialize script to JSON */
  serializeScript(script: Script): string {
    return JSON.stringify(script, (key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    });
  }

  /** Deserialize JSON to script */
  deserializeScript(json: string | Record<string, unknown>): Script {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    obj.createdAt = new Date(obj.createdAt);
    obj.updatedAt = new Date(obj.updatedAt);

    // Backward compatibility: default immersiveNarrative for old data
    const playable = (obj as Script).playableStructure;
    if (playable) {
      for (const ph of playable.playerHandbooks) {
        if (ph.prologueContent && ph.prologueContent.immersiveNarrative === undefined) {
          ph.prologueContent.immersiveNarrative = '';
        }
        if (ph.finaleContent && ph.finaleContent.immersiveNarrative === undefined) {
          ph.finaleContent.immersiveNarrative = '';
        }
      }
    }

    return obj as Script;
  }

  /** Store script in MySQL */
  async storeScript(script: Script): Promise<void> {
    const content = this.serializeScript(script);
    await pool.execute(
      `INSERT INTO scripts (id, config_id, version, parent_version_id, title, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [script.id, script.configId, script.version, script.parentVersionId ?? null, script.title, content, script.status],
    );
  }

  /** Get script by ID */
  async getScript(id: string): Promise<Script | null> {
    const [rows] = await pool.execute('SELECT * FROM scripts WHERE id = ?', [id]);
    const results = rows as Record<string, unknown>[];
    if (results.length === 0) return null;
    return this.deserializeScript(results[0].content as string | Record<string, unknown>);
  }

  /** List scripts with optional filters */
  async listScripts(filters?: ScriptFilters): Promise<Script[]> {
    let query = 'SELECT s.* FROM scripts s';
    const params: unknown[] = [];

    if (filters?.tagIds && filters.tagIds.length > 0) {
      query += ` INNER JOIN script_tags st ON s.id = st.script_id AND st.tag_id IN (${filters.tagIds.map(() => '?').join(',')})`;
      params.push(...filters.tagIds);
    }

    const conditions: string[] = [];
    if (filters?.configId) {
      conditions.push('s.config_id = ?');
      params.push(filters.configId);
    }
    if (filters?.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY s.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const [rows] = await pool.execute(query, params);
    return (rows as Record<string, unknown>[]).map(r => this.deserializeScript(r.content as string | Record<string, unknown>));
  }

    /**
     * Optimize an existing script with feedback, creating a new version.
     * Requirements: 6.5, 8.3
     */
    async optimizeWithFeedback(scriptId: string, feedback: AggregatedFeedback): Promise<Script> {
      const original = await this.getScript(scriptId);
      if (!original) throw new Error(`Script not found: ${scriptId}`);

      // Increment version: v1.0 → v1.1, v1.1 → v1.2, etc.
      const newVersion = this.incrementVersion(original.version);

      // Build optimization prompt
      const skills = await this.skillService.getForGeneration(original.config.gameType, ALL_CATEGORIES);
      const systemPrompt = this.buildSystemPrompt(original.config);
      const userPrompt = this.buildOptimizationPrompt(original, feedback, skills);

      const response = await this.llmAdapter.send({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });

      const parsed = this.parseGeneratedContent(response.content);
      this.validateGenerated(parsed, original.config);

      // Parse and validate playable structure (if present)
      let playableStructure: PlayableStructure | undefined;
      const rawParsed = parsed as Record<string, unknown>;
      if (rawParsed.playableStructure) {
        try {
          playableStructure = this.parsePlayableContent(rawParsed.playableStructure);
          this.validatePlayableStructure(playableStructure, original.config, parsed.materials);
        } catch (e) {
          console.warn(`[optimizeWithFeedback] PlayableStructure parsing/validation warning: ${(e as Error).message}`);
        }
      }

      const newScript: Script = {
        id: uuidv4(),
        version: newVersion,
        configId: original.configId,
        config: original.config,
        title: parsed.title || original.title,
        dmHandbook: parsed.dmHandbook,
        playerHandbooks: parsed.playerHandbooks,
        materials: parsed.materials,
        branchStructure: parsed.branchStructure,
        playableStructure,
        tags: original.tags,
        parentVersionId: original.id,
        status: ScriptStatus.READY,
        aiProvider: this.llmAdapter.getProviderName(),
        aiModel: this.llmAdapter.getDefaultModel(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.storeScript(newScript);
      return newScript;
    }

    /** Get all versions of a script (by config_id, ordered by version) */
    async getScriptVersions(scriptId: string): Promise<Script[]> {
      const original = await this.getScript(scriptId);
      if (!original) return [];

      const [rows] = await pool.execute(
        'SELECT * FROM scripts WHERE config_id = ? ORDER BY created_at ASC',
        [original.configId],
      );
      return (rows as Record<string, unknown>[]).map(r => this.deserializeScript(r.content as string | Record<string, unknown>));
    }

    /**
     * Check if auto-optimization should be triggered.
     * Returns true when totalReviews >= threshold AND any dimension averageScore < 6.
     * Requirement 8.4
     */
    checkAutoOptimizeTrigger(feedback: AggregatedFeedback, threshold = 5): boolean {
      if (feedback.totalReviews < threshold) return false;
      return feedback.dimensions.some(d => d.averageScore < 6);
    }

    /** Increment version string: v1.0 → v1.1, v1.9 → v1.10 */
    incrementVersion(version: string): string {
      const match = version.match(/^v(\d+)\.(\d+)$/);
      if (!match) return 'v1.1';
      return `v${match[1]}.${parseInt(match[2], 10) + 1}`;
    }

    /** Build optimization-specific user prompt */
    buildOptimizationPrompt(original: Script, feedback: AggregatedFeedback, skills: SkillTemplate[]): string {
      const lowScoreDimensions = feedback.dimensions
        .filter(d => d.averageScore < 6)
        .map(d => `${d.dimension}(平均${d.averageScore.toFixed(1)}分)`);

      const basePrompt = this.buildUserPrompt(original.config, skills);

      return `${basePrompt}

  【优化任务】这是对已有剧本"${original.title}"(${original.version})的优化。
  ${lowScoreDimensions.length > 0 ? `需要重点优化的维度：${lowScoreDimensions.join('、')}` : ''}
  ${feedback.frequentSuggestions.length > 0 ? `玩家高频建议：${feedback.frequentSuggestions.join('；')}` : ''}
  评价总数：${feedback.totalReviews}

  请在保持原有优点的基础上，针对以上反馈进行优化。`;
    }

    // ─── 两阶段生成入口 ───

    /**
     * Start character-first two-phase generation.
     * Creates a GenerateJob with generationMode: 'character_first', status: 'pending',
     * currentPhase: 'character', stores in Redis, then fires runCharacterGenerate in background.
     * Requirements: 2.1, 5.1, 5.2
     */
    async startCharacterFirstGenerate(config: ScriptConfig): Promise<GenerateJob> {
      const jobId = uuidv4();
      const now = new Date().toISOString();
      const job: GenerateJob = {
        jobId,
        configId: config.id,
        status: 'pending',
        generationMode: 'character_first',
        currentPhase: 'character',
        createdAt: now,
        updatedAt: now,
      };
      await redis.set(JOB_PREFIX + jobId, JSON.stringify(job), 'EX', JOB_TTL);

      // Fire and forget — run phase 1 in background
      this.runCharacterGenerate(jobId, config).catch(() => {});

      return job;
    }

    /**
     * Phase 1 background runner: pending → generating_characters → characters_ready.
     * Calls generateCharacters to get CharacterProfile[], then storeCharacterDraft.
     * On error: sets status to 'failed' with errorPhase 'character'.
     * Requirements: 5.1, 5.2
     */
    private async runCharacterGenerate(jobId: string, config: ScriptConfig): Promise<void> {
      try {
        await this.updateJob(jobId, { status: 'generating_characters', currentPhase: 'character' });
        console.log(`[Job ${jobId}] Starting character generation (phase 1) for config ${config.id}`);

        const characters = await this.generateCharacters(config);

        await this.storeCharacterDraft(jobId, config.id, characters);

        await this.updateJob(jobId, { status: 'characters_ready' });
        console.log(`[Job ${jobId}] Character generation complete. ${characters.length} characters generated.`);
      } catch (err) {
        let errorMsg = err instanceof Error ? err.message : String(err);
        if (err instanceof LLMError) {
          errorMsg += ` [LLM Error: provider=${err.provider}, statusCode=${err.statusCode ?? 'N/A'}, retryAttempts=${err.retryAttempts}]`;
        }
        console.error(`[Job ${jobId}] Character generation failed:`, errorMsg);
        await this.updateJob(jobId, { status: 'failed', error: errorMsg, errorPhase: 'character' });
      }
    }

    /**
     * Generate character profiles from config using LLM.
     * Gets CHARACTER_DESIGN and MOTIVE Skill templates, builds prompts,
     * calls LLM, parses and validates character profiles (including gender,
     * bloodType, mbtiType validation).
     * Requirements: 2.1, 2.2, 2.3
     */
    async generateCharacters(config: ScriptConfig): Promise<FullCharacterProfile[]> {
      // 1. Get CHARACTER_DESIGN and MOTIVE skill templates
      const skills = await this.skillService.getForGeneration(
        config.gameType,
        [SkillCategory.CHARACTER_DESIGN, SkillCategory.MOTIVE],
      );

      // 2. Build prompts
      const systemPrompt = this.buildCharacterSystemPrompt(config);
      const userPrompt = this.buildCharacterUserPrompt(config, skills);

      // 3. Call LLM
      const response = await this.llmAdapter.send({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
        maxTokens: 15000,
      });

      // 4. Parse character profiles from LLM response
      const profiles = this.parseCharacterProfiles(response.content);

      // 5. Validate against config constraints
      this.validateCharacterProfiles(profiles, config);

      return profiles;
    }

    // ─── CharacterDraft Redis 存储方法 ───

    /**
     * Store a CharacterDraft to Redis.
     * Requirements: 3.1
     */
    async storeCharacterDraft(
      jobId: string,
      configId: string,
      characters: FullCharacterProfile[],
    ): Promise<CharacterDraft> {
      const now = new Date().toISOString();
      const draft: CharacterDraft = {
        jobId,
        configId,
        characters,
        status: 'pending_review',
        createdAt: now,
        updatedAt: now,
      };
      await redis.set(
        CHARACTER_DRAFT_PREFIX + jobId,
        JSON.stringify(draft),
        'EX',
        CHARACTER_DRAFT_TTL,
      );
      return draft;
    }

    /**
     * Get a CharacterDraft from Redis.
     * Requirements: 3.2
     */
    async getCharacterDraft(jobId: string): Promise<CharacterDraft | null> {
      const raw = await redis.get(CHARACTER_DRAFT_PREFIX + jobId);
      if (!raw) return null;
      return JSON.parse(raw) as CharacterDraft;
    }

    /**
     * Update a single character profile within a CharacterDraft and re-validate
     * relationship consistency.
     * Requirements: 3.3
     */
    async updateCharacterProfile(
      jobId: string,
      characterId: string,
      updates: Partial<FullCharacterProfile>,
    ): Promise<{ draft: CharacterDraft; validationErrors: ValidationError[] }> {
      const draft = await this.getCharacterDraft(jobId);
      if (!draft) {
        throw new Error(`CharacterDraft not found for job: ${jobId}`);
      }

      const index = draft.characters.findIndex(c => c.characterId === characterId);
      if (index === -1) {
        throw new Error(`Character not found: ${characterId}`);
      }

      // Apply updates (exclude characterId from being overwritten)
      const { characterId: _ignored, ...safeUpdates } = updates;
      draft.characters[index] = { ...draft.characters[index], ...safeUpdates };
      draft.updatedAt = new Date().toISOString();

      // Re-validate relationship consistency
      const validationErrors = this.validateRelationshipConsistency(draft.characters);

      // Save updated draft (save even if there are validation errors)
      await redis.set(
        CHARACTER_DRAFT_PREFIX + jobId,
        JSON.stringify(draft),
        'EX',
        CHARACTER_DRAFT_TTL,
      );

      return { draft, validationErrors };
    }

    /**
     * Validate that all relationship targetCharacterIds reference existing characters
     * in the set, and do not reference the character itself.
     * Requirements: 3.3, 3.6
     */
    validateRelationshipConsistency(characters: FullCharacterProfile[]): ValidationError[] {
      const errors: ValidationError[] = [];
      const characterIds = new Set(characters.map(c => c.characterId));

      for (const character of characters) {
        for (const rel of character.relationships) {
          if (!characterIds.has(rel.targetCharacterId)) {
            errors.push({
              field: `${character.characterId}.relationships`,
              message: `Relationship target "${rel.targetCharacterName}" (${rel.targetCharacterId}) does not exist in the character set`,
              constraint: 'relationship_target_exists',
            });
          }
          if (rel.targetCharacterId === character.characterId) {
            errors.push({
              field: `${character.characterId}.relationships`,
              message: `Character "${character.characterName}" has a relationship referencing itself`,
              constraint: 'relationship_no_self_reference',
            });
          }
        }
      }

      return errors;
    }

    /**
     * Valid MBTI types (all 16 combinations).
     */
    private static readonly VALID_MBTI_TYPES = new Set([
      'INTJ', 'INTP', 'ENTJ', 'ENTP',
      'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
      'ISTP', 'ISFP', 'ESTP', 'ESFP',
    ]);

    /**
     * Valid blood types.
     */
    private static readonly VALID_BLOOD_TYPES = new Set(['A', 'B', 'O', 'AB']);

    /**
     * Opposing relationship types (rival/enemy).
     */
    private static readonly OPPOSING_RELATIONSHIP_TYPES = new Set(['rival', 'enemy']);

    /**
     * Cooperative relationship types (ally/colleague/family).
     */
    private static readonly COOPERATIVE_RELATIONSHIP_TYPES = new Set(['ally', 'colleague', 'family']);

    /**
     * Validate character profiles against config constraints.
     * Checks: player count, bloodType, mbtiType, gender, secrets, relationship diversity.
     * Throws an error with a list of validation errors if any checks fail.
     * Requirements: 1.4, 2.4, 2.5, 2.6, 3.6
     */
    validateCharacterProfiles(profiles: FullCharacterProfile[], config: ScriptConfig): void {
      const errors: ValidationError[] = [];

      // 1. Player count must equal config.playerCount (NPC doesn't count)
      const playerCount = profiles.filter(p => p.characterType === 'player').length;
      if (playerCount !== config.playerCount) {
        errors.push({
          field: 'profiles',
          message: `Expected ${config.playerCount} player characters, got ${playerCount}`,
          constraint: 'player_count_match',
        });
      }

      // Per-character validations
      for (const profile of profiles) {
        // 2. bloodType must be A/B/O/AB
        if (!GeneratorService.VALID_BLOOD_TYPES.has(profile.bloodType)) {
          errors.push({
            field: `${profile.characterId}.bloodType`,
            message: `Invalid bloodType "${profile.bloodType}" for character "${profile.characterName}". Must be A, B, O, or AB`,
            constraint: 'valid_blood_type',
          });
        }

        // 3. mbtiType must be one of 16 valid types
        if (!GeneratorService.VALID_MBTI_TYPES.has(profile.mbtiType)) {
          errors.push({
            field: `${profile.characterId}.mbtiType`,
            message: `Invalid mbtiType "${profile.mbtiType}" for character "${profile.characterName}". Must be one of the 16 valid MBTI types`,
            constraint: 'valid_mbti_type',
          });
        }

        // 4. gender must be non-empty
        if (!profile.gender || profile.gender.trim().length === 0) {
          errors.push({
            field: `${profile.characterId}.gender`,
            message: `Gender must be non-empty for character "${profile.characterName}"`,
            constraint: 'gender_non_empty',
          });
        }

        // 5. secrets must have at least one entry
        if (!profile.secrets || profile.secrets.length < 1) {
          errors.push({
            field: `${profile.characterId}.secrets`,
            message: `Character "${profile.characterName}" must have at least one secret`,
            constraint: 'secrets_min_one',
          });
        }
      }

      // 6. Relationship diversity: at least one opposing and one cooperative
      const allRelationships = profiles.flatMap(p => p.relationships);
      const hasOpposing = allRelationships.some(r =>
        GeneratorService.OPPOSING_RELATIONSHIP_TYPES.has(r.relationshipType),
      );
      const hasCooperative = allRelationships.some(r =>
        GeneratorService.COOPERATIVE_RELATIONSHIP_TYPES.has(r.relationshipType),
      );

      if (!hasOpposing) {
        errors.push({
          field: 'relationships',
          message: 'Character set must contain at least one opposing relationship (rival/enemy)',
          constraint: 'relationship_diversity_opposing',
        });
      }
      if (!hasCooperative) {
        errors.push({
          field: 'relationships',
          message: 'Character set must contain at least one cooperative relationship (ally/colleague/family)',
          constraint: 'relationship_diversity_cooperative',
        });
      }

      // 7. Relationship consistency (delegate to existing method)
      const relationshipErrors = this.validateRelationshipConsistency(profiles);
      errors.push(...relationshipErrors);

      if (errors.length > 0) {
        throw new Error(
          `Character profile validation failed: ${errors.map(e => e.message).join('; ')}`,
        );
      }
    }



    /**
     * Confirm a CharacterDraft — update status to confirmed.
     * Checks relationship consistency first; throws if inconsistent.
     * Requirements: 3.4
     */
    async confirmCharacters(jobId: string): Promise<void> {
          const draft = await this.getCharacterDraft(jobId);
          if (!draft) {
            throw new Error(`CharacterDraft not found for job: ${jobId}`);
          }

          // Check relationship consistency before confirming
          const errors = this.validateRelationshipConsistency(draft.characters);
          if (errors.length > 0) {
            throw new Error(
              `Cannot confirm characters: relationship consistency errors — ${errors.map(e => e.message).join('; ')}`,
            );
          }

          // Replace LLM-generated IDs (e.g. "p001") with real UUIDs to avoid collisions
          const idMap = new Map<string, string>();
          for (const c of draft.characters) {
            const newId = uuidv4();
            idMap.set(c.characterId, newId);
            c.characterId = newId;
          }
          // Update relationship references to use new IDs
          for (const c of draft.characters) {
            if (c.relationships) {
              for (const r of c.relationships) {
                const mapped = idMap.get(r.targetCharacterId);
                if (mapped) r.targetCharacterId = mapped;
              }
            }
          }

          draft.status = 'confirmed';
          draft.updatedAt = new Date().toISOString();

          await redis.set(
            CHARACTER_DRAFT_PREFIX + jobId,
            JSON.stringify(draft),
            'EX',
            CHARACTER_DRAFT_TTL,
          );

          // Persist each CharacterProfile to the characters table
          await this.persistCharacters(draft.characters);
        }

    /**
     * Persist CharacterProfile[] to the `characters` MySQL table.
     * Uses INSERT IGNORE to skip if a character with the same id already exists.
     * Maps CharacterProfile fields to table columns:
     *   characterId→id, characterName→name,
     *   gender→gender, bloodType→blood_type, mbtiType→mbti_type,
     *   personality→personality, appearance→appearance
     * Requirements: 8.3
     */
    private async persistCharacters(characters: FullCharacterProfile[]): Promise<void> {
      for (const c of characters) {
        await pool.execute(
          `INSERT IGNORE INTO characters (id, name, gender, zodiac_sign, blood_type, mbti_type, personality, appearance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.characterId,
            c.characterName,
            c.gender,
            c.zodiacSign || null,
            c.bloodType,
            c.mbtiType,
            c.personality,
            c.appearance,
          ],
        );
      }
    }

    /**
     * Create `script_character_sets` association records for each character in the draft.
     * Uses uuidv4() for generating IDs.
     * Requirements: 8.3
     */
    private async persistScriptCharacterSets(
      scriptId: string,
      characters: FullCharacterProfile[],
      experienceSummary?: string,
    ): Promise<void> {
      for (const c of characters) {
        const abilities = c.abilities ? c.abilities.join(', ') : null;
        const secrets = JSON.stringify(c.secrets || []);
        const relationships = JSON.stringify(c.relationships || []);
        await pool.execute(
          `INSERT INTO script_character_sets (id, character_id, script_id, character_type, abilities, background_story, primary_motivation, motivation, experience_summary, narrative_role, secrets, relationships)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            c.characterId,
            scriptId,
            c.characterType,
            abilities,
            c.backgroundStory || null,
            c.primaryMotivation || null,
            c.primaryMotivation,
            experienceSummary || null,
            c.narrativeRole || null,
            secrets,
            relationships,
          ],
        );
      }
    }

    /**
     * Auto-generate an experienceSummary from the script content.
     * Extracts a brief summary from the first player handbook's backgroundStory
     * or falls back to the script title.
     * Requirements: 8.7
     */
    private buildExperienceSummary(script: Script): string {
      // Try to extract from the first player handbook's backgroundStory
      if (script.playerHandbooks && script.playerHandbooks.length > 0) {
        const firstHandbook = script.playerHandbooks[0];
        if (firstHandbook.backgroundStory) {
          // Take the first 200 characters as a summary
          const summary = firstHandbook.backgroundStory.substring(0, 200);
          return summary.length < firstHandbook.backgroundStory.length
            ? summary + '...'
            : summary;
        }
      }
      // Fallback to script title
      return script.title || '参与了一段剧本杀经历';
    }

    /**
     * Build the system prompt for character generation (phase 1).
     * Includes: character designer role definition, output format requirements,
     * appearance description requirements, gender/bloodType/mbtiType generation
     * requirements, personality-MBTI-bloodType consistency instructions.
     * Requirements: 2.2, 2.3, 2.6, 2.7, 2.8
     */
    buildCharacterSystemPrompt(config: ScriptConfig): string {
          const langInstruction = config.language === 'zh'
            ? '请用中文生成所有内容。'
            : `Please generate all content in language: ${config.language}.`;

          let specialSettingInstruction = '';
          if (config.gameType === GameType.SHIN_HONKAKU && config.specialSetting) {
            specialSettingInstruction = `
    12. 角色设定必须与特殊世界观设定兼容
    特殊设定：${config.specialSetting.settingDescription}
    设定限制：${config.specialSetting.settingConstraints}`;
          }

          return `你是一位专业的剧本杀角色设计师。${langInstruction}
    根据以下配置参数，设计一组角色设定。

    【重要】角色分为两部分：
    A. 通用角色属性（存入角色库，可跨剧本复用）：性格、外貌等描述必须是角色本身的固有特质，不要涉及任何具体剧情、案件、事件。
    B. 剧本关联属性（仅用于本剧本）：能力/特质、背景故事、动机、秘密、关系、叙事定位等与具体剧情相关的内容。

    要求：
    1. 每个角色必须有独特的性格特征
    2. 角色之间必须存在至少一组对立关系和至少一组合作关系
    3. 每个角色至少有一个秘密（放在剧本关联属性中）
    4. 角色动机必须与故事主题相关（放在剧本关联属性中）
    5. 角色关系网络必须形成有意义的戏剧冲突
    6. 必须生成恰好 ${config.playerCount + 1} 个角色（${config.playerCount} 个玩家角色 + 至少1个NPC），通过 characterType 区分
    7. 每个角色必须包含以下基础属性：
       - 性别（gender）
       - 星座（zodiacSign）：12星座之一（aries/taurus/gemini/cancer/leo/virgo/libra/scorpio/sagittarius/capricorn/aquarius/pisces）
       - 血型（bloodType）：取值为 A、B、O 或 AB
       - MBTI类型（mbtiType）：16种MBTI类型之一（如 INTJ、ENFP、ISTP 等）
    8. 角色的性格特征（personality）必须与其MBTI类型和血型保持合理一致性
    9. personality 和 appearance 必须是通用描述，不要提及具体剧情、案件、身份（如"侦探"、"凶手"、"卧底"等剧情角色）
    10. 每个角色必须包含详细的外貌描述（appearance），包括体貌特征和穿着风格，足够详细以便AI图片生成
    11. abilities 是角色在此剧本中的能力/特质（如"精通射击"、"过目不忘"），属于剧本关联属性
    ${specialSettingInstruction}

    输出格式：JSON数组，不要输出任何JSON以外的内容。

    每个元素结构：
    {
      "characterId": "唯一标识",
      "characterName": "角色名称",
      "gender": "性别",
      "zodiacSign": "星座（英文小写）",
      "bloodType": "A/B/O/AB",
      "mbtiType": "MBTI类型（如 INTJ）",
      "personality": "通用性格描述（不涉及剧情）",
      "appearance": "通用外貌描述（不涉及剧情身份）",
      "characterType": "player 或 npc（剧本关联）",
      "abilities": ["本剧本中的能力或特质"],
      "backgroundStory": "本剧本中的背景故事",
      "primaryMotivation": "本剧本中的核心动机",
      "secrets": ["本剧本中的秘密"],
      "relationships": [{ "targetCharacterId": "", "targetCharacterName": "", "relationshipType": "ally/rival/lover/family/colleague/stranger/enemy/mentor/suspect", "description": "" }],
      "secondaryMotivations": ["次要动机"],
      "narrativeRole": "murderer/detective/witness/suspect/victim/accomplice/bystander"
    }`;
        }


    /**
     * Build the user prompt for character generation (phase 1).
     * Injects: playerCount, gameType, ageGroup, era, location, theme,
     * and CHARACTER_DESIGN/MOTIVE category Skill templates.
     * When gameType is shin_honkaku with specialSetting, injects special setting info.
     * Requirements: 2.2, 2.3, 2.6, 2.7, 2.8
     */
    buildCharacterUserPrompt(config: ScriptConfig, skills: SkillTemplate[]): string {
          const configSection = `【配置参数】
    - 玩家人数：${config.playerCount}
    - 游戏类型：${config.gameType}
    - 目标年龄段：${config.ageGroup}
    - 时代背景：${config.era}
    - 地点设定：${config.location}
    - 主题风格：${config.theme}`;

          const skillSection = skills.length > 0
            ? `\n【Skill模板参考】\n${skills.map(s => `[${s.name}] ${s.content}`).join('\n')}`
            : '';

          let specialSettingSection = '';
          if (config.gameType === GameType.SHIN_HONKAKU && config.specialSetting) {
            specialSettingSection = `\n【特殊设定】
    - 设定描述：${config.specialSetting.settingDescription}
    - 设定限制：${config.specialSetting.settingConstraints}
    请确保所有角色设定与以上特殊世界观设定兼容。`;
          }

          return `${configSection}${skillSection}${specialSettingSection}

    请根据以上配置生成角色设定，确保：
    1. 恰好 ${config.playerCount} 个 characterType 为 "player" 的玩家角色 + 至少1个 "npc"
    2. 每个角色包含 gender、zodiacSign（12星座英文小写）、bloodType（A/B/O/AB）、mbtiType（16种MBTI类型之一）
    3. 角色性格（personality）与MBTI类型和血型保持合理一致性
    4. personality、appearance 是通用描述，不涉及具体剧情或案件身份
    5. abilities、backgroundStory、primaryMotivation、secrets、relationships、narrativeRole 是本剧本的关联属性
    6. 每个角色包含详细的外貌描述（appearance），包括体貌特征和穿着风格
    7. 角色之间至少存在一组对立关系和一组合作关系
    8. 每个角色至少有一个秘密`;
        }

    /**
     * Parse CharacterProfile[] JSON from LLM response content.
     * Reuses the same JSON extraction strategy as parseGeneratedContent:
     * 1. Extract from markdown code fences (```json ... ```)
     * 2. Find the outermost [ ... ] or { ... } block
     * Requirements: 2.1
     */
    parseCharacterProfiles(content: string): FullCharacterProfile[] {
      let jsonStr = content.trim();

      // Strategy 1: Extract from markdown code fences (reuses parseGeneratedContent pattern)
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Strategy 2: Find the outermost array [ ... ] or object { ... } block
      if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonStr = jsonStr.slice(firstBracket, lastBracket + 1);
        } else if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.error('[parseCharacterProfiles] Failed to parse JSON. First 500 chars:', jsonStr.slice(0, 500));
        throw new Error('Failed to parse character profiles from LLM response as JSON');
      }

      // Extract the array from the parsed result
      let profiles: unknown[];

      if (Array.isArray(parsed)) {
        profiles = parsed;
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Check for a nested array property (e.g. { characters: [...] })
        const obj = parsed as Record<string, unknown>;
        const nestedArray = Object.values(obj).find((v) => Array.isArray(v)) as unknown[] | undefined;
        if (nestedArray) {
          profiles = nestedArray;
        } else {
          throw new Error('LLM response does not contain a valid CharacterProfile array');
        }
      } else {
        throw new Error('LLM response does not contain a valid CharacterProfile array');
      }

      if (profiles.length === 0) {
        throw new Error('LLM response contains an empty CharacterProfile array');
      }

      // Validate that each profile has the critical fields: gender, bloodType, mbtiType
      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i] as Record<string, unknown>;
        if (!p || typeof p !== 'object') {
          throw new Error(`CharacterProfile at index ${i} is not a valid object`);
        }
        if (typeof p.gender !== 'string' || p.gender.trim() === '') {
          throw new Error(`CharacterProfile at index ${i} is missing or has empty "gender" field`);
        }
        if (typeof p.bloodType !== 'string' || !GeneratorService.VALID_BLOOD_TYPES.has(p.bloodType)) {
          throw new Error(
            `CharacterProfile at index ${i} has invalid "bloodType": "${p.bloodType}". Must be one of A, B, O, AB`,
          );
        }
        if (typeof p.mbtiType !== 'string' || !GeneratorService.VALID_MBTI_TYPES.has(p.mbtiType)) {
          throw new Error(
            `CharacterProfile at index ${i} has invalid "mbtiType": "${p.mbtiType}". Must be a valid MBTI type`,
          );
        }
      }

      return profiles as FullCharacterProfile[];
    }

    // ─── 第二阶段：故事生成提示词 ───

    /**
     * Build the system prompt for story generation (phase 2).
     * Injects complete character profiles JSON (with gender, bloodType, mbtiType),
     * requires no undefined characters, only generates player handbooks for player characters,
     * and character behavior must be consistent with MBTI type.
     * Requirements: 4.1, 4.2, 4.3
     */
    buildStorySystemPrompt(config: ScriptConfig, characters: FullCharacterProfile[]): string {
      const langInstruction = config.language === 'zh'
        ? '请用中文生成所有内容。'
        : `Please generate all content in language: ${config.language}.`;

      let specialSettingInstruction = '';
      if (config.gameType === GameType.SHIN_HONKAKU && config.specialSetting) {
        specialSettingInstruction = `
【新本格特殊设定要求】
- 设定描述：${config.specialSetting.settingDescription}
- 设定限制：${config.specialSetting.settingConstraints}
- 所有特殊设定规则必须在DM手册overview和每个玩家手册开篇完整公开
- 诡计必须基于设定规则的边界或盲区设计，不得违反已公开的设定规则
- 推理链条在设定规则体系内必须严格自洽`;
      }

      return `你是一位专业的剧本杀故事设计师。${langInstruction}
基于以下已确认的角色设定，生成完整的故事内容。

角色设定：
${JSON.stringify(characters, null, 2)}

要求：
1. 故事必须基于已有角色设定展开，不得引入未定义的角色
2. 每个角色的背景故事、关系和动机必须与角色设定一致
3. 时间线中涉及的角色必须在角色集合中（包含 player 和 npc 角色）
4. 仅为 characterType 为 "player" 的角色生成玩家手册，NPC角色不生成玩家手册
5. 玩家手册中的角色信息必须与 CharacterProfile 一致（包括性别、MBTI类型等）
6. DM手册中应包含所有角色（player 和 npc）的信息
7. 故事中角色的行为模式应与其MBTI类型和性格特征保持一致
${specialSettingInstruction}

【沉浸式叙事写作规范】
1. 视角限制：所有沉浸式叙事必须以第二人称（"你"）作为叙事主语，全程使用"你"描述角色的所见所闻、行为和感受
2. 信息边界：每个角色的叙事仅包含该角色在该幕中合理可感知的信息，不泄露其他角色的秘密或未获得的线索
3. 语气匹配：根据角色的 personality 和 mbtiType 调整叙事风格：
   - 内向型角色（I开头的MBTI）：增加内心独白和观察描写比重
   - 外向型角色（E开头的MBTI）：增加互动、对话回忆和社交场景描写
4. 误导信息处理：角色持有的误导性信念以角色确信口吻呈现，不标注为误导信息
5. 凶手视角：narrativeRole 为 murderer 的角色，叙事中合理隐藏犯罪行为，提供看似合理的替代解释
6. 嫌疑人视角：narrativeRole 为 suspect 的角色，叙事中呈现可能显得可疑的情境，同时保留无辜视角
7. 字数要求：personalNarrative 字段只需写1-2句话的角色视角摘要（沉浸式叙事将在后续步骤单独生成）
8. 序幕叙事：immersiveNarrative 留空（将在后续步骤单独生成）
9. 终幕叙事：immersiveNarrative 留空（将在后续步骤单独生成）
10. 同一角色在序幕、各幕和终幕中的叙事语气保持一致的 NarrativeVoice，不出现风格突变

请严格按照以下JSON格式输出完整剧本内容。不要输出任何JSON以外的内容。
【重要】immersiveNarrative 字段请留空字符串，personalNarrative 字段只需1-2句话摘要。沉浸式叙事将在后续步骤单独生成。

输出格式：
{
  "title": "剧本标题",
  "dmHandbook": { "overview": "", "characters": [], "timeline": [], "clueDistribution": [], "roundGuides": [], "branchDecisionPoints": [], "endings": [], "truthReveal": "", "judgingRules": { "winConditions": "", "scoringCriteria": "" } },
  "playerHandbooks": [ { "characterId": "", "characterName": "", "backgroundStory": "", "primaryGoal": "", "secondaryGoals": [], "relationships": [], "knownClues": [], "roundActions": [], "secrets": [] } ],
  "materials": [ { "id": "", "type": "clue_card|prop_card|vote_card|scene_card", "content": "", "clueId": "", "associatedCharacterId": "", "metadata": {} } ],
  "branchStructure": { "nodes": [], "edges": [], "endings": [] },
  "playableStructure": {
    "prologue": {
      "backgroundNarrative": "故事背景叙述",
      "worldSetting": "世界观描述",
      "characterIntros": [{ "characterId": "", "characterName": "", "publicDescription": "" }]
    },
    "acts": [{
      "actIndex": 1,
      "title": "幕标题",
      "narrative": "全局故事叙述（DM朗读）",
      "objectives": ["搜证目标"],
      "clueIds": ["本幕分发的线索ID"],
      "discussion": { "topics": ["讨论话题"], "guidingQuestions": ["引导问题"], "suggestedMinutes": 10 },
      "vote": { "question": "投票问题", "options": [{ "id": "", "text": "", "impact": "" }] }
    }],
    "finale": {
      "finalVote": { "question": "", "options": [{ "id": "", "text": "", "impact": "" }] },
      "truthReveal": "真相揭示文本",
      "endings": [{ "endingId": "", "name": "", "triggerCondition": "", "narrative": "", "playerEndingSummaries": [{ "characterId": "", "ending": "" }] }]
    },
    "dmHandbook": {
      "prologueGuide": { "openingScript": "", "characterAssignmentNotes": "", "rulesIntroduction": "" },
      "actGuides": [{ "actIndex": 1, "readAloudText": "", "keyEventHints": [], "clueDistributionInstructions": [{ "clueId": "", "targetCharacterId": "", "condition": "" }], "discussionGuidance": "", "voteHostingNotes": "", "dmPrivateNotes": "" }],
      "finaleGuide": { "finalVoteHostingFlow": "", "truthRevealScript": "", "endingJudgmentNotes": "" }
    },
    "playerHandbooks": [{
      "characterId": "",
      "characterName": "",
      "prologueContent": { "characterId": "", "backgroundStory": "", "relationships": [], "initialKnowledge": [], "immersiveNarrative": "" },
      "actContents": [{ "actIndex": 1, "characterId": "", "personalNarrative": "简短角色视角摘要", "objectives": [], "clueHints": [], "discussionSuggestions": [], "secretInfo": "" }],
      "finaleContent": { "characterId": "", "closingStatementGuide": "", "votingSuggestion": "", "immersiveNarrative": "" }
    }]
  }
}`;
    }

    /**
     * Build the user prompt for story generation (phase 2).
     * Injects character profiles, config parameters, all Skill templates,
     * and optional feedback data.
     * Requirements: 4.1, 4.2, 4.3
     */
    buildStoryUserPrompt(
      config: ScriptConfig,
      characters: FullCharacterProfile[],
      skills: SkillTemplate[],
      feedback?: AggregatedFeedback,
    ): string {
      const playerCharacters = characters.filter(c => c.characterType === 'player');
      const npcCharacters = characters.filter(c => c.characterType === 'npc');

      const characterSection = `【角色设定】
共 ${characters.length} 个角色（${playerCharacters.length} 个玩家角色，${npcCharacters.length} 个NPC角色）
${characters.map(c => `- ${c.characterName}（${c.characterType}）：${c.gender}，${c.bloodType}型血，${c.mbtiType}，${c.personality}
  外貌：${c.appearance}
  背景：${c.backgroundStory}
  动机：${c.primaryMotivation}`).join('\n')}`;

      const configSection = `\n【配置参数】
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

      const skillSection = skills.length > 0
        ? `\n【Skill模板参考】\n${skills.map(s => `[${s.name}] ${s.content}`).join('\n')}`
        : '';

      let feedbackSection = '';
      if (feedback) {
        const lowScoreDimensions = feedback.dimensions
          .filter(d => d.averageScore < 6)
          .map(d => `${d.dimension}(平均${d.averageScore.toFixed(1)}分)`);

        if (lowScoreDimensions.length > 0) {
          feedbackSection = `\n【优化重点】以下维度评分较低，请重点优化：${lowScoreDimensions.join('、')}`;
        }
        if (feedback.frequentSuggestions.length > 0) {
          feedbackSection += `\n【高频建议】${feedback.frequentSuggestions.join('；')}`;
        }
      }

      const narrativeContextInstruction = `

【跨角色叙事一致性要求】
请在生成每幕叙事前，先确定该幕的事件事实摘要（时间、地点、参与者、可观察行为），
然后基于该摘要为每个角色生成各自视角的叙事。不同角色对同一事件的客观要素描述必须一致，
仅在主观感受、动机推测和信息掌握程度上体现差异。

【沉浸式叙事字段说明】
- prologueContent.immersiveNarrative：序幕第二人称沉浸式叙事
- actContents[].personalNarrative：每幕第二人称沉浸式叙事（不少于300字）
- finaleContent.immersiveNarrative：终幕第二人称沉浸式叙事`;

      return `${characterSection}${configSection}${skillSection}${feedbackSection}

请基于以上角色设定和配置生成完整的剧本杀故事内容，确保：
1. 玩家手册数量 = ${playerCharacters.length}（仅为 player 角色生成）
2. 每张线索卡的clueId在DM手册线索分发表中都有对应条目
3. 分支结构从起始节点出发，任意路径都能到达至少一个结局
4. 每个玩家手册只包含该角色应知的信息
5. playableStructure中的中间幕（acts）数量 = ${config.roundStructure.totalRounds}
6. 每幕包含完整的游玩序列：故事叙述→搜证目标→交流建议→投票/决策
7. 幕与幕之间的故事叙述保持连贯性和递进性，情节层层推进
8. 每幕的线索分发指令（clueDistributionInstructions）中的clueId与该幕的clueIds一致
9. playableStructure.playerHandbooks中每个角色的actContents数量 = ${config.roundStructure.totalRounds}
10. 序幕（prologue）包含完整的背景叙述和角色介绍，终幕（finale）包含最终投票和真相揭示
11. 不得引入角色设定中未定义的角色
12. 角色行为模式与其MBTI类型和性格特征保持一致
${narrativeContextInstruction}`;
    }

    /**
     * Validate story-character consistency after phase 2 generation.
     * - PlayerHandbook should only exist for player characters (not NPCs)
     * - Each PlayerHandbook's characterName must match the corresponding CharacterProfile
     * - Each PlayerHandbook's backgroundStory must be consistent with CharacterProfile
     * - All involvedCharacterIds in timeline events must reference valid characters
     * Minor inconsistencies log warnings; severe inconsistencies throw errors.
     * Requirements: 4.4, 4.5, 4.6
     */
    validateCharacterConsistency(script: Script, characters: FullCharacterProfile[]): void {
      const characterMap = new Map<string, FullCharacterProfile>();
      for (const c of characters) {
        characterMap.set(c.characterId, c);
      }

      const playerIds = new Set(
        characters.filter(c => c.characterType === 'player').map(c => c.characterId),
      );
      const allCharacterIds = new Set(characters.map(c => c.characterId));

      // --- Rule 1: PlayerHandbook should only exist for player characters ---
      for (const handbook of script.playerHandbooks) {
        if (!playerIds.has(handbook.characterId)) {
          if (!allCharacterIds.has(handbook.characterId)) {
            throw new Error(
              `[validateCharacterConsistency] PlayerHandbook references non-existent character: ${handbook.characterId} (${handbook.characterName})`,
            );
          }
          // NPC has a PlayerHandbook — severe inconsistency
          const profile = characterMap.get(handbook.characterId);
          throw new Error(
            `[validateCharacterConsistency] PlayerHandbook generated for non-player character: ${handbook.characterId} (${handbook.characterName}, type=${profile?.characterType})`,
          );
        }
      }

      // --- Rule 2 & 3: characterName and backgroundStory consistency ---
      for (const handbook of script.playerHandbooks) {
        const profile = characterMap.get(handbook.characterId);
        if (!profile) {
          // Already caught above, but guard defensively
          throw new Error(
            `[validateCharacterConsistency] PlayerHandbook references non-existent character: ${handbook.characterId}`,
          );
        }

        // Name must match exactly
        if (handbook.characterName !== profile.characterName) {
          console.warn(
            `[validateCharacterConsistency] Character name mismatch for ${handbook.characterId}: handbook="${handbook.characterName}", profile="${profile.characterName}"`,
          );
        }

        // backgroundStory consistency: warn if handbook story is empty or profile story is empty
        if (!handbook.backgroundStory || handbook.backgroundStory.trim() === '') {
          console.warn(
            `[validateCharacterConsistency] Empty backgroundStory in PlayerHandbook for character: ${handbook.characterId} (${handbook.characterName})`,
          );
        } else if (!profile.backgroundStory || profile.backgroundStory.trim() === '') {
          console.warn(
            `[validateCharacterConsistency] Empty backgroundStory in CharacterProfile for character: ${profile.characterId} (${profile.characterName})`,
          );
        }
      }

      // --- Rule 4: timeline involvedCharacterIds must reference valid characters ---
      if (script.dmHandbook?.timeline) {
        for (const event of script.dmHandbook.timeline) {
          if (event.involvedCharacterIds) {
            for (const charId of event.involvedCharacterIds) {
              if (!allCharacterIds.has(charId)) {
                throw new Error(
                  `[validateCharacterConsistency] Timeline event "${event.event}" references non-existent character: ${charId}`,
                );
              }
            }
          }
        }
      }
    }

    // ─── 第二阶段：触发和后台执行器 ───

    /**
     * Start phase 2 story generation.
     * Validates that CharacterDraft is confirmed, updates GenerateJob status
     * to generating_story, then fires runStoryGenerate in background.
     * Requirements: 4.1, 4.2, 4.3, 5.3
     */
    async startStoryGenerate(jobId: string): Promise<void> {
      // 1. Get the CharacterDraft for this job
      const draft = await this.getCharacterDraft(jobId);
      if (!draft) {
        throw new Error(`CharacterDraft not found for job: ${jobId}`);
      }

      // 2. Verify draft status is 'confirmed'
      if (draft.status !== 'confirmed') {
        throw new Error(
          `CharacterDraft must be confirmed before starting story generation. Current status: ${draft.status}`,
        );
      }

      // 3. Update GenerateJob status to generating_story, currentPhase to story
      await this.updateJob(jobId, { status: 'generating_story', currentPhase: 'story' });

      // 4. Fire and forget runStoryGenerate in background
      this.runStoryGenerate(jobId).catch(() => {});
    }

    /**
     * Phase 2 background runner: reads CharacterDraft and Config, gets all Skill
     * templates, calls LLM to generate story, validates consistency, stores Script,
     * updates status to completed.
     * On error: sets status to 'failed', errorPhase to 'story', keeps CharacterDraft confirmed.
     * Requirements: 4.1, 4.2, 4.3, 5.3
     */
    private async runStoryGenerate(jobId: string): Promise<void> {
          try {
            console.log(`[Job ${jobId}] Starting story generation (phase 2)`);

            // 1. Read CharacterDraft from Redis
            const draft = await this.getCharacterDraft(jobId);
            if (!draft) {
              throw new Error(`CharacterDraft not found for job: ${jobId}`);
            }

            // 2. Read Config from MySQL
            const config = await this.getConfig(draft.configId);
            if (!config) {
              throw new Error(`Config not found: ${draft.configId}`);
            }

            // 3. Generate story using characters from draft
            const script = await this.generateStory(config, draft.characters);

            // 4. Validate character consistency
            this.validateCharacterConsistency(script, draft.characters);

            // 5. Store the Script
            await this.storeScript(script);

            // 6. Create script_character_sets association records and auto-update experienceSummary
            const experienceSummary = this.buildExperienceSummary(script);
            await this.persistScriptCharacterSets(script.id, draft.characters, experienceSummary);

            // 7. Update GenerateJob status to completed, set scriptId
            await this.updateJob(jobId, { status: 'completed', scriptId: script.id });
            console.log(`[Job ${jobId}] Story generation complete. Script ID: ${script.id}`);
          } catch (err) {
            let errorMsg = err instanceof Error ? err.message : String(err);
            if (err instanceof LLMError) {
              errorMsg += ` [LLM Error: provider=${err.provider}, statusCode=${err.statusCode ?? 'N/A'}, retryAttempts=${err.retryAttempts}]`;
            }
            console.error(`[Job ${jobId}] Story generation failed:`, errorMsg);
            // Set status to failed, errorPhase to story; CharacterDraft stays confirmed
            await this.updateJob(jobId, { status: 'failed', error: errorMsg, errorPhase: 'story' });
          }
        }


    /**
     * Generate a complete story based on confirmed character profiles.
     * Gets all category Skill templates, builds story prompts, calls LLM,
     * parses and validates the response.
     * Requirements: 4.1, 4.2, 4.3
     */
    async generateStory(
          config: ScriptConfig,
          characters: FullCharacterProfile[],
          feedback?: AggregatedFeedback,
        ): Promise<Script> {
          // 1. Get all category Skill templates
          const skills = await this.skillService.getForGeneration(config.gameType, ALL_CATEGORIES);

          // 2. Build prompts
          const systemPrompt = this.buildStorySystemPrompt(config, characters);
          const userPrompt = this.buildStoryUserPrompt(config, characters, skills, feedback);

          // 3. Call LLM
          const response = await this.llmAdapter.send({
            systemPrompt,
            prompt: userPrompt,
            temperature: 0.7,
            maxTokens: 30000,
          });

          // 4. Parse response
          const parsed = this.parseGeneratedContent(response.content);

          // 5. Validate generated content
          this.validateGenerated(parsed, config);

          // 5b. Parse and validate playable structure (if present)
          let playableStructure: PlayableStructure | undefined;
          const rawParsed = parsed as Record<string, unknown>;
          if (rawParsed.playableStructure) {
            try {
              playableStructure = this.parsePlayableContent(rawParsed.playableStructure);
              this.validatePlayableStructure(playableStructure, config, parsed.materials);

              // 5c. Enrich narrative content with separate LLM calls per character
              console.log('[generateStory] Enriching narrative content...');
              await this.enrichNarrativeContent(playableStructure, characters, config);

              this.validateNarrativeContent(playableStructure);
            } catch (e) {
              console.warn(`[generateStory] PlayableStructure parsing/validation warning: ${(e as Error).message}`);
            }
          }

          // 6. Build script object — store characterProfiles snapshot and generationMode in content
          const script: Script = {
            id: uuidv4(),
            version: 'v1.0',
            configId: config.id,
            config,
            title: parsed.title || `${config.theme} - ${config.era}`,
            dmHandbook: parsed.dmHandbook,
            playerHandbooks: parsed.playerHandbooks,
            materials: parsed.materials,
            branchStructure: parsed.branchStructure,
            playableStructure,
            characterProfiles: characters,
            generationMode: 'character_first' as GenerationMode,
            tags: [],
            status: ScriptStatus.READY,
            aiProvider: this.llmAdapter.getProviderName(),
            aiModel: this.llmAdapter.getDefaultModel(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return script;
        }

      /**
       * Enrich narrative content by making separate LLM calls per character.
       * After the main script generation produces a skeleton, this method fills in
       * immersiveNarrative (prologue/finale) and upgrades personalNarrative (each act)
       * with rich second-person immersive text.
       */
      async enrichNarrativeContent(
        playable: PlayableStructure,
        characters: FullCharacterProfile[],
        config: ScriptConfig,
      ): Promise<void> {
        const characterMap = new Map<string, FullCharacterProfile>();
        for (const c of characters) {
          characterMap.set(c.characterId, c);
        }

        // Build act summaries for cross-character consistency
        const actSummaries = playable.acts.map(act =>
          `第${act.actIndex}幕「${act.title}」：${act.narrative}`,
        ).join('\n');

        for (const ph of playable.playerHandbooks) {
          const profile = characterMap.get(ph.characterId);
          if (!profile) continue;

          try {
            console.log(`[enrichNarrativeContent] Generating narrative for ${ph.characterName}...`);
            const prompt = this.buildNarrativeEnrichmentPrompt(ph, profile, playable, actSummaries, config);

            const response = await this.llmAdapter.send({
              systemPrompt: `你是一位专业的剧本杀沉浸式叙事作家。你的任务是为角色生成第二人称（"你"）视角的沉浸式叙事文本。
    请严格按照JSON格式输出，不要输出任何JSON以外的内容。`,
              prompt,
              temperature: 0.8,
              maxTokens: 8000,
            });

            // Parse the narrative response
            let jsonStr = response.content.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonStr = jsonMatch[1].trim();
            if (!jsonStr.startsWith('{')) {
              const firstBrace = jsonStr.indexOf('{');
              const lastBrace = jsonStr.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
              }
            }

            const narrativeData = JSON.parse(jsonStr) as {
              prologueNarrative?: string;
              actNarratives?: string[];
              finaleNarrative?: string;
            };

            // Apply enriched narratives
            if (narrativeData.prologueNarrative) {
              ph.prologueContent.immersiveNarrative = narrativeData.prologueNarrative;
            }
            if (narrativeData.actNarratives && Array.isArray(narrativeData.actNarratives)) {
              for (let i = 0; i < Math.min(narrativeData.actNarratives.length, ph.actContents.length); i++) {
                if (narrativeData.actNarratives[i]) {
                  ph.actContents[i].personalNarrative = narrativeData.actNarratives[i];
                }
              }
            }
            if (narrativeData.finaleNarrative) {
              ph.finaleContent.immersiveNarrative = narrativeData.finaleNarrative;
            }

            console.log(`[enrichNarrativeContent] Done for ${ph.characterName}`);
          } catch (err) {
            console.warn(`[enrichNarrativeContent] Failed for ${ph.characterName}: ${(err as Error).message}`);
            // Non-fatal: keep the skeleton narrative
          }
        }
      }

      /**
       * Build the prompt for narrative enrichment of a single character.
       */
      private buildNarrativeEnrichmentPrompt(
        handbook: PlayablePlayerHandbook,
        profile: FullCharacterProfile,
        playable: PlayableStructure,
        actSummaries: string,
        config: ScriptConfig,
      ): string {
        const actDetails = handbook.actContents.map(ac => {
          const act = playable.acts.find(a => a.actIndex === ac.actIndex);
          return `第${ac.actIndex}幕：
      - 全局叙述：${act?.narrative || ''}
      - 角色目标：${ac.objectives.join('、')}
      - 线索提示：${ac.clueHints.join('、')}
      - 秘密信息：${ac.secretInfo}
      - 当前骨架叙事：${ac.personalNarrative}`;
        }).join('\n');

        return `请为角色「${profile.characterName}」生成完整的第二人称（"你"）沉浸式叙事。

    【角色设定】
    - 姓名：${profile.characterName}
    - 性别：${profile.gender}
    - MBTI：${profile.mbtiType}
    - 血型：${profile.bloodType}
    - 性格：${profile.personality}
    - 外貌：${profile.appearance}
    - 背景故事：${profile.backgroundStory}
    - 核心动机：${profile.primaryMotivation}
    - 叙事定位：${profile.narrativeRole}
    - 秘密：${(profile.secrets || []).join('；')}
    - 关系：${(profile.relationships || []).map(r => `${r.targetCharacterName}(${r.relationshipType}): ${r.description}`).join('；')}

    【故事背景】
    ${playable.prologue.backgroundNarrative}

    【各幕概要】
    ${actSummaries}

    【角色各幕详情】
    ${actDetails}

    【序幕背景】
    ${handbook.prologueContent.backgroundStory}

    【写作规范】
    1. 全程使用第二人称"你"作为叙事主语
    2. 根据角色MBTI调整风格：${profile.mbtiType.startsWith('I') ? '内向型——多内心独白和观察描写' : '外向型——多互动、对话和社交场景'}
    3. 每幕叙事不少于300字
    4. 仅描述该角色合理可感知的信息，不泄露其他角色秘密
    5. ${profile.narrativeRole === 'murderer' ? '作为凶手，合理隐藏犯罪行为，提供看似合理的替代解释' : profile.narrativeRole === 'suspect' ? '作为嫌疑人，呈现可能显得可疑的情境，同时保留无辜视角' : '以角色自身视角真实描述经历'}
    6. 误导性信念以角色确信口吻呈现，不标注为误导信息
    7. 序幕叙事融入内心独白和情感基调，以暗示方式埋入角色秘密线索
    8. 终幕叙事呈现角色对事件全貌的个人理解和面对最终审判的心理状态
    9. 全篇保持一致的叙事语气（NarrativeVoice），不出现风格突变

    请输出以下JSON格式：
    {
      "prologueNarrative": "序幕沉浸式叙事（以'你'开头，200+字）",
      "actNarratives": [
        "第1幕沉浸式叙事（以'你'开头，300+字）",
        "第2幕沉浸式叙事（以'你'开头，300+字）",
        ...共${config.roundStructure.totalRounds}个
      ],
      "finaleNarrative": "终幕沉浸式叙事（以'你'开头，200+字）"
    }`;
      }



    /**
     * Get a ScriptConfig from MySQL by ID.
     * Replicates ConfigService.getById pattern for use within GeneratorService.
     */
    private async getConfig(configId: string): Promise<ScriptConfig | null> {
      const [rows] = await pool.execute(
        'SELECT * FROM script_configs WHERE id = ?',
        [configId],
      );

      const results = rows as Record<string, unknown>[];
      if (results.length === 0) return null;

      const row = results[0];
      return {
        id: row.id as string,
        playerCount: row.player_count as number,
        durationHours: row.duration_hours as number,
        gameType: row.game_type as GameType,
        ageGroup: row.age_group as AgeGroup,
        restorationRatio: row.restoration_ratio as number,
        deductionRatio: row.deduction_ratio as number,
        era: row.era as string,
        location: row.location as string,
        theme: row.theme as string,
        language: (row.language as string) || 'zh',
        style: (row.style as ScriptStyle) || ScriptStyle.DETECTIVE,
        roundStructure: typeof row.round_structure === 'string'
          ? JSON.parse(row.round_structure)
          : row.round_structure as RoundStructure,
        specialSetting: row.special_setting
          ? (typeof row.special_setting === 'string'
            ? JSON.parse(row.special_setting)
            : row.special_setting)
          : undefined,
      } as ScriptConfig;
    }

        // ─── 反馈驱动的角色优化 ───

        /**
         * Optimize an existing Script using two-phase character-first approach with feedback.
         * 1. Load original Script from MySQL
         * 2. Extract characterProfiles (from script or reconstruct from playerHandbooks)
         * 3. Get CHARACTER_DESIGN and MOTIVE Skill templates
         * 4. Build optimization prompt with buildCharacterOptimizationPrompt
         * 5. Call LLM to generate optimized characters
         * 6. Parse and validate optimized characters
         * 7. Generate story with generateStory(config, optimizedCharacters, feedback)
         * 8. Store and return the new Script
         * Requirements: 6.1, 6.2, 6.3
         */
        async optimizeWithFeedbackCharacterFirst(
          scriptId: string,
          feedback: AggregatedFeedback,
        ): Promise<Script> {
          // 1. Load original Script
          const original = await this.getScript(scriptId);
          if (!original) throw new Error(`Script not found: ${scriptId}`);

          // 2. Extract character profiles from original script
          let characters: FullCharacterProfile[] = [];
          if (original.characterProfiles && original.characterProfiles.length > 0) {
            characters = original.characterProfiles;
          } else if (original.playerHandbooks && original.playerHandbooks.length > 0) {
            // Reconstruct from playerHandbooks
            characters = original.playerHandbooks.map((handbook) => ({
              characterId: handbook.characterId || uuidv4(),
              characterName: handbook.characterName,
              characterType: 'player' as const,
              gender: '',
              bloodType: 'O' as const,
              mbtiType: 'INFJ',
              personality: handbook.backgroundStory?.substring(0, 100) || '',
              appearance: '',
              backgroundStory: handbook.backgroundStory || '',
              primaryMotivation: handbook.primaryGoal || '',
              secrets: handbook.secrets?.length > 0 ? handbook.secrets : ['未知秘密'],
              relationships: [],
            }));
          }

          // 3. Get CHARACTER_DESIGN and MOTIVE Skill templates
          const skills = await this.skillService.getForGeneration(
            original.config.gameType,
            [SkillCategory.CHARACTER_DESIGN, SkillCategory.MOTIVE],
          );

          // 4. Build optimization prompt
          const systemPrompt = this.buildCharacterSystemPrompt(original.config);
          const userPrompt = this.buildCharacterOptimizationPrompt(characters, feedback, skills);

          // 5. Call LLM to generate optimized characters
          const response = await this.llmAdapter.send({
            systemPrompt,
            prompt: userPrompt,
            temperature: 0.7,
          });

          // 6. Parse and validate optimized characters
          const optimizedCharacters = this.parseCharacterProfiles(response.content);
          this.validateCharacterProfiles(optimizedCharacters, original.config);

          // 7. Generate story with optimized characters
          const script = await this.generateStory(original.config, optimizedCharacters, feedback);

          // 8. Update version and parentVersionId, then store
          script.version = this.incrementVersion(original.version);
          script.parentVersionId = original.id;
          await this.storeScript(script);

          return script;
        }

        /**
         * Build character optimization prompt combining original characters, feedback, and skills.
         * - Includes original character profiles
         * - Highlights low-score dimensions (averageScore < 6) as optimization focus
         * - Includes frequent suggestions from feedback
         * - Includes Skill templates
         * - Instructs to maintain MBTI/bloodType-personality consistency
         * - Instructs to keep character identities while improving weak areas
         * Requirements: 6.2
         */
        buildCharacterOptimizationPrompt(
          characters: FullCharacterProfile[],
          feedback: AggregatedFeedback,
          skills: SkillTemplate[],
        ): string {
          // Identify low-score dimensions
          const lowScoreDimensions = feedback.dimensions
            .filter(d => d.averageScore < 6)
            .map(d => `${d.dimension}(平均${d.averageScore.toFixed(1)}分)`);

          // Build character summary
          const characterSummary = characters.map(c =>
            `- ${c.characterName}（${c.characterType}）：性别=${c.gender}，血型=${c.bloodType}，MBTI=${c.mbtiType}，性格=${c.personality}，动机=${c.primaryMotivation}`,
          ).join('\n');

          // Build skill templates section
          const skillSection = skills.map(s => `【${s.name}】${s.description}\n${s.content}`).join('\n\n');

          return `【角色优化任务】
    基于以下反馈数据，优化已有角色设定。

    【原始角色设定】
    ${characterSummary}

    【完整角色数据】
    ${JSON.stringify(characters, null, 2)}

    ${lowScoreDimensions.length > 0 ? `【需要重点优化的维度】\n${lowScoreDimensions.join('、')}\n请针对以上低分维度重点优化角色设定。` : ''}

    ${feedback.frequentSuggestions.length > 0 ? `【玩家高频建议】\n${feedback.frequentSuggestions.join('；')}` : ''}

    【优化要求】
    1. 保持角色的核心身份（名称、核心关系）不变
    2. 保持每个角色的 MBTI 类型（mbtiType）和血型（bloodType）与性格特征（personality）之间的一致性
    3. 针对低分维度进行重点改进
    4. 改善角色深度、动机合理性等薄弱环节
    5. 输出格式为 JSON 数组，每个元素为完整的 CharacterProfile 结构

    ${skillSection ? `【参考技能模板】\n${skillSection}` : ''}`;
        }


}
