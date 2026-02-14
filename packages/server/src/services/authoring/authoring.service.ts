/**
 * AuthoringService - 分阶段创作编排服务
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuthoringSession,
  AuthoringMode,
  SessionState,
  SessionFilters,
  PhaseName,
  ChapterType,
  Chapter,
  AuthorEdit,
  PhaseOutput,
  FailureInfo,
  ScriptStatus,
} from '@murder-mystery/shared';
import type {
  Script,
  DMHandbook,
  PlayerHandbook,
  Material,
  BranchStructure,
  ScriptConfig,
} from '@murder-mystery/shared';
import type { EphemeralAiConfig } from '@murder-mystery/shared';
import { ILLMAdapter } from '../../adapters/llm-adapter.interface';
import { LLMAdapter } from '../../adapters/llm-adapter';
import { SkillService } from '../skill.service';
import { GeneratorService } from '../generator.service';
import { ConfigService } from '../config.service';
import { transition } from './state-machine';
import { PromptBuilder } from './prompt-builder';
import { PhaseParser } from './phase-parser';
import { SkillCategory } from '@murder-mystery/shared';
import { pool } from '../../db/mysql';

/** States in which the session's AI config may be updated */
export const AI_CONFIG_UPDATABLE_STATES: SessionState[] = [
  'failed',
  'plan_review',
  'design_review',
  'chapter_review',
  'draft',
];

export class AuthoringService {
  // 会话级临时适配器缓存
  private sessionAdapters: Map<string, ILLMAdapter> = new Map();

  constructor(
    private llmAdapter: ILLMAdapter,
    private skillService: SkillService,
    private generatorService: GeneratorService,
    private configService: ConfigService,
  ) {}

  /**
   * 获取会话对应的 LLM 适配器。
   * 优先使用 sessionAdapters 中的临时适配器，否则使用默认适配器。
   * Requirements: 3.2, 3.3, 3.4
   */
  getAdapterForSession(sessionId: string): ILLMAdapter {
    const sessionAdapter = this.sessionAdapters.get(sessionId);
    if (sessionAdapter) {
      return sessionAdapter;
    }
    if (this.llmAdapter) {
      return this.llmAdapter;
    }
    throw new Error('No AI configuration available. Please provide ephemeralAiConfig.');
  }

  /**
   * 会话完成或失败时，清除临时适配器。
   * Requirements: 4.2
   */
  cleanupSessionAdapter(sessionId: string): void {
    this.sessionAdapters.delete(sessionId);
  }

  // ─── Session Management (Task 6.1) ───

  /**
   * Create a new authoring session.
   * Requirements: 1.1, 1.4
   */
  async createSession(configId: string, mode: AuthoringMode, ephemeralAiConfig?: EphemeralAiConfig): Promise<AuthoringSession> {
    const config = await this.configService.getById(configId);
    if (!config) {
      throw new Error(`Config not found: ${configId}`);
    }

    const now = new Date();
    const session: AuthoringSession = {
      id: uuidv4(),
      configId,
      mode,
      state: 'draft',
      chapters: [],
      chapterEdits: {},
      currentChapterIndex: 0,
      totalChapters: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 如果提供了临时 AI 配置，创建临时适配器并缓存
    if (ephemeralAiConfig) {
      const adapter = new LLMAdapter({
        apiKey: ephemeralAiConfig.apiKey,
        endpoint: ephemeralAiConfig.endpoint,
        model: ephemeralAiConfig.model,
        provider: ephemeralAiConfig.provider,
      });
      this.sessionAdapters.set(session.id, adapter);
      session.aiConfigMeta = {
        provider: ephemeralAiConfig.provider,
        model: ephemeralAiConfig.model,
      };
    }

    await this.insertSession(session);
    return session;
  }

  /**
   * Get a session by ID.
   * Requirements: 1.2
   */
  async getSession(sessionId: string): Promise<AuthoringSession | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM authoring_sessions WHERE id = ?',
      [sessionId],
    );
    const results = rows as Record<string, unknown>[];
    if (results.length === 0) return null;
    return this.rowToSession(results[0]);
  }

  /**
   * List sessions with optional filters.
   * Requirements: 1.3
   */
  async listSessions(filters?: SessionFilters): Promise<AuthoringSession[]> {
    let query = 'SELECT * FROM authoring_sessions';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters?.configId) {
      conditions.push('config_id = ?');
      params.push(filters.configId);
    }
    if (filters?.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    if (filters?.mode) {
      conditions.push('mode = ?');
      params.push(filters.mode);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const [rows] = await pool.execute(query, params);
    return (rows as Record<string, unknown>[]).map(r => this.rowToSession(r));
  }

  // ─── Stub methods for future tasks (6.2-6.6) ───

  /** All skill categories for generation */
  private static readonly ALL_CATEGORIES = Object.values(SkillCategory) as SkillCategory[];

  /**
   * Advance the session to the next phase based on current state and mode.
   * Requirements: 2.2, 2.3, 3.1, 3.3, 4.1, 4.3, 5.1, 5.2, 6.1, 6.2
   */
  async advance(sessionId: string): Promise<AuthoringSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const config = await this.configService.getById(session.configId);
    if (!config) {
      throw new Error(`Config not found: ${session.configId}`);
    }

    // Early API key validation — fail fast with a clear message
    const adapter = this.getAdapterForSession(session.id);
    adapter.validateApiKey();

    if (session.mode === 'vibe') {
      return this.advanceVibe(session, config);
    }

    return this.advanceStaged(session, config);
  }

  /**
   * Advance a vibe-mode session: draft → generating → completed.
   * Requirements: 6.1, 6.2
   */
  private async advanceVibe(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
  ): Promise<AuthoringSession> {
    if (session.state !== 'draft') {
      throw new Error(`Cannot advance vibe session from state '${session.state}'`);
    }

    // draft → generating
    const toGenerating = transition(session.state, 'generating', 'vibe');
    if (!toGenerating.success) throw new Error(toGenerating.error);
    session.state = toGenerating.newState!;

    try {
      const script = await this.generatorService.generate(config);
      // generating → completed
      const toCompleted = transition(session.state, 'completed', 'vibe');
      if (!toCompleted.success) throw new Error(toCompleted.error);
      session.state = toCompleted.newState!;
      session.scriptId = script.id;
    } catch (err) {
      const toFailed = transition(session.state, 'failed', 'vibe');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'generating',
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
        retryFromState: 'generating',
      };
    }

    await this.saveSession(session);
    return session;
  }

  /**
   * Advance a staged-mode session based on current state.
   * Requirements: 2.2, 3.1, 3.3, 4.1, 4.3, 5.1, 5.2
   */
  private async advanceStaged(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
  ): Promise<AuthoringSession> {
    const promptBuilder = new PromptBuilder();
    const phaseParser = new PhaseParser();

    switch (session.state) {
      case 'draft':
        return this.advancePlanning(session, config, promptBuilder, phaseParser);
      case 'executing':
        return this.advanceExecuting(session, config, promptBuilder, phaseParser);
      default:
        throw new Error(`Cannot advance staged session from state '${session.state}'`);
    }
  }

  /**
   * Planning phase: draft → planning → plan_review.
   * Requirements: 3.1, 3.3
   */
  private async advancePlanning(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    promptBuilder: PromptBuilder,
    phaseParser: PhaseParser,
  ): Promise<AuthoringSession> {
    // draft → planning
    const toPlanning = transition(session.state, 'planning', 'staged');
    if (!toPlanning.success) throw new Error(toPlanning.error);
    session.state = toPlanning.newState!;

    try {
      const skills = await this.skillService.getForGeneration(
        config.gameType,
        AuthoringService.ALL_CATEGORIES,
      );
      const request = promptBuilder.buildPlanningPrompt(config, skills);
      const response = await this.getAdapterForSession(session.id).send(request);
      session.lastStepTokens = response.tokenUsage;
      const plan = phaseParser.parsePlan(response.content);

      // Assign output BEFORE state transition (checkpoint: persist artifacts first)
      session.planOutput = {
        phase: 'plan',
        llmOriginal: plan,
        edits: [],
        approved: false,
        generatedAt: new Date(),
      };

      // Persist output before state transition (Requirement 5.1)
      await this.saveSession(session);

      // planning → plan_review
      const toPlanReview = transition(session.state, 'plan_review', 'staged');
      if (!toPlanReview.success) throw new Error(toPlanReview.error);
      session.state = toPlanReview.newState!;
    } catch (err) {
      const toFailed = transition(session.state, 'failed', 'staged');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'plan',
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
        retryFromState: 'planning',
      };
    }

    await this.saveSession(session);
    return session;
  }

  /**
   * Execution phase: generate next chapter based on currentChapterIndex.
   * Requirements: 5.1, 5.2
   */
  private async advanceExecuting(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    promptBuilder: PromptBuilder,
    phaseParser: PhaseParser,
  ): Promise<AuthoringSession> {
    const totalChapters = config.playerCount + 3;
    session.totalChapters = totalChapters;

    const chapterIndex = session.currentChapterIndex;
    const chapterType = this.getChapterType(chapterIndex, config.playerCount);

    const approvedOutline = session.outlineOutput?.authorEdited ?? session.outlineOutput?.llmOriginal;
    if (!approvedOutline) {
      throw new Error('Cannot execute chapters without an approved outline');
    }

    try {
      // Get previously approved chapters
      const previousChapters = session.chapters.filter(ch => ch.index < chapterIndex);

      const request = promptBuilder.buildChapterPrompt(
        config,
        approvedOutline as import('@murder-mystery/shared').ScriptOutline,
        chapterType,
        chapterIndex,
        previousChapters,
        (session.planOutput?.authorEdited ?? session.planOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptPlan | undefined,
      );
      const response = await this.getAdapterForSession(session.id).send(request);
      const chapter = phaseParser.parseChapter(response.content, chapterType);

      // Set correct index and characterId
      chapter.index = chapterIndex;
      if (chapterType === 'player_handbook') {
        chapter.characterId = `player-${chapterIndex}`;
      }

      // Replace or add chapter at this index
      const existingIdx = session.chapters.findIndex(ch => ch.index === chapterIndex);
      if (existingIdx >= 0) {
        session.chapters[existingIdx] = chapter;
      } else {
        session.chapters.push(chapter);
      }

      // executing → chapter_review
      const toChapterReview = transition(session.state, 'chapter_review', 'staged');
      if (!toChapterReview.success) throw new Error(toChapterReview.error);
      session.state = toChapterReview.newState!;
    } catch (err) {
      const toFailed = transition(session.state, 'failed', 'staged');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'chapter',
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
        retryFromState: 'executing',
      };
    }

    await this.saveSession(session);
    return session;
  }

  /**
   * Determine chapter type based on index and playerCount.
   * Index 0 = dm_handbook, 1..N = player_handbook, N+1 = materials, N+2 = branch_structure
   */
  private getChapterType(chapterIndex: number, playerCount: number): ChapterType {
    if (chapterIndex === 0) return 'dm_handbook';
    if (chapterIndex <= playerCount) return 'player_handbook';
    if (chapterIndex === playerCount + 1) return 'materials';
    return 'branch_structure';
  }

  /**
   * Edit a phase's output content.
   * Requirements: 3.4, 4.4, 5.5
   */
  async editPhase(sessionId: string, phase: PhaseName, content: unknown): Promise<AuthoringSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Verify correct review state for the phase
    const expectedState = this.getReviewStateForPhase(phase);
    if (session.state !== expectedState) {
      throw new Error(
        `Cannot edit '${phase}' phase in state '${session.state}', expected '${expectedState}'`,
      );
    }

    if (phase === 'plan') {
      if (!session.planOutput) {
        throw new Error('No plan output to edit');
      }
      const edit: AuthorEdit = {
        editedAt: new Date(),
        originalContent: session.planOutput.llmOriginal,
        editedContent: content,
      };
      session.planOutput.authorEdited = content;
      session.planOutput.edits.push(edit);
    } else if (phase === 'outline') {
      if (!session.outlineOutput) {
        throw new Error('No outline output to edit');
      }
      const edit: AuthorEdit = {
        editedAt: new Date(),
        originalContent: session.outlineOutput.llmOriginal,
        editedContent: content,
      };
      session.outlineOutput.authorEdited = content;
      session.outlineOutput.edits.push(edit);
    } else if (phase === 'chapter') {
      const chapterIndex = session.currentChapterIndex;
      const chapter = session.chapters.find(ch => ch.index === chapterIndex);
      if (!chapter) {
        throw new Error(`No chapter at index ${chapterIndex} to edit`);
      }
      const edit: AuthorEdit = {
        editedAt: new Date(),
        originalContent: chapter.content,
        editedContent: content,
      };
      chapter.content = content;
      if (!session.chapterEdits[chapterIndex]) {
        session.chapterEdits[chapterIndex] = [];
      }
      session.chapterEdits[chapterIndex].push(edit);
    }

    await this.saveSession(session);
    return session;
  }

  /**
   * Approve a phase and trigger the next phase.
   * Requirements: 3.5, 3.6, 4.5, 4.6, 5.3
   */
  async approvePhase(sessionId: string, phase: PhaseName, notes?: string): Promise<AuthoringSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Verify correct review state for the phase
    const expectedState = this.getReviewStateForPhase(phase);
    if (session.state !== expectedState) {
      throw new Error(
        `Cannot approve '${phase}' phase in state '${session.state}', expected '${expectedState}'`,
      );
    }

    const config = await this.configService.getById(session.configId);
    if (!config) {
      throw new Error(`Config not found: ${session.configId}`);
    }

    // Early API key validation — approve triggers LLM generation for next phase
    const adapter = this.getAdapterForSession(session.id);
    adapter.validateApiKey();

    if (phase === 'plan') {
      return this.approvePlan(session, config, notes);
    } else if (phase === 'outline') {
      return this.approveOutline(session, config, notes);
    } else {
      return this.approveChapter(session, config);
    }
  }

  /**
   * Get the expected review state for a given phase name.
   */
  private getReviewStateForPhase(phase: PhaseName): SessionState {
    switch (phase) {
      case 'plan': return 'plan_review';
      case 'outline': return 'design_review';
      case 'chapter': return 'chapter_review';
    }
  }

  /**
   * Approve plan: plan_review → designing → design_review.
   * Requirements: 3.5, 3.6, 4.1, 4.6
   */
  private async approvePlan(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    notes?: string,
  ): Promise<AuthoringSession> {
    session.planOutput!.approved = true;
    session.planOutput!.approvedAt = new Date();
    if (notes) {
      session.planOutput!.authorNotes = notes;
    }

    // plan_review → designing
    const toDesigning = transition(session.state, 'designing', 'staged');
    if (!toDesigning.success) throw new Error(toDesigning.error);
    session.state = toDesigning.newState!;

    const promptBuilder = new PromptBuilder();
    const phaseParser = new PhaseParser();

    try {
      const skills = await this.skillService.getForGeneration(
        config.gameType,
        AuthoringService.ALL_CATEGORIES,
      );
      const approvedPlan = (session.planOutput!.authorEdited ?? session.planOutput!.llmOriginal) as import('@murder-mystery/shared').ScriptPlan;
      const request = promptBuilder.buildDesignPrompt(config, approvedPlan, skills, session.planOutput!.authorNotes);
      const response = await this.getAdapterForSession(session.id).send(request);
      session.lastStepTokens = response.tokenUsage;
      const outline = phaseParser.parseOutline(response.content);

      // Assign output BEFORE state transition (checkpoint: persist artifacts first)
      session.outlineOutput = {
        phase: 'outline',
        llmOriginal: outline,
        edits: [],
        approved: false,
        generatedAt: new Date(),
      };

      // Persist output before state transition (Requirement 5.2)
      await this.saveSession(session);

      // designing → design_review
      const toDesignReview = transition(session.state, 'design_review', 'staged');
      if (!toDesignReview.success) throw new Error(toDesignReview.error);
      session.state = toDesignReview.newState!;
    } catch (err) {
      const toFailed = transition(session.state, 'failed', 'staged');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'outline',
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
        retryFromState: 'designing',
      };
    }

    await this.saveSession(session);
    return session;
  }

  /**
   * Approve outline: design_review → executing → chapter_review.
   * Generates DM handbook first (chapter 0), then player handbooks in parallel.
   * Requirements: 4.5, 5.1, 5.2
   */
  private async approveOutline(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    notes?: string,
  ): Promise<AuthoringSession> {
    session.outlineOutput!.approved = true;
    session.outlineOutput!.approvedAt = new Date();
    if (notes) {
      session.outlineOutput!.authorNotes = notes;
    }

    // design_review → executing
    const toExecuting = transition(session.state, 'executing', 'staged');
    if (!toExecuting.success) throw new Error(toExecuting.error);
    session.state = toExecuting.newState!;

    session.totalChapters = config.playerCount + 3;
    session.currentChapterIndex = 0;

    // Generate first chapter (DM handbook) — must be sequential
    const promptBuilder = new PromptBuilder();
    const phaseParser = new PhaseParser();
    return this.generateCurrentChapter(session, config, promptBuilder, phaseParser);
  }

  /**
   * Approve chapter: handles both single-chapter and parallel-batch flows.
   *
   * Parallel generation strategy:
   * - After DM handbook (ch 0) approved → generate all player handbooks in parallel
   * - After all player handbooks approved → generate materials + branch_structure in parallel
   * - Each batch: executing state, all chapters generated concurrently, then chapter_review
   *   for batch review (user reviews each chapter in the batch via currentChapterIndex)
   *
   * Requirements: 5.3, 5.6
   */
  private async approveChapter(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
  ): Promise<AuthoringSession> {
    const batch = session.parallelBatch;

    // If we're in a batch review, mark current chapter as reviewed
    if (batch) {
      const ci = session.currentChapterIndex;
      if (!batch.reviewedIndices.includes(ci)) {
        batch.reviewedIndices.push(ci);
      }

      // Find next un-reviewed chapter in this batch
      const nextUnreviewed = batch.chapterIndices.find(
        idx => !batch.reviewedIndices.includes(idx),
      );

      if (nextUnreviewed !== undefined) {
        // More chapters in this batch to review
        session.currentChapterIndex = nextUnreviewed;
        await this.saveSession(session);
        return session;
      }

      // All chapters in batch reviewed — clear batch and decide next step
      session.parallelBatch = undefined;
    }

    // Determine what to generate next based on current position
    const lastReviewedIndex = session.currentChapterIndex;
    const lastReviewedType = this.getChapterType(lastReviewedIndex, config.playerCount);

    // After DM handbook → parallel player handbooks
    if (lastReviewedType === 'dm_handbook') {
      const playerIndices = Array.from(
        { length: config.playerCount },
        (_, i) => i + 1,
      );
      return this.generateParallelBatch(session, config, playerIndices);
    }

    // After last player handbook → parallel materials + branch_structure
    if (lastReviewedType === 'player_handbook') {
      const materialsIdx = config.playerCount + 1;
      const branchIdx = config.playerCount + 2;
      return this.generateParallelBatch(session, config, [materialsIdx, branchIdx]);
    }

    // After materials/branch_structure → completed
    // chapter_review → completed
    const toCompleted = transition(session.state, 'completed', 'staged');
    if (!toCompleted.success) throw new Error(toCompleted.error);
    session.state = toCompleted.newState!;

    await this.saveSession(session);
    return this.assembleScript(session.id);
  }

  /**
   * Generate multiple chapters in parallel, then transition to chapter_review.
   * Sets up a ParallelBatch to track progress.
   */
  private async generateParallelBatch(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    chapterIndices: number[],
  ): Promise<AuthoringSession> {
    // chapter_review → executing
    const toExecuting = transition(session.state, 'executing', 'staged');
    if (!toExecuting.success) throw new Error(toExecuting.error);
    session.state = toExecuting.newState!;

    session.parallelBatch = {
      chapterIndices,
      completedIndices: [],
      failedIndices: [],
      reviewedIndices: [],
    };

    // Save executing state before starting parallel generation
    await this.saveSession(session);

    const promptBuilder = new PromptBuilder();
    const phaseParser = new PhaseParser();
    const approvedOutline = (session.outlineOutput?.authorEdited ?? session.outlineOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptOutline;
    const approvedPlan = (session.planOutput?.authorEdited ?? session.planOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptPlan | undefined;

    // All chapters in this batch share the same previousChapters (everything before the batch)
    const minBatchIndex = Math.min(...chapterIndices);
    const previousChapters = session.chapters.filter(ch => ch.index < minBatchIndex);

    // Fire all LLM calls in parallel
    const results = await Promise.allSettled(
      chapterIndices.map(async (chapterIndex) => {
        const chapterType = this.getChapterType(chapterIndex, config.playerCount);
        const request = promptBuilder.buildChapterPrompt(
          config,
          approvedOutline,
          chapterType,
          chapterIndex,
          previousChapters,
          approvedPlan,
        );
        const response = await this.getAdapterForSession(session.id).send(request);
        const chapter = phaseParser.parseChapter(response.content, chapterType);
        chapter.index = chapterIndex;
        if (chapterType === 'player_handbook') {
          chapter.characterId = `player-${chapterIndex}`;
        }
        return { chapter, tokenUsage: response.tokenUsage };
      }),
    );

    // Collect results and sum token usage from successful calls
    const failedIndices: number[] = [];
    const sumTokens = { prompt: 0, completion: 0, total: 0 };
    let hasSuccessful = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chapterIndex = chapterIndices[i];
      if (result.status === 'fulfilled') {
        const { chapter, tokenUsage } = result.value;
        const existingIdx = session.chapters.findIndex(ch => ch.index === chapterIndex);
        if (existingIdx >= 0) {
          session.chapters[existingIdx] = chapter;
        } else {
          session.chapters.push(chapter);
        }
        session.parallelBatch!.completedIndices.push(chapterIndex);
        if (tokenUsage) {
          sumTokens.prompt += tokenUsage.prompt;
          sumTokens.completion += tokenUsage.completion;
          sumTokens.total += tokenUsage.total;
          hasSuccessful = true;
        }
      } else {
        failedIndices.push(chapterIndex);
        session.parallelBatch!.failedIndices.push(chapterIndex);
      }
    }

    // Assign summed token usage from successful calls (Requirement 1.3)
    if (hasSuccessful) {
      session.lastStepTokens = sumTokens;
    }

    // Persist chapter outputs before state transition (Requirement 5.3)
    await this.saveSession(session);

    // If all failed, go to failed state
    if (failedIndices.length === chapterIndices.length) {
      const toFailed = transition(session.state, 'failed', 'staged');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'chapter',
        error: `All parallel chapters failed: [${failedIndices.join(', ')}]`,
        failedAt: new Date(),
        retryFromState: 'executing',
      };
      await this.saveSession(session);
      return session;
    }

    // At least some succeeded — go to chapter_review, start with first completed
    const toChapterReview = transition(session.state, 'chapter_review', 'staged');
    if (!toChapterReview.success) throw new Error(toChapterReview.error);
    session.state = toChapterReview.newState!;

    // Set currentChapterIndex to first completed chapter for review
    session.currentChapterIndex = session.parallelBatch!.completedIndices[0];

    await this.saveSession(session);
    return session;
  }

  /**
   * Generate the chapter at currentChapterIndex and transition to chapter_review.
   * Shared by approveOutline (first chapter) and approveChapter (subsequent chapters).
   */
  private async generateCurrentChapter(
    session: AuthoringSession,
    config: import('@murder-mystery/shared').ScriptConfig,
    promptBuilder: PromptBuilder,
    phaseParser: PhaseParser,
  ): Promise<AuthoringSession> {
    const chapterIndex = session.currentChapterIndex;
    const chapterType = this.getChapterType(chapterIndex, config.playerCount);
    const approvedOutline = (session.outlineOutput?.authorEdited ?? session.outlineOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptOutline;
    const approvedPlan = (session.planOutput?.authorEdited ?? session.planOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptPlan | undefined;

    try {
      const previousChapters = session.chapters.filter(ch => ch.index < chapterIndex);
      const request = promptBuilder.buildChapterPrompt(
        config,
        approvedOutline,
        chapterType,
        chapterIndex,
        previousChapters,
        approvedPlan,
      );
      const response = await this.getAdapterForSession(session.id).send(request);
      session.lastStepTokens = response.tokenUsage;
      const chapter = phaseParser.parseChapter(response.content, chapterType);

      chapter.index = chapterIndex;
      if (chapterType === 'player_handbook') {
        chapter.characterId = `player-${chapterIndex}`;
      }

      // Replace or add chapter
      const existingIdx = session.chapters.findIndex(ch => ch.index === chapterIndex);
      if (existingIdx >= 0) {
        session.chapters[existingIdx] = chapter;
      } else {
        session.chapters.push(chapter);
      }

      // Persist chapter output before state transition (Requirement 5.3)
      await this.saveSession(session);

      // executing → chapter_review
      const toChapterReview = transition(session.state, 'chapter_review', 'staged');
      if (!toChapterReview.success) throw new Error(toChapterReview.error);
      session.state = toChapterReview.newState!;
    } catch (err) {
      const toFailed = transition(session.state, 'failed', 'staged');
      if (toFailed.success) {
        session.state = toFailed.newState!;
      } else {
        session.state = 'failed';
      }
      session.failureInfo = {
        phase: 'chapter',
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date(),
        retryFromState: 'executing',
      };
    }

    await this.saveSession(session);
    return session;
  }

  /**
     * Regenerate a chapter: re-invoke LLM for the specified chapter, preserving
     * the previous version in chapterEdits as history.
     * Requirements: 5.4
     */
    async regenerateChapter(sessionId: string, chapterIndex: number): Promise<AuthoringSession> {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Early API key validation
      const adapter = this.getAdapterForSession(session.id);
      adapter.validateApiKey();

      // Must be in chapter_review state
      if (session.state !== 'chapter_review') {
        throw new Error(
          `Cannot regenerate chapter in state '${session.state}', expected 'chapter_review'`,
        );
      }

      // chapterIndex must match currentChapterIndex
      if (chapterIndex !== session.currentChapterIndex) {
        throw new Error(
          `Cannot regenerate chapter ${chapterIndex}, current chapter is ${session.currentChapterIndex}`,
        );
      }

      // Save current chapter content to chapterEdits as history
      const currentChapter = session.chapters.find(ch => ch.index === chapterIndex);
      if (currentChapter) {
        const edit: import('@murder-mystery/shared').AuthorEdit = {
          editedAt: new Date(),
          originalContent: currentChapter.content,
          editedContent: currentChapter.content,
        };
        if (!session.chapterEdits[chapterIndex]) {
          session.chapterEdits[chapterIndex] = [];
        }
        session.chapterEdits[chapterIndex].push(edit);
      }

      // chapter_review → executing
      const toExecuting = transition(session.state, 'executing', 'staged');
      if (!toExecuting.success) throw new Error(toExecuting.error);
      session.state = toExecuting.newState!;

      // Get config and regenerate using the same logic as generateCurrentChapter
      const config = await this.configService.getById(session.configId);
      if (!config) {
        throw new Error(`Config not found: ${session.configId}`);
      }

      const promptBuilder = new PromptBuilder();
      const phaseParser = new PhaseParser();
      return this.generateCurrentChapter(session, config, promptBuilder, phaseParser);
    }

  /**
     * Retry from failed state: restore session to the state before failure.
     * Requirements: 2.5, 2.6
     */
    async retry(sessionId: string): Promise<AuthoringSession> {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (session.state !== 'failed') {
        throw new Error(
          `Cannot retry session in state '${session.state}', expected 'failed'`,
        );
      }

      if (!session.failureInfo) {
        throw new Error('Cannot retry: no failure info recorded');
      }

      const targetState = session.failureInfo.retryFromState;
      const result = transition(session.state, targetState, session.mode);
      if (!result.success) {
        throw new Error(result.error);
      }

      session.state = result.newState!;
      session.failureInfo = undefined;

      await this.saveSession(session);
      return session;
    }

    /**
     * Update the AI configuration for an in-progress session.
     * Only allowed when the session is in one of AI_CONFIG_UPDATABLE_STATES.
     * Creates a new ephemeral adapter, replaces the old one, and updates aiConfigMeta.
     * Requirements: 3.1, 3.2, 3.3
     */
    async updateAiConfig(
      sessionId: string,
      ephemeralAiConfig: EphemeralAiConfig,
    ): Promise<AuthoringSession> {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (!AI_CONFIG_UPDATABLE_STATES.includes(session.state)) {
        throw new Error(
          `Cannot update AI config in state '${session.state}'`,
        );
      }

      // Create new ephemeral adapter and replace the old one
      const adapter = new LLMAdapter({
        apiKey: ephemeralAiConfig.apiKey,
        endpoint: ephemeralAiConfig.endpoint,
        model: ephemeralAiConfig.model,
        provider: ephemeralAiConfig.provider,
      });
      this.sessionAdapters.set(sessionId, adapter);

      // Update config metadata (no secrets persisted)
      session.aiConfigMeta = {
        provider: ephemeralAiConfig.provider,
        model: ephemeralAiConfig.model,
      };

      await this.saveSession(session);
      return session;
    }

    /**
     * Retry only the failed chapters from a parallel batch.
     * Requires session in chapter_review with non-empty parallelBatch.failedIndices.
     * On success: merges new chapters, clears retried indices from failedIndices.
     * On all-fail: transitions to failed, preserves existing successful chapters.
     * Requirements: 4.1, 4.2, 4.3, 4.4
     */
    async retryFailedChapters(sessionId: string): Promise<AuthoringSession> {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Early API key validation
      const adapter = this.getAdapterForSession(session.id);
      adapter.validateApiKey();

      if (session.state !== 'chapter_review') {
        throw new Error(
          `Cannot retry failed chapters in state '${session.state}', expected 'chapter_review'`,
        );
      }

      const failedIndices = session.parallelBatch?.failedIndices;
      if (!failedIndices || failedIndices.length === 0) {
        throw new Error('No failed chapters to retry');
      }

      const config = await this.configService.getById(session.configId);
      if (!config) {
        throw new Error(`Config not found: ${session.configId}`);
      }

      const promptBuilder = new PromptBuilder();
      const phaseParser = new PhaseParser();
      const approvedOutline = (session.outlineOutput?.authorEdited ?? session.outlineOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptOutline;
      const approvedPlan = (session.planOutput?.authorEdited ?? session.planOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptPlan | undefined;

      // Use chapters before the batch as context (same as generateParallelBatch)
      const minBatchIndex = Math.min(...failedIndices);
      const previousChapters = session.chapters.filter(ch => ch.index < minBatchIndex);

      // Fire all retry LLM calls in parallel
      const results = await Promise.allSettled(
        failedIndices.map(async (chapterIndex) => {
          const chapterType = this.getChapterType(chapterIndex, config.playerCount);
          const request = promptBuilder.buildChapterPrompt(
            config,
            approvedOutline,
            chapterType,
            chapterIndex,
            previousChapters,
            approvedPlan,
          );
          const response = await this.getAdapterForSession(session.id).send(request);
          const chapter = phaseParser.parseChapter(response.content, chapterType);
          chapter.index = chapterIndex;
          if (chapterType === 'player_handbook') {
            chapter.characterId = `player-${chapterIndex}`;
          }
          return { chapter, tokenUsage: response.tokenUsage };
        }),
      );

      // Collect results and sum token usage from successful retries
      const stillFailed: number[] = [];
      const sumTokens = { prompt: 0, completion: 0, total: 0 };
      let hasSuccessful = false;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const chapterIndex = failedIndices[i];
        if (result.status === 'fulfilled') {
          const { chapter, tokenUsage } = result.value;
          // Merge into chapters list
          const existingIdx = session.chapters.findIndex(ch => ch.index === chapterIndex);
          if (existingIdx >= 0) {
            session.chapters[existingIdx] = chapter;
          } else {
            session.chapters.push(chapter);
          }
          // Move from failedIndices to completedIndices
          session.parallelBatch!.completedIndices.push(chapterIndex);
          if (tokenUsage) {
            sumTokens.prompt += tokenUsage.prompt;
            sumTokens.completion += tokenUsage.completion;
            sumTokens.total += tokenUsage.total;
            hasSuccessful = true;
          }
        } else {
          stillFailed.push(chapterIndex);
        }
      }

      // Assign summed token usage from successful retries (Requirement 1.3)
      if (hasSuccessful) {
        session.lastStepTokens = sumTokens;
      }

      // Update failedIndices to only contain still-failed chapters
      session.parallelBatch!.failedIndices = stillFailed;

      // If ALL retries failed again, transition to failed state, preserve successful chapters
      if (stillFailed.length === failedIndices.length) {
        session.state = 'failed';
        session.failureInfo = {
          phase: 'chapter',
          error: `All retry chapters failed: [${stillFailed.join(', ')}]`,
          failedAt: new Date(),
          retryFromState: 'chapter_review',
        };
        await this.saveSession(session);
        return session;
      }

      // Some or all succeeded — stay in chapter_review
      await this.saveSession(session);
      return session;
    }



  /**
   * Assemble all approved chapters into a complete Script object and store it.
   * Requirements: 5.6, 6.3, 6.4
   *
   * Chapter order convention (from design doc):
   *   index 0       = dm_handbook
   *   index 1..N    = player_handbook (one per player)
   *   index N+1     = materials
   *   index N+2     = branch_structure
   */
  async assembleScript(sessionId: string): Promise<AuthoringSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (session.state !== 'completed') {
      throw new Error(`Cannot assemble script: session is in state '${session.state}', expected 'completed'`);
    }

    // If already assembled, return existing session
    if (session.scriptId) {
      return session;
    }

    if (session.chapters.length === 0) {
      throw new Error('Cannot assemble script: no chapters found');
    }

    const config = await this.configService.getById(session.configId);
    if (!config) throw new Error(`Config not found: ${session.configId}`);

    // Sort chapters by index to ensure correct ordering
    const sorted = [...session.chapters].sort((a, b) => a.index - b.index);

    // Extract content from each chapter, preferring author-edited content
    let dmHandbook: DMHandbook | undefined;
    const playerHandbooks: PlayerHandbook[] = [];
    let materials: Material[] = [];
    let branchStructure: BranchStructure | undefined;

    for (const chapter of sorted) {
      const content = this.getChapterContent(session, chapter);
      switch (chapter.type) {
        case 'dm_handbook':
          dmHandbook = content as DMHandbook;
          break;
        case 'player_handbook':
          playerHandbooks.push(content as PlayerHandbook);
          break;
        case 'materials':
          materials = content as Material[];
          break;
        case 'branch_structure':
          branchStructure = content as BranchStructure;
          break;
      }
    }

    if (!dmHandbook) throw new Error('Missing dm_handbook chapter');
    if (!branchStructure) throw new Error('Missing branch_structure chapter');

    const adapter = this.getAdapterForSession(sessionId);

    // Generate title: prefer LLM-generated title from plan, fallback to config theme
    const plan = (session.planOutput?.authorEdited ?? session.planOutput?.llmOriginal) as import('@murder-mystery/shared').ScriptPlan | undefined;
    let title = `${config.theme} - ${config.era}`;
    if (plan?.title && plan.title.length > 2) {
      title = plan.title;
    }

    const script: Script = {
      id: uuidv4(),
      version: 'v1.0',
      configId: config.id,
      config,
      title,
      dmHandbook,
      playerHandbooks,
      materials,
      branchStructure,
      tags: [],
      status: ScriptStatus.READY,
      aiProvider: adapter.getProviderName(),
      aiModel: adapter.getDefaultModel(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.generatorService.storeScript(script);

    session.scriptId = script.id;
    await this.saveSession(session);
    return session;
  }

  /**
   * Get the effective content for a chapter, preferring author-edited version.
   */
  private getChapterContent(session: AuthoringSession, chapter: Chapter): unknown {
    const edits = session.chapterEdits[chapter.index];
    if (edits && edits.length > 0) {
      // Return the most recent edit's editedContent
      return edits[edits.length - 1].editedContent;
    }
    return chapter.content;
  }

  // ─── DB Helpers ───

  /** Insert a new session into the database */
  private async insertSession(session: AuthoringSession): Promise<void> {
    const row = this.sessionToRow(session);
    await pool.execute(
      `INSERT INTO authoring_sessions
        (id, config_id, mode, state, plan_output, outline_output, chapters, chapter_edits,
         current_chapter_index, total_chapters, parallel_batch, script_id, ai_config_meta, failure_info, last_step_tokens, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.config_id, row.mode, row.state,
        row.plan_output, row.outline_output, row.chapters, row.chapter_edits,
        row.current_chapter_index, row.total_chapters, row.parallel_batch, row.script_id,
        row.ai_config_meta, row.failure_info, row.last_step_tokens,
        row.created_at, row.updated_at,
      ],
    );
  }

  /** Update an existing session in the database */
  async saveSession(session: AuthoringSession): Promise<void> {
    // 会话完成或失败时，清除临时适配器
    if (session.state === 'completed' || session.state === 'failed') {
      this.cleanupSessionAdapter(session.id);
    }

    session.updatedAt = new Date();
    const row = this.sessionToRow(session);
    await pool.execute(
      `UPDATE authoring_sessions SET
        config_id = ?, mode = ?, state = ?, plan_output = ?, outline_output = ?,
        chapters = ?, chapter_edits = ?, current_chapter_index = ?, total_chapters = ?,
        parallel_batch = ?, script_id = ?, ai_config_meta = ?, failure_info = ?, last_step_tokens = ?, updated_at = ?
       WHERE id = ?`,
      [
        row.config_id, row.mode, row.state, row.plan_output, row.outline_output,
        row.chapters, row.chapter_edits, row.current_chapter_index, row.total_chapters,
        row.parallel_batch, row.script_id, row.ai_config_meta, row.failure_info, row.last_step_tokens, row.updated_at, row.id,
      ],
    );
  }

  /** Convert AuthoringSession to DB row format */
  private sessionToRow(session: AuthoringSession): Record<string, unknown> {
    return {
      id: session.id,
      config_id: session.configId,
      mode: session.mode,
      state: session.state,
      plan_output: session.planOutput ? JSON.stringify(session.planOutput) : null,
      outline_output: session.outlineOutput ? JSON.stringify(session.outlineOutput) : null,
      chapters: JSON.stringify(session.chapters),
      chapter_edits: JSON.stringify(session.chapterEdits),
      current_chapter_index: session.currentChapterIndex,
      total_chapters: session.totalChapters,
      parallel_batch: session.parallelBatch ? JSON.stringify(session.parallelBatch) : null,
      script_id: session.scriptId ?? null,
      ai_config_meta: session.aiConfigMeta ? JSON.stringify(session.aiConfigMeta) : null,
      failure_info: session.failureInfo ? JSON.stringify(session.failureInfo) : null,
      last_step_tokens: session.lastStepTokens ? JSON.stringify(session.lastStepTokens) : null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    };
  }

  /** Convert DB row to AuthoringSession */
  private rowToSession(row: Record<string, unknown>): AuthoringSession {
    const parseJson = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') return JSON.parse(val);
      return val;
    };

    const parseDateFields = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(parseDateFields);
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (
          (key === 'generatedAt' || key === 'approvedAt' || key === 'editedAt' || key === 'failedAt') &&
          typeof value === 'string'
        ) {
          result[key] = new Date(value);
        } else if (typeof value === 'object' && value !== null) {
          result[key] = parseDateFields(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const planOutput = parseJson(row.plan_output);
    const outlineOutput = parseJson(row.outline_output);
    const chapters = parseJson(row.chapters) ?? [];
    const chapterEdits = parseJson(row.chapter_edits) ?? {};
    const failureInfo = parseJson(row.failure_info);
    const parallelBatch = parseJson(row.parallel_batch);
    const aiConfigMeta = parseJson(row.ai_config_meta);
    const lastStepTokens = parseJson(row.last_step_tokens);

    return {
      id: row.id as string,
      configId: row.config_id as string,
      mode: row.mode as AuthoringMode,
      state: row.state as SessionState,
      planOutput: parseDateFields(planOutput) as PhaseOutput | undefined,
      outlineOutput: parseDateFields(outlineOutput) as PhaseOutput | undefined,
      chapters: (parseDateFields(chapters) as Chapter[]),
      chapterEdits: parseDateFields(chapterEdits) as Record<number, AuthorEdit[]>,
      currentChapterIndex: row.current_chapter_index as number,
      totalChapters: row.total_chapters as number,
      parallelBatch: parallelBatch as import('@murder-mystery/shared').ParallelBatch | undefined,
      scriptId: row.script_id as string | undefined,
      aiConfigMeta: aiConfigMeta as import('@murder-mystery/shared').AiConfigMeta | undefined,
      failureInfo: parseDateFields(failureInfo) as FailureInfo | undefined,
      lastStepTokens: lastStepTokens as import('@murder-mystery/shared').TokenUsage | undefined,
      createdAt: new Date(row.created_at as string | Date),
      updatedAt: new Date(row.updated_at as string | Date),
    };
  }

}
