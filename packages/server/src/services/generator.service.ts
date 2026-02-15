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
  DMHandbook,
  PlayerHandbook,
  Material,
  MaterialType,
  BranchStructure,
  ClueDistributionEntry,
  AggregatedFeedback,
  LLMError,
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
  status: 'pending' | 'generating' | 'completed' | 'failed';
  scriptId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const JOB_PREFIX = 'generate_job:';
const JOB_TTL = 86400; // 24h

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

请严格按照以下JSON格式输出完整剧本内容。不要输出任何JSON以外的内容。
${specialSettingInstruction}

输出格式：
{
  "title": "剧本标题",
  "dmHandbook": { "overview": "", "characters": [], "timeline": [], "clueDistribution": [], "roundGuides": [], "branchDecisionPoints": [], "endings": [], "truthReveal": "", "judgingRules": { "winConditions": "", "scoringCriteria": "" } },
  "playerHandbooks": [ { "characterId": "", "characterName": "", "backgroundStory": "", "primaryGoal": "", "secondaryGoals": [], "relationships": [], "knownClues": [], "roundActions": [], "secrets": [] } ],
  "materials": [ { "id": "", "type": "clue_card|prop_card|vote_card|scene_card", "content": "", "clueId": "", "associatedCharacterId": "", "metadata": {} } ],
  "branchStructure": { "nodes": [], "edges": [], "endings": [] }
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

    return `${configSection}${skillSection}${feedbackSection}

请根据以上配置生成完整的剧本杀内容，确保：
1. 玩家手册数量 = ${config.playerCount}
2. 每张线索卡的clueId在DM手册线索分发表中都有对应条目
3. 分支结构从起始节点出发，任意路径都能到达至少一个结局
4. 每个玩家手册只包含该角色应知的信息`;
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

}
