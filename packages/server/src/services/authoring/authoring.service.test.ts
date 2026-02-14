import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pool module before importing the service
vi.mock('../../db/mysql', () => ({
  pool: {
    execute: vi.fn(),
  },
}));

import { pool } from '../../db/mysql';
import { AuthoringService } from './authoring.service';
import { ILLMAdapter } from '../../adapters/llm-adapter.interface';
import { SkillService } from '../skill.service';
import { GeneratorService } from '../generator.service';
import { ConfigService } from '../config.service';

// ─── Helpers ───

const mockPool = pool as unknown as { execute: ReturnType<typeof vi.fn> };

function makeMockLLM(): ILLMAdapter {
  return {
    send: vi.fn(),
    getProviderName: () => 'mock',
    getDefaultModel: () => 'mock-model',
    validateApiKey: vi.fn(),
  };
}

function makeService(configServiceOverrides?: Partial<ConfigService>) {
  const llm = makeMockLLM();
  const skillService = new SkillService();
  const generatorService = new GeneratorService(llm, skillService);
  const configService = {
    getById: vi.fn().mockResolvedValue({
      id: 'cfg-1',
      playerCount: 4,
      durationHours: 3,
      gameType: 'honkaku',
      ageGroup: 'adult',
      restorationRatio: 60,
      deductionRatio: 40,
      era: '民国',
      location: '上海',
      theme: '悬疑推理',
      language: 'zh',
      roundStructure: { rounds: [], totalRounds: 3, summaryMinutes: 30, finalVoteMinutes: 10, revealMinutes: 10 },
    }),
    ...configServiceOverrides,
  } as unknown as ConfigService;

  return new AuthoringService(llm, skillService, generatorService, configService);
}

// ─── Tests ───

describe('AuthoringService.createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  it('creates a session with correct initial state', async () => {
    const service = makeService();
    const session = await service.createSession('cfg-1', 'staged');

    expect(session.id).toBeDefined();
    expect(session.configId).toBe('cfg-1');
    expect(session.mode).toBe('staged');
    expect(session.state).toBe('draft');
    expect(session.chapters).toEqual([]);
    expect(session.chapterEdits).toEqual({});
    expect(session.currentChapterIndex).toBe(0);
    expect(session.totalChapters).toBe(0);
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
    expect(session.planOutput).toBeUndefined();
    expect(session.outlineOutput).toBeUndefined();
    expect(session.scriptId).toBeUndefined();
    expect(session.failureInfo).toBeUndefined();
  });

  it('creates a vibe mode session', async () => {
    const service = makeService();
    const session = await service.createSession('cfg-1', 'vibe');

    expect(session.mode).toBe('vibe');
    expect(session.state).toBe('draft');
  });

  it('calls pool.execute to insert the session', async () => {
    const service = makeService();
    await service.createSession('cfg-1', 'staged');

    expect(mockPool.execute).toHaveBeenCalledTimes(1);
    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('INSERT INTO authoring_sessions');
    expect(params[1]).toBe('cfg-1'); // config_id
    expect(params[2]).toBe('staged'); // mode
    expect(params[3]).toBe('draft'); // state
  });

  it('throws when config not found', async () => {
    const service = makeService({
      getById: vi.fn().mockResolvedValue(null),
    });

    await expect(service.createSession('nonexistent', 'staged'))
      .rejects.toThrow('Config not found: nonexistent');
  });
});

describe('AuthoringService.getSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-existent session', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();

    const result = await service.getSession('nonexistent');
    expect(result).toBeNull();
  });

  it('returns a deserialized session from DB row', async () => {
    const now = new Date('2025-01-15T10:00:00Z');
    mockPool.execute.mockResolvedValue([[{
      id: 'sess-1',
      config_id: 'cfg-1',
      mode: 'staged',
      state: 'draft',
      plan_output: null,
      outline_output: null,
      chapters: '[]',
      chapter_edits: '{}',
      current_chapter_index: 0,
      total_chapters: 0,
      script_id: null,
      failure_info: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }], []]);

    const service = makeService();
    const session = await service.getSession('sess-1');

    expect(session).not.toBeNull();
    expect(session!.id).toBe('sess-1');
    expect(session!.configId).toBe('cfg-1');
    expect(session!.mode).toBe('staged');
    expect(session!.state).toBe('draft');
    expect(session!.chapters).toEqual([]);
    expect(session!.chapterEdits).toEqual({});
    expect(session!.planOutput).toBeUndefined();
    expect(session!.createdAt).toEqual(now);
  });

  it('deserializes JSON columns correctly', async () => {
    const planOutput = {
      phase: 'plan',
      llmOriginal: { worldOverview: 'test' },
      edits: [],
      approved: false,
      generatedAt: '2025-01-15T10:00:00.000Z',
    };
    mockPool.execute.mockResolvedValue([[{
      id: 'sess-2',
      config_id: 'cfg-1',
      mode: 'staged',
      state: 'plan_review',
      plan_output: JSON.stringify(planOutput),
      outline_output: null,
      chapters: JSON.stringify([{ index: 0, type: 'dm_handbook', content: {}, generatedAt: '2025-01-15T10:00:00.000Z' }]),
      chapter_edits: JSON.stringify({ 0: [{ editedAt: '2025-01-15T11:00:00.000Z', originalContent: 'a', editedContent: 'b' }] }),
      current_chapter_index: 0,
      total_chapters: 1,
      script_id: null,
      failure_info: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    }], []]);

    const service = makeService();
    const session = await service.getSession('sess-2');

    expect(session!.planOutput).toBeDefined();
    expect(session!.planOutput!.phase).toBe('plan');
    expect(session!.planOutput!.generatedAt).toEqual(new Date('2025-01-15T10:00:00.000Z'));
    expect(session!.chapters).toHaveLength(1);
    expect(session!.chapters[0].generatedAt).toEqual(new Date('2025-01-15T10:00:00.000Z'));
  });
});

describe('AuthoringService.listSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all sessions when no filters', async () => {
    mockPool.execute.mockResolvedValue([[
      {
        id: 'sess-1', config_id: 'cfg-1', mode: 'staged', state: 'draft',
        plan_output: null, outline_output: null, chapters: '[]', chapter_edits: '{}',
        current_chapter_index: 0, total_chapters: 0, script_id: null, failure_info: null,
        created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z',
      },
    ], []]);

    const service = makeService();
    const sessions = await service.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('sess-1');
    const [query] = mockPool.execute.mock.calls[0];
    expect(query).toContain('ORDER BY created_at DESC');
    expect(query).not.toContain('WHERE');
  });

  it('applies configId filter', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();
    await service.listSessions({ configId: 'cfg-1' });

    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('config_id = ?');
    expect(params).toContain('cfg-1');
  });

  it('applies state filter', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();
    await service.listSessions({ state: 'draft' });

    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('state = ?');
    expect(params).toContain('draft');
  });

  it('applies mode filter', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();
    await service.listSessions({ mode: 'vibe' });

    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('mode = ?');
    expect(params).toContain('vibe');
  });

  it('applies multiple filters together', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();
    await service.listSessions({ configId: 'cfg-1', state: 'draft', mode: 'staged' });

    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('config_id = ?');
    expect(query).toContain('state = ?');
    expect(query).toContain('mode = ?');
    expect(query).toContain('AND');
    expect(params).toEqual(['cfg-1', 'draft', 'staged']);
  });

  it('applies limit and offset', async () => {
    mockPool.execute.mockResolvedValue([[], []]);
    const service = makeService();
    await service.listSessions({ limit: 10, offset: 20 });

    const [query, params] = mockPool.execute.mock.calls[0];
    expect(query).toContain('LIMIT ?');
    expect(query).toContain('OFFSET ?');
    expect(params).toEqual([10, 20]);
  });
});

// ─── Advance Tests (Task 6.2) ───

/** Helper: build a mock DB row for a session */
function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sess-1',
    config_id: 'cfg-1',
    mode: 'staged',
    state: 'draft',
    plan_output: null,
    outline_output: null,
    chapters: '[]',
    chapter_edits: '{}',
    current_chapter_index: 0,
    total_chapters: 0,
    parallel_batch: null,
    script_id: null,
    failure_info: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

/** Helper: create service with accessible mock LLM and generator */
function makeAdvanceService(overrides?: {
  llmSend?: ReturnType<typeof vi.fn>;
  generatorGenerate?: ReturnType<typeof vi.fn>;
  configGetById?: ReturnType<typeof vi.fn>;
}) {
  const sendFn = overrides?.llmSend ?? vi.fn();
  const llm: ILLMAdapter = {
    send: sendFn as ILLMAdapter['send'],
    getProviderName: () => 'mock',
    getDefaultModel: () => 'mock-model',
    validateApiKey: () => {},
  };
  const skillService = new SkillService();
  const generatorService = new GeneratorService(llm, skillService);
  if (overrides?.generatorGenerate) {
    generatorService.generate = overrides.generatorGenerate as GeneratorService['generate'];
  }
  const configService = {
    getById: overrides?.configGetById ?? vi.fn().mockResolvedValue({
      id: 'cfg-1',
      playerCount: 4,
      durationHours: 3,
      gameType: 'honkaku',
      ageGroup: 'adult',
      restorationRatio: 60,
      deductionRatio: 40,
      era: '民国',
      location: '上海',
      theme: '悬疑推理',
      language: 'zh',
      roundStructure: { rounds: [], totalRounds: 3, summaryMinutes: 30, finalVoteMinutes: 10, revealMinutes: 10 },
    }),
  } as unknown as ConfigService;

  return { service: new AuthoringService(llm, skillService, generatorService, configService), llm, generatorService };
}

/** Valid ScriptPlan JSON for LLM mock responses */
const VALID_PLAN_JSON = JSON.stringify({
  worldOverview: '民国上海滩',
  characters: [
    { name: '张三', role: '侦探', relationshipSketch: '与李四是旧友' },
    { name: '李四', role: '商人', relationshipSketch: '与张三有恩怨' },
    { name: '王五', role: '歌女', relationshipSketch: '暗恋张三' },
    { name: '赵六', role: '警察', relationshipSketch: '调查此案' },
  ],
  coreTrickDirection: '密室杀人',
  themeTone: '悬疑黑暗',
  eraAtmosphere: '民国乱世',
});

describe('AuthoringService.advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]); // getSession returns empty
    const { service } = makeAdvanceService();

    await expect(service.advance('nonexistent')).rejects.toThrow('Session not found: nonexistent');
  });

  describe('staged mode - draft → planning → plan_review', () => {
    it('transitions to plan_review after successful LLM call', async () => {
      // First call: getSession SELECT
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow()], []]);
      // Second call: saveSession UPDATE
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: VALID_PLAN_JSON,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('plan_review');
      expect(result.planOutput).toBeDefined();
      expect(result.planOutput!.phase).toBe('plan');
      expect(result.planOutput!.llmOriginal).toEqual(JSON.parse(VALID_PLAN_JSON));
      expect(result.planOutput!.approved).toBe(false);
      expect(result.planOutput!.edits).toEqual([]);
      expect(llmSend).toHaveBeenCalledTimes(1);
    });

    it('transitions to failed when LLM call fails', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow()], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockRejectedValue(new Error('LLM timeout'));

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('failed');
      expect(result.failureInfo).toBeDefined();
      expect(result.failureInfo!.phase).toBe('plan');
      expect(result.failureInfo!.error).toBe('LLM timeout');
      expect(result.failureInfo!.retryFromState).toBe('planning');
      expect(result.failureInfo!.failedAt).toBeInstanceOf(Date);
    });

    it('throws when trying to advance from non-draft state in staged mode', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'plan_review' })], []]);

      const { service } = makeAdvanceService();

      await expect(service.advance('sess-1')).rejects.toThrow(
        "Cannot advance staged session from state 'plan_review'",
      );
    });
  });

  describe('vibe mode - draft → generating → completed', () => {
    it('transitions to completed after successful generate call', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ mode: 'vibe' })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const generatorGenerate = vi.fn().mockResolvedValue({ id: 'script-1' });

      const { service } = makeAdvanceService({ generatorGenerate });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('completed');
      expect(result.scriptId).toBe('script-1');
      expect(generatorGenerate).toHaveBeenCalledTimes(1);
    });

    it('transitions to failed when generate call fails', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ mode: 'vibe' })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const generatorGenerate = vi.fn().mockRejectedValue(new Error('Generation failed'));

      const { service } = makeAdvanceService({ generatorGenerate });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('failed');
      expect(result.failureInfo).toBeDefined();
      expect(result.failureInfo!.phase).toBe('generating');
      expect(result.failureInfo!.error).toBe('Generation failed');
      expect(result.failureInfo!.retryFromState).toBe('generating');
    });

    it('throws when trying to advance vibe session from non-draft state', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ mode: 'vibe', state: 'completed' })], []]);

      const { service } = makeAdvanceService();

      await expect(service.advance('sess-1')).rejects.toThrow(
        "Cannot advance vibe session from state 'completed'",
      );
    });
  });

  describe('staged mode - executing (chapter generation)', () => {
    const outlineData = {
      detailedTimeline: [{ time: '1920', event: '案发', involvedCharacters: ['张三'] }],
      characterRelationships: [{ characterA: '张三', characterB: '李四', relationship: '旧友' }],
      trickMechanism: '密室杀人',
      clueChainDesign: [{ clueId: 'c1', description: '血迹', leadsTo: ['c2'] }],
      branchSkeleton: [{ nodeId: 'n1', description: '开场', options: ['调查'], endingDirections: ['真相'] }],
      roundFlowSummary: [{ roundIndex: 0, focus: '调查', keyEvents: ['发现尸体'] }],
    };

    function makeExecutingRow(chapterIndex: number, existingChapters: unknown[] = []) {
      return makeSessionRow({
        state: 'executing',
        outline_output: JSON.stringify({
          phase: 'outline',
          llmOriginal: outlineData,
          edits: [],
          approved: true,
          generatedAt: '2025-01-15T10:00:00.000Z',
        }),
        chapters: JSON.stringify(existingChapters),
        current_chapter_index: chapterIndex,
        total_chapters: 7, // 4 players + 3
      });
    }

    it('generates dm_handbook at index 0', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeExecutingRow(0)], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const chapterContent = { overview: 'DM手册内容' };
      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify(chapterContent),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('chapter_review');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].type).toBe('dm_handbook');
      expect(result.chapters[0].index).toBe(0);
      expect(result.chapters[0].content).toEqual(chapterContent);
    });

    it('generates player_handbook at index 1', async () => {
      const existingChapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];
      mockPool.execute.mockResolvedValueOnce([[makeExecutingRow(1, existingChapters)], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const chapterContent = { characterId: 'p1', characterName: '张三' };
      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify(chapterContent),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('chapter_review');
      expect(result.chapters).toHaveLength(2);
      const playerChapter = result.chapters.find(ch => ch.index === 1);
      expect(playerChapter!.type).toBe('player_handbook');
      expect(playerChapter!.characterId).toBe('player-1');
    });

    it('generates materials at index N+1', async () => {
      // playerCount=4, so materials is at index 5
      mockPool.execute.mockResolvedValueOnce([[makeExecutingRow(5)], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify([{ id: 'm1', type: 'clue_card' }]),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('chapter_review');
      const materialsChapter = result.chapters.find(ch => ch.index === 5);
      expect(materialsChapter!.type).toBe('materials');
    });

    it('generates branch_structure at index N+2', async () => {
      // playerCount=4, so branch_structure is at index 6
      mockPool.execute.mockResolvedValueOnce([[makeExecutingRow(6)], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify({ nodes: [], edges: [], endings: [] }),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('chapter_review');
      const branchChapter = result.chapters.find(ch => ch.index === 6);
      expect(branchChapter!.type).toBe('branch_structure');
    });

    it('transitions to failed when chapter LLM call fails', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeExecutingRow(0)], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockRejectedValue(new Error('LLM error'));

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.advance('sess-1');

      expect(result.state).toBe('failed');
      expect(result.failureInfo!.phase).toBe('chapter');
      expect(result.failureInfo!.error).toBe('LLM error');
      expect(result.failureInfo!.retryFromState).toBe('executing');
    });

    it('throws when outline is missing', async () => {
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'executing' })], []]);

      const { service } = makeAdvanceService();

      await expect(service.advance('sess-1')).rejects.toThrow(
        'Cannot execute chapters without an approved outline',
      );
    });
  });

  it('saves session to DB after advance', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow()], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // checkpoint save (output persisted before state transition)
    mockPool.execute.mockResolvedValueOnce([[], []]); // final save (state transition persisted)

    const llmSend = vi.fn().mockResolvedValue({
      content: VALID_PLAN_JSON,
      tokenUsage: { prompt: 100, completion: 200, total: 300 },
      responseTimeMs: 1000,
    });

    const { service } = makeAdvanceService({ llmSend });
    await service.advance('sess-1');

    // 3 calls: SELECT + checkpoint UPDATE + final UPDATE
    expect(mockPool.execute).toHaveBeenCalledTimes(3);
    // Checkpoint save (output persisted before state transition)
    const [checkpointQuery] = mockPool.execute.mock.calls[1];
    expect(checkpointQuery).toContain('UPDATE authoring_sessions SET');
    // Final save (state transition persisted)
    const [updateQuery] = mockPool.execute.mock.calls[2];
    expect(updateQuery).toContain('UPDATE authoring_sessions SET');
  });
});


// ─── editPhase Tests (Task 6.3) ───

/** Valid ScriptOutline JSON for LLM mock responses */
const VALID_OUTLINE_JSON = JSON.stringify({
  detailedTimeline: [{ time: '1920', event: '案发', involvedCharacters: ['张三'] }],
  characterRelationships: [{ characterA: '张三', characterB: '李四', relationship: '旧友' }],
  trickMechanism: '密室杀人',
  clueChainDesign: [{ clueId: 'c1', description: '血迹', leadsTo: ['c2'] }],
  branchSkeleton: [{ nodeId: 'n1', description: '开场', options: ['调查'], endingDirections: ['真相'] }],
  roundFlowSummary: [{ roundIndex: 0, focus: '调查', keyEvents: ['发现尸体'] }],
});

describe('AuthoringService.editPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  it('saves author edit for plan with original and edited content', async () => {
    const planOutput = {
      phase: 'plan',
      llmOriginal: { worldOverview: 'original world' },
      edits: [],
      approved: false,
      generatedAt: '2025-01-15T10:00:00.000Z',
    };
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
      state: 'plan_review',
      plan_output: JSON.stringify(planOutput),
    })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const editedContent = { worldOverview: 'edited world' };
    const result = await service.editPhase('sess-1', 'plan', editedContent);

    expect(result.planOutput!.authorEdited).toEqual(editedContent);
    expect(result.planOutput!.edits).toHaveLength(1);
    expect(result.planOutput!.edits[0].originalContent).toEqual({ worldOverview: 'original world' });
    expect(result.planOutput!.edits[0].editedContent).toEqual(editedContent);
    expect(result.planOutput!.edits[0].editedAt).toBeInstanceOf(Date);
  });

  it('saves author edit for outline', async () => {
    const outlineOutput = {
      phase: 'outline',
      llmOriginal: { trickMechanism: 'original trick' },
      edits: [],
      approved: false,
      generatedAt: '2025-01-15T10:00:00.000Z',
    };
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
      state: 'design_review',
      outline_output: JSON.stringify(outlineOutput),
    })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const { service } = makeAdvanceService();
    const editedContent = { trickMechanism: 'edited trick' };
    const result = await service.editPhase('sess-1', 'outline', editedContent);

    expect(result.outlineOutput!.authorEdited).toEqual(editedContent);
    expect(result.outlineOutput!.edits).toHaveLength(1);
    expect(result.outlineOutput!.edits[0].originalContent).toEqual({ trickMechanism: 'original trick' });
    expect(result.outlineOutput!.edits[0].editedContent).toEqual(editedContent);
  });

  it('saves author edit for chapter', async () => {
    const chapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'original DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
      state: 'chapter_review',
      chapters: JSON.stringify(chapters),
      current_chapter_index: 0,
    })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const { service } = makeAdvanceService();
    const editedContent = { overview: 'edited DM' };
    const result = await service.editPhase('sess-1', 'chapter', editedContent);

    expect(result.chapters[0].content).toEqual(editedContent);
    expect(result.chapterEdits[0]).toHaveLength(1);
    expect(result.chapterEdits[0][0].originalContent).toEqual({ overview: 'original DM' });
    expect(result.chapterEdits[0][0].editedContent).toEqual(editedContent);
  });

  it('throws for wrong state when editing plan', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.editPhase('sess-1', 'plan', {}))
      .rejects.toThrow("Cannot edit 'plan' phase in state 'draft', expected 'plan_review'");
  });

  it('throws for wrong state when editing outline', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'plan_review' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.editPhase('sess-1', 'outline', {}))
      .rejects.toThrow("Cannot edit 'outline' phase in state 'plan_review', expected 'design_review'");
  });

  it('throws for wrong state when editing chapter', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'executing' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.editPhase('sess-1', 'chapter', {}))
      .rejects.toThrow("Cannot edit 'chapter' phase in state 'executing', expected 'chapter_review'");
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const { service } = makeAdvanceService();

    await expect(service.editPhase('nonexistent', 'plan', {}))
      .rejects.toThrow('Session not found: nonexistent');
  });
});

// ─── approvePhase Tests (Task 6.3) ───

describe('AuthoringService.approvePhase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  describe('approve plan → triggers design generation', () => {
    it('transitions to design_review after successful outline generation', async () => {
      const planOutput = {
        phase: 'plan',
        llmOriginal: JSON.parse(VALID_PLAN_JSON),
        edits: [],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'plan_review',
        plan_output: JSON.stringify(planOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

      const llmSend = vi.fn().mockResolvedValue({
        content: VALID_OUTLINE_JSON,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'plan');

      expect(result.state).toBe('design_review');
      expect(result.planOutput!.approved).toBe(true);
      expect(result.planOutput!.approvedAt).toBeInstanceOf(Date);
      expect(result.outlineOutput).toBeDefined();
      expect(result.outlineOutput!.phase).toBe('outline');
      expect(result.outlineOutput!.approved).toBe(false);
      expect(llmSend).toHaveBeenCalledTimes(1);
    });

    it('stores author notes on plan when provided', async () => {
      const planOutput = {
        phase: 'plan',
        llmOriginal: JSON.parse(VALID_PLAN_JSON),
        edits: [],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'plan_review',
        plan_output: JSON.stringify(planOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: VALID_OUTLINE_JSON,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'plan', '增加更多悬疑元素');

      expect(result.planOutput!.authorNotes).toBe('增加更多悬疑元素');
    });

    it('transitions to failed when outline LLM call fails', async () => {
      const planOutput = {
        phase: 'plan',
        llmOriginal: JSON.parse(VALID_PLAN_JSON),
        edits: [],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'plan_review',
        plan_output: JSON.stringify(planOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockRejectedValue(new Error('LLM timeout'));

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'plan');

      expect(result.state).toBe('failed');
      expect(result.failureInfo!.phase).toBe('outline');
      expect(result.failureInfo!.error).toBe('LLM timeout');
      expect(result.failureInfo!.retryFromState).toBe('designing');
    });

    it('uses author-edited plan content for design prompt', async () => {
      const editedPlan = { ...JSON.parse(VALID_PLAN_JSON), worldOverview: '作者修改后的世界观' };
      const planOutput = {
        phase: 'plan',
        llmOriginal: JSON.parse(VALID_PLAN_JSON),
        authorEdited: editedPlan,
        edits: [{ editedAt: '2025-01-15T11:00:00.000Z', originalContent: JSON.parse(VALID_PLAN_JSON), editedContent: editedPlan }],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'plan_review',
        plan_output: JSON.stringify(planOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: VALID_OUTLINE_JSON,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      await service.approvePhase('sess-1', 'plan');

      // Verify the LLM prompt includes the edited world overview
      const sentRequest = llmSend.mock.calls[0][0];
      expect(sentRequest.prompt).toContain('作者修改后的世界观');
    });
  });

  describe('approve outline → triggers chapter execution', () => {
    it('transitions to chapter_review after first chapter generation', async () => {
      const outlineOutput = {
        phase: 'outline',
        llmOriginal: JSON.parse(VALID_OUTLINE_JSON),
        edits: [],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'design_review',
        outline_output: JSON.stringify(outlineOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const chapterContent = { overview: 'DM手册内容' };
      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify(chapterContent),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'outline');

      expect(result.state).toBe('chapter_review');
      expect(result.totalChapters).toBe(7); // 4 players + 3
      expect(result.currentChapterIndex).toBe(0);
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].type).toBe('dm_handbook');
      expect(result.outlineOutput!.approved).toBe(true);
      expect(result.outlineOutput!.approvedAt).toBeInstanceOf(Date);
    });

    it('stores author notes on outline when provided', async () => {
      const outlineOutput = {
        phase: 'outline',
        llmOriginal: JSON.parse(VALID_OUTLINE_JSON),
        edits: [],
        approved: false,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'design_review',
        outline_output: JSON.stringify(outlineOutput),
      })], []]);
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify({ overview: 'DM' }),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'outline', '注意线索逻辑');

      expect(result.outlineOutput!.authorNotes).toBe('注意线索逻辑');
    });
  });

  describe('approve chapter → parallel batch or completed', () => {
    it('generates player handbooks in parallel after DM handbook approved', async () => {
      const outlineOutput = {
        phase: 'outline',
        llmOriginal: JSON.parse(VALID_OUTLINE_JSON),
        edits: [],
        approved: true,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      const chapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];
      // 1. getSession (approvePhase)
      mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
        state: 'chapter_review',
        outline_output: JSON.stringify(outlineOutput),
        chapters: JSON.stringify(chapters),
        current_chapter_index: 0,
        total_chapters: 7,
      })], []]);
      // 2. saveSession (executing state before parallel gen)
      mockPool.execute.mockResolvedValueOnce([[], []]);
      // 3. saveSession (after parallel gen completes)
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const llmSend = vi.fn().mockResolvedValue({
        content: JSON.stringify({ characterId: 'p1', characterName: '张三' }),
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        responseTimeMs: 1000,
      });

      const { service } = makeAdvanceService({ llmSend });
      const result = await service.approvePhase('sess-1', 'chapter');

      expect(result.state).toBe('chapter_review');
      // 4 player handbooks generated in parallel
      expect(llmSend).toHaveBeenCalledTimes(4);
      expect(result.chapters).toHaveLength(5); // DM + 4 players
      expect(result.parallelBatch).toBeDefined();
      expect(result.parallelBatch!.chapterIndices).toEqual([1, 2, 3, 4]);
      expect(result.parallelBatch!.completedIndices).toHaveLength(4);
    });

    it('transitions to completed when last batch is fully reviewed', async () => {
      const outlineOutput = {
        phase: 'outline',
        llmOriginal: JSON.parse(VALID_OUTLINE_JSON),
        edits: [],
        approved: true,
        generatedAt: '2025-01-15T10:00:00.000Z',
      };
      const chapters = Array.from({ length: 7 }, (_, i) => ({
        index: i,
        type: i === 0 ? 'dm_handbook' : i <= 4 ? 'player_handbook' : i === 5 ? 'materials' : 'branch_structure',
        content: { data: `chapter-${i}` },
        generatedAt: '2025-01-15T10:00:00.000Z',
      }));
      // Last chapter in the final batch (materials+branch), branch_structure already reviewed
      const completedRow = makeSessionRow({
        state: 'chapter_review',
        outline_output: JSON.stringify(outlineOutput),
        chapters: JSON.stringify(chapters),
        current_chapter_index: 5, // materials — last un-reviewed in batch
        total_chapters: 7,
        parallel_batch: JSON.stringify({
          chapterIndices: [5, 6],
          completedIndices: [5, 6],
          failedIndices: [],
          reviewedIndices: [6], // branch_structure already reviewed
        }),
      });
      // 1. getSession (approvePhase)
      mockPool.execute.mockResolvedValueOnce([[completedRow], []]);
      // 2. saveSession (approveChapter sets state to completed)
      mockPool.execute.mockResolvedValueOnce([[], []]);
      // 3. getSession (assembleScript re-fetches)
      mockPool.execute.mockResolvedValueOnce([[{
        ...completedRow,
        state: 'completed',
        parallel_batch: null,
      }], []]);
      // 4. storeScript (INSERT INTO scripts)
      mockPool.execute.mockResolvedValueOnce([[], []]);
      // 5. saveSession (assembleScript saves scriptId)
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const { service } = makeAdvanceService();
      const result = await service.approvePhase('sess-1', 'chapter');

      expect(result.state).toBe('completed');
      expect(result.scriptId).toBeDefined();
    });
  });

  it('throws for wrong state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.approvePhase('sess-1', 'plan'))
      .rejects.toThrow("Cannot approve 'plan' phase in state 'draft', expected 'plan_review'");
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const { service } = makeAdvanceService();

    await expect(service.approvePhase('nonexistent', 'plan'))
      .rejects.toThrow('Session not found: nonexistent');
  });
});

// ─── regenerateChapter Tests (Task 6.4) ───

describe('AuthoringService.regenerateChapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  const outlineData = {
    detailedTimeline: [{ time: '1920', event: '案发', involvedCharacters: ['张三'] }],
    characterRelationships: [{ characterA: '张三', characterB: '李四', relationship: '旧友' }],
    trickMechanism: '密室杀人',
    clueChainDesign: [{ clueId: 'c1', description: '血迹', leadsTo: ['c2'] }],
    branchSkeleton: [{ nodeId: 'n1', description: '开场', options: ['调查'], endingDirections: ['真相'] }],
    roundFlowSummary: [{ roundIndex: 0, focus: '调查', keyEvents: ['发现尸体'] }],
  };

  function makeChapterReviewRow(chapterIndex: number, chapters: unknown[], chapterEdits: Record<string, unknown> = {}) {
    return makeSessionRow({
      state: 'chapter_review',
      outline_output: JSON.stringify({
        phase: 'outline',
        llmOriginal: outlineData,
        edits: [],
        approved: true,
        generatedAt: '2025-01-15T10:00:00.000Z',
      }),
      chapters: JSON.stringify(chapters),
      chapter_edits: JSON.stringify(chapterEdits),
      current_chapter_index: chapterIndex,
      total_chapters: 7,
    });
  }

  it('regenerates chapter and preserves previous version in chapterEdits', async () => {
    const originalContent = { overview: 'Original DM handbook content' };
    const chapters = [{ index: 0, type: 'dm_handbook', content: originalContent, generatedAt: '2025-01-15T10:00:00.000Z' }];

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(0, chapters)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const newContent = { overview: 'Regenerated DM handbook content' };
    const llmSend = vi.fn().mockResolvedValue({
      content: JSON.stringify(newContent),
      tokenUsage: { prompt: 100, completion: 200, total: 300 },
      responseTimeMs: 1000,
    });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.regenerateChapter('sess-1', 0);

    // Should be back in chapter_review after regeneration
    expect(result.state).toBe('chapter_review');

    // New content should replace the old chapter
    expect(result.chapters[0].content).toEqual(newContent);

    // Previous version should be preserved in chapterEdits
    expect(result.chapterEdits[0]).toHaveLength(1);
    expect(result.chapterEdits[0][0].originalContent).toEqual(originalContent);
    expect(result.chapterEdits[0][0].editedAt).toBeInstanceOf(Date);

    // LLM should have been called
    expect(llmSend).toHaveBeenCalledTimes(1);
  });

  it('accumulates history across multiple regenerations', async () => {
    const firstContent = { overview: 'First version' };
    const secondContent = { overview: 'Second version' };
    const chapters = [{ index: 0, type: 'dm_handbook', content: secondContent, generatedAt: '2025-01-15T10:00:00.000Z' }];
    const existingEdits = {
      0: [{ editedAt: '2025-01-15T10:30:00.000Z', originalContent: firstContent, editedContent: firstContent }],
    };

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(0, chapters, existingEdits)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const thirdContent = { overview: 'Third version' };
    const llmSend = vi.fn().mockResolvedValue({
      content: JSON.stringify(thirdContent),
      tokenUsage: { prompt: 100, completion: 200, total: 300 },
      responseTimeMs: 1000,
    });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.regenerateChapter('sess-1', 0);

    // Should have 2 history entries now
    expect(result.chapterEdits[0]).toHaveLength(2);
    expect(result.chapterEdits[0][0].originalContent).toEqual(firstContent);
    expect(result.chapterEdits[0][1].originalContent).toEqual(secondContent);

    // Current chapter should have the new content
    expect(result.chapters[0].content).toEqual(thirdContent);
  });

  it('regenerates player_handbook chapter correctly', async () => {
    const originalContent = { characterName: '张三', background: 'original' };
    const chapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
      { index: 1, type: 'player_handbook', content: originalContent, characterId: 'player-1', generatedAt: '2025-01-15T10:00:00.000Z' },
    ];

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(1, chapters)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const newContent = { characterName: '张三', background: 'regenerated' };
    const llmSend = vi.fn().mockResolvedValue({
      content: JSON.stringify(newContent),
      tokenUsage: { prompt: 100, completion: 200, total: 300 },
      responseTimeMs: 1000,
    });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.regenerateChapter('sess-1', 1);

    expect(result.state).toBe('chapter_review');
    const playerChapter = result.chapters.find(ch => ch.index === 1);
    expect(playerChapter!.content).toEqual(newContent);
    expect(playerChapter!.type).toBe('player_handbook');
    expect(playerChapter!.characterId).toBe('player-1');

    // History preserved
    expect(result.chapterEdits[1]).toHaveLength(1);
    expect(result.chapterEdits[1][0].originalContent).toEqual(originalContent);
  });

  it('transitions to failed when LLM call fails during regeneration', async () => {
    const chapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(0, chapters)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const llmSend = vi.fn().mockRejectedValue(new Error('LLM timeout'));

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.regenerateChapter('sess-1', 0);

    expect(result.state).toBe('failed');
    expect(result.failureInfo).toBeDefined();
    expect(result.failureInfo!.phase).toBe('chapter');
    expect(result.failureInfo!.error).toBe('LLM timeout');
    expect(result.failureInfo!.retryFromState).toBe('executing');

    // History should still be preserved even though regeneration failed
    expect(result.chapterEdits[0]).toHaveLength(1);
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]); // getSession returns empty

    const { service } = makeAdvanceService();

    await expect(service.regenerateChapter('nonexistent', 0))
      .rejects.toThrow('Session not found: nonexistent');
  });

  it('throws when session is not in chapter_review state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.regenerateChapter('sess-1', 0))
      .rejects.toThrow("Cannot regenerate chapter in state 'draft', expected 'chapter_review'");
  });

  it('throws when chapterIndex does not match currentChapterIndex', async () => {
    const chapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(0, chapters)], []]);

    const { service } = makeAdvanceService();

    await expect(service.regenerateChapter('sess-1', 3))
      .rejects.toThrow('Cannot regenerate chapter 3, current chapter is 0');
  });

  it('saves session to DB after regeneration', async () => {
    const chapters = [{ index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' }];

    mockPool.execute.mockResolvedValueOnce([[makeChapterReviewRow(0, chapters)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // checkpoint save (output persisted before state transition)
    mockPool.execute.mockResolvedValueOnce([[], []]); // final save (state transition persisted)

    const llmSend = vi.fn().mockResolvedValue({
      content: JSON.stringify({ overview: 'New DM' }),
      tokenUsage: { prompt: 100, completion: 200, total: 300 },
      responseTimeMs: 1000,
    });

    const { service } = makeAdvanceService({ llmSend });
    await service.regenerateChapter('sess-1', 0);

    // 3 calls: SELECT + checkpoint UPDATE + final UPDATE
    expect(mockPool.execute).toHaveBeenCalledTimes(3);
    // Checkpoint save (output persisted before state transition)
    const [checkpointQuery] = mockPool.execute.mock.calls[1];
    expect(checkpointQuery).toContain('UPDATE authoring_sessions SET');
    // Final save (state transition persisted)
    const [updateQuery] = mockPool.execute.mock.calls[2];
    expect(updateQuery).toContain('UPDATE authoring_sessions SET');
  });
});

// ─── retry Tests (Task 6.5) ───

describe('AuthoringService.retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  function makeFailedRow(retryFromState: string, phase: string, mode = 'staged') {
    return makeSessionRow({
      mode,
      state: 'failed',
      failure_info: JSON.stringify({
        phase,
        error: 'LLM timeout',
        failedAt: '2025-01-15T10:00:00.000Z',
        retryFromState,
      }),
    });
  }

  it('restores state to planning when retryFromState is planning', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('planning', 'plan')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.retry('sess-1');

    expect(result.state).toBe('planning');
    expect(result.failureInfo).toBeUndefined();
  });

  it('restores state to designing when retryFromState is designing', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('designing', 'outline')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.retry('sess-1');

    expect(result.state).toBe('designing');
    expect(result.failureInfo).toBeUndefined();
  });

  it('restores state to executing when retryFromState is executing', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('executing', 'chapter')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.retry('sess-1');

    expect(result.state).toBe('executing');
    expect(result.failureInfo).toBeUndefined();
  });

  it('restores state to generating for vibe mode failures', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('generating', 'generating', 'vibe')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.retry('sess-1');

    expect(result.state).toBe('generating');
    expect(result.failureInfo).toBeUndefined();
  });

  it('clears failureInfo after successful retry', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('planning', 'plan')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.retry('sess-1');

    expect(result.failureInfo).toBeUndefined();
  });

  it('saves session to DB after retry', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeFailedRow('planning', 'plan')], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.retry('sess-1');

    expect(mockPool.execute).toHaveBeenCalledTimes(2);
    const [updateQuery] = mockPool.execute.mock.calls[1];
    expect(updateQuery).toContain('UPDATE authoring_sessions SET');
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]); // getSession returns empty

    const { service } = makeAdvanceService();

    await expect(service.retry('nonexistent'))
      .rejects.toThrow('Session not found: nonexistent');
  });

  it('throws when session is not in failed state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.retry('sess-1'))
      .rejects.toThrow("Cannot retry session in state 'draft', expected 'failed'");
  });

  it('throws when no failure info is recorded', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'failed', failure_info: null })], []]);

    const { service } = makeAdvanceService();

    await expect(service.retry('sess-1'))
      .rejects.toThrow('Cannot retry: no failure info recorded');
  });
});

// ─── assembleScript Tests (Task 6.6) ───

describe('AuthoringService.assembleScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  const dmContent = {
    overview: 'DM overview',
    characters: [],
    timeline: [],
    clueDistribution: [],
    roundGuides: [],
    branchDecisionPoints: [],
    endings: [],
    truthReveal: 'The truth',
    judgingRules: { winConditions: 'Find killer', scoringCriteria: 'Points' },
  };

  const playerContent = (idx: number) => ({
    characterId: `player-${idx}`,
    characterName: `Player ${idx}`,
    backgroundStory: 'Story',
    primaryGoal: 'Goal',
    secondaryGoals: [],
    relationships: [],
    knownClues: [],
    roundActions: [],
    secrets: [],
  });

  const materialsContent = [
    { id: 'mat-1', type: 'clue_card', content: 'A clue', metadata: {} },
  ];

  const branchContent = {
    nodes: [],
    edges: [],
    endings: [],
  };

  function makeCompletedRow(chapters: unknown[], chapterEdits: Record<string, unknown> = {}) {
    return makeSessionRow({
      state: 'completed',
      chapters: JSON.stringify(chapters),
      chapter_edits: JSON.stringify(chapterEdits),
      current_chapter_index: 6,
      total_chapters: 7,
    });
  }

  function allChapters() {
    return [
      { index: 0, type: 'dm_handbook', content: dmContent, generatedAt: '2025-01-15T10:00:00.000Z' },
      { index: 1, type: 'player_handbook', characterId: 'player-1', content: playerContent(1), generatedAt: '2025-01-15T10:01:00.000Z' },
      { index: 2, type: 'player_handbook', characterId: 'player-2', content: playerContent(2), generatedAt: '2025-01-15T10:02:00.000Z' },
      { index: 3, type: 'player_handbook', characterId: 'player-3', content: playerContent(3), generatedAt: '2025-01-15T10:03:00.000Z' },
      { index: 4, type: 'player_handbook', characterId: 'player-4', content: playerContent(4), generatedAt: '2025-01-15T10:04:00.000Z' },
      { index: 5, type: 'materials', content: materialsContent, generatedAt: '2025-01-15T10:05:00.000Z' },
      { index: 6, type: 'branch_structure', content: branchContent, generatedAt: '2025-01-15T10:06:00.000Z' },
    ];
  }

  it('assembles all chapters into a Script and stores it', async () => {
    const chapters = allChapters();
    // getSession
    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(chapters)], []]);
    // storeScript (INSERT INTO scripts)
    mockPool.execute.mockResolvedValueOnce([[], []]);
    // saveSession (UPDATE authoring_sessions)
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const { service } = makeAdvanceService();
    const result = await service.assembleScript('sess-1');

    expect(result.scriptId).toBeDefined();
    expect(result.scriptId).not.toBeNull();

    // Verify storeScript was called
    const storeCall = mockPool.execute.mock.calls[1];
    expect(storeCall[0]).toContain('INSERT INTO scripts');
    const scriptContent = JSON.parse(storeCall[1][5] as string);
    expect(scriptContent.dmHandbook).toEqual(dmContent);
    expect(scriptContent.playerHandbooks).toHaveLength(4);
    expect(scriptContent.materials).toEqual(materialsContent);
    expect(scriptContent.branchStructure).toEqual(branchContent);
    expect(scriptContent.configId).toBe('cfg-1');
    expect(scriptContent.version).toBe('v1.0');
    expect(scriptContent.status).toBe('ready');
    expect(scriptContent.tags).toEqual([]);
  });

  it('uses author-edited content when available', async () => {
    const chapters = allChapters();
    const editedDm = { ...dmContent, overview: 'Edited DM overview' };
    const chapterEdits = {
      0: [{ editedAt: '2025-01-15T11:00:00.000Z', originalContent: dmContent, editedContent: editedDm }],
    };

    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(chapters, chapterEdits)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // storeScript
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.assembleScript('sess-1');

    expect(result.scriptId).toBeDefined();
    const storeCall = mockPool.execute.mock.calls[1];
    const scriptContent = JSON.parse(storeCall[1][5] as string);
    expect(scriptContent.dmHandbook.overview).toBe('Edited DM overview');
  });

  it('uses the most recent edit when multiple edits exist', async () => {
    const chapters = allChapters();
    const firstEdit = { ...dmContent, overview: 'First edit' };
    const secondEdit = { ...dmContent, overview: 'Second edit' };
    const chapterEdits = {
      0: [
        { editedAt: '2025-01-15T11:00:00.000Z', originalContent: dmContent, editedContent: firstEdit },
        { editedAt: '2025-01-15T12:00:00.000Z', originalContent: firstEdit, editedContent: secondEdit },
      ],
    };

    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(chapters, chapterEdits)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // storeScript
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.assembleScript('sess-1');

    const storeCall = mockPool.execute.mock.calls[1];
    const scriptContent = JSON.parse(storeCall[1][5] as string);
    expect(scriptContent.dmHandbook.overview).toBe('Second edit');
  });

  it('generates a Script with title from config theme and era', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(allChapters())], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // storeScript
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.assembleScript('sess-1');

    const storeCall = mockPool.execute.mock.calls[1];
    const scriptContent = JSON.parse(storeCall[1][5] as string);
    expect(scriptContent.title).toBe('悬疑推理 - 民国');
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]); // getSession returns empty

    const { service } = makeAdvanceService();
    await expect(service.assembleScript('nonexistent'))
      .rejects.toThrow('Session not found: nonexistent');
  });

  it('throws when session is not in completed state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'executing' })], []]);

    const { service } = makeAdvanceService();
    await expect(service.assembleScript('sess-1'))
      .rejects.toThrow("Cannot assemble script: session is in state 'executing', expected 'completed'");
  });

  it('throws when no chapters found', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow([])], []]);

    const { service } = makeAdvanceService();
    await expect(service.assembleScript('sess-1'))
      .rejects.toThrow('Cannot assemble script: no chapters found');
  });

  it('saves the scriptId on the session', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(allChapters())], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // storeScript
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.assembleScript('sess-1');

    // saveSession should have been called with the scriptId set
    const saveCall = mockPool.execute.mock.calls[2];
    expect(saveCall[0]).toContain('UPDATE authoring_sessions SET');
    expect(saveCall[1][10]).toBe(result.scriptId); // script_id param (after parallel_batch)
  });

  it('handles chapters in non-sequential order', async () => {
    // Chapters stored out of order
    const chapters = [
      { index: 6, type: 'branch_structure', content: branchContent, generatedAt: '2025-01-15T10:06:00.000Z' },
      { index: 0, type: 'dm_handbook', content: dmContent, generatedAt: '2025-01-15T10:00:00.000Z' },
      { index: 3, type: 'player_handbook', characterId: 'player-3', content: playerContent(3), generatedAt: '2025-01-15T10:03:00.000Z' },
      { index: 5, type: 'materials', content: materialsContent, generatedAt: '2025-01-15T10:05:00.000Z' },
      { index: 1, type: 'player_handbook', characterId: 'player-1', content: playerContent(1), generatedAt: '2025-01-15T10:01:00.000Z' },
      { index: 2, type: 'player_handbook', characterId: 'player-2', content: playerContent(2), generatedAt: '2025-01-15T10:02:00.000Z' },
      { index: 4, type: 'player_handbook', characterId: 'player-4', content: playerContent(4), generatedAt: '2025-01-15T10:04:00.000Z' },
    ];

    mockPool.execute.mockResolvedValueOnce([[makeCompletedRow(chapters)], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // storeScript
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.assembleScript('sess-1');

    const storeCall = mockPool.execute.mock.calls[1];
    const scriptContent = JSON.parse(storeCall[1][5] as string);
    // Player handbooks should be in order by index
    expect(scriptContent.playerHandbooks[0].characterName).toBe('Player 1');
    expect(scriptContent.playerHandbooks[1].characterName).toBe('Player 2');
    expect(scriptContent.playerHandbooks[2].characterName).toBe('Player 3');
    expect(scriptContent.playerHandbooks[3].characterName).toBe('Player 4');
  });
});

// ─── updateAiConfig Tests (Task 4.2) ───

describe('AuthoringService.updateAiConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  const ephemeralConfig = {
    provider: 'anthropic',
    apiKey: 'sk-new-key',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-sonnet',
  };

  it('updates AI config when session is in failed state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'failed', failure_info: JSON.stringify({ phase: 'plan', error: 'timeout', failedAt: '2025-01-15T10:00:00.000Z', retryFromState: 'planning' }) })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(result.aiConfigMeta).toEqual({ provider: 'anthropic', model: 'claude-3-sonnet' });
  });

  it('updates AI config when session is in plan_review state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'plan_review' })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(result.aiConfigMeta).toEqual({ provider: 'anthropic', model: 'claude-3-sonnet' });
  });

  it('updates AI config when session is in design_review state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'design_review' })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(result.aiConfigMeta).toEqual({ provider: 'anthropic', model: 'claude-3-sonnet' });
  });

  it('updates AI config when session is in chapter_review state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'chapter_review' })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(result.aiConfigMeta).toEqual({ provider: 'anthropic', model: 'claude-3-sonnet' });
  });

  it('updates AI config when session is in draft state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    const result = await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(result.aiConfigMeta).toEqual({ provider: 'anthropic', model: 'claude-3-sonnet' });
  });

  it('saves session to DB after updating config', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'failed', failure_info: JSON.stringify({ phase: 'plan', error: 'timeout', failedAt: '2025-01-15T10:00:00.000Z', retryFromState: 'planning' }) })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.updateAiConfig('sess-1', ephemeralConfig);

    expect(mockPool.execute).toHaveBeenCalledTimes(2);
    const [updateQuery] = mockPool.execute.mock.calls[1];
    expect(updateQuery).toContain('UPDATE authoring_sessions SET');
  });

  it('replaces session adapter so subsequent calls use new config', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);
    mockPool.execute.mockResolvedValueOnce([[], []]); // saveSession

    const { service } = makeAdvanceService();
    await service.updateAiConfig('sess-1', ephemeralConfig);

    const adapter = service.getAdapterForSession('sess-1');
    expect(adapter).toBeDefined();
    expect(adapter.getProviderName()).toBe('anthropic');
  });

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]); // getSession returns empty

    const { service } = makeAdvanceService();

    await expect(service.updateAiConfig('nonexistent', ephemeralConfig))
      .rejects.toThrow('Session not found: nonexistent');
  });

  it('throws when session is in planning state (not updatable)', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'planning' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.updateAiConfig('sess-1', ephemeralConfig))
      .rejects.toThrow("Cannot update AI config in state 'planning'");
  });

  it('throws when session is in designing state (not updatable)', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'designing' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.updateAiConfig('sess-1', ephemeralConfig))
      .rejects.toThrow("Cannot update AI config in state 'designing'");
  });

  it('throws when session is in executing state (not updatable)', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'executing' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.updateAiConfig('sess-1', ephemeralConfig))
      .rejects.toThrow("Cannot update AI config in state 'executing'");
  });

  it('throws when session is in completed state (not updatable)', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'completed' })], []]);

    const { service } = makeAdvanceService();

    await expect(service.updateAiConfig('sess-1', ephemeralConfig))
      .rejects.toThrow("Cannot update AI config in state 'completed'");
  });
});

// ─── retryFailedChapters Tests (Task 5.1) ───

describe('AuthoringService.retryFailedChapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  const outlineOutput = {
    phase: 'outline',
    llmOriginal: JSON.parse(VALID_OUTLINE_JSON),
    edits: [],
    approved: true,
    generatedAt: '2025-01-15T10:00:00.000Z',
  };

  function makeChapterReviewWithFailures(failedIndices: number[], completedIndices: number[], chapters: unknown[]) {
    return makeSessionRow({
      state: 'chapter_review',
      outline_output: JSON.stringify(outlineOutput),
      chapters: JSON.stringify(chapters),
      current_chapter_index: completedIndices[0] ?? 0,
      total_chapters: 7,
      parallel_batch: JSON.stringify({
        chapterIndices: [...completedIndices, ...failedIndices],
        completedIndices,
        failedIndices,
        reviewedIndices: [],
      }),
    });
  }

  it('throws when session not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[], []]);
    const { service } = makeAdvanceService();

    await expect(service.retryFailedChapters('nonexistent'))
      .rejects.toThrow('Session not found: nonexistent');
  });

  it('throws when session is not in chapter_review state', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({ state: 'draft' })], []]);
    const { service } = makeAdvanceService();

    await expect(service.retryFailedChapters('sess-1'))
      .rejects.toThrow("Cannot retry failed chapters in state 'draft', expected 'chapter_review'");
  });

  it('throws when no parallelBatch exists', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
      state: 'chapter_review',
      parallel_batch: null,
    })], []]);
    const { service } = makeAdvanceService();

    await expect(service.retryFailedChapters('sess-1'))
      .rejects.toThrow('No failed chapters to retry');
  });

  it('throws when failedIndices is empty', async () => {
    mockPool.execute.mockResolvedValueOnce([[makeSessionRow({
      state: 'chapter_review',
      parallel_batch: JSON.stringify({
        chapterIndices: [1, 2],
        completedIndices: [1, 2],
        failedIndices: [],
        reviewedIndices: [],
      }),
    })], []]);
    const { service } = makeAdvanceService();

    await expect(service.retryFailedChapters('sess-1'))
      .rejects.toThrow('No failed chapters to retry');
  });

  it('retries failed chapters and merges successful ones', async () => {
    const existingChapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
      { index: 1, type: 'player_handbook', content: { characterId: 'p1' }, generatedAt: '2025-01-15T10:00:00.000Z' },
    ];
    // Chapters 2 and 3 failed
    const row = makeChapterReviewWithFailures([2, 3], [0, 1], existingChapters);
    // 1. getSession
    mockPool.execute.mockResolvedValueOnce([[row], []]);
    // 2. saveSession
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const llmSend = vi.fn().mockResolvedValue({
      content: JSON.stringify({ characterId: 'retried', characterName: '重试角色' }),
      tokenUsage: { prompt: 50, completion: 100, total: 150 },
      responseTimeMs: 500,
    });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.retryFailedChapters('sess-1');

    expect(result.state).toBe('chapter_review');
    expect(result.chapters).toHaveLength(4); // 2 existing + 2 retried
    expect(result.parallelBatch!.failedIndices).toEqual([]);
    expect(result.parallelBatch!.completedIndices).toContain(2);
    expect(result.parallelBatch!.completedIndices).toContain(3);
    expect(llmSend).toHaveBeenCalledTimes(2);
  });

  it('transitions to failed when all retries fail again', async () => {
    const existingChapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
      { index: 1, type: 'player_handbook', content: { characterId: 'p1' }, generatedAt: '2025-01-15T10:00:00.000Z' },
    ];
    const row = makeChapterReviewWithFailures([2, 3], [0, 1], existingChapters);
    // 1. getSession
    mockPool.execute.mockResolvedValueOnce([[row], []]);
    // 2. saveSession
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const llmSend = vi.fn().mockRejectedValue(new Error('LLM timeout'));

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.retryFailedChapters('sess-1');

    expect(result.state).toBe('failed');
    expect(result.failureInfo).toBeDefined();
    expect(result.failureInfo!.phase).toBe('chapter');
    expect(result.failureInfo!.error).toContain('All retry chapters failed');
    // Existing successful chapters are preserved
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].index).toBe(0);
    expect(result.chapters[1].index).toBe(1);
  });

  it('handles partial retry success — keeps still-failed in failedIndices', async () => {
    const existingChapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
    ];
    const row = makeChapterReviewWithFailures([1, 2, 3], [0], existingChapters);
    // 1. getSession
    mockPool.execute.mockResolvedValueOnce([[row], []]);
    // 2. saveSession
    mockPool.execute.mockResolvedValueOnce([[], []]);

    // Chapter 1 succeeds, chapter 2 fails, chapter 3 succeeds
    const llmSend = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({ characterId: 'p1', characterName: '角色1' }),
        tokenUsage: { prompt: 50, completion: 100, total: 150 },
        responseTimeMs: 500,
      })
      .mockRejectedValueOnce(new Error('LLM error'))
      .mockResolvedValueOnce({
        content: JSON.stringify({ characterId: 'p3', characterName: '角色3' }),
        tokenUsage: { prompt: 60, completion: 110, total: 170 },
        responseTimeMs: 600,
      });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.retryFailedChapters('sess-1');

    expect(result.state).toBe('chapter_review');
    expect(result.chapters).toHaveLength(3); // 1 existing + 2 retried
    expect(result.parallelBatch!.failedIndices).toEqual([2]);
    expect(result.parallelBatch!.completedIndices).toContain(1);
    expect(result.parallelBatch!.completedIndices).toContain(3);
  });

  it('sums token usage from successful retries into lastStepTokens', async () => {
    const existingChapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
    ];
    const row = makeChapterReviewWithFailures([1, 2], [0], existingChapters);
    // 1. getSession
    mockPool.execute.mockResolvedValueOnce([[row], []]);
    // 2. saveSession
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const llmSend = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({ characterId: 'p1', characterName: '角色1' }),
        tokenUsage: { prompt: 50, completion: 100, total: 150 },
        responseTimeMs: 500,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ characterId: 'p2', characterName: '角色2' }),
        tokenUsage: { prompt: 70, completion: 130, total: 200 },
        responseTimeMs: 600,
      });

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.retryFailedChapters('sess-1');

    expect(result.lastStepTokens).toEqual({
      prompt: 120,
      completion: 230,
      total: 350,
    });
  });

  it('does not update lastStepTokens when all retries fail', async () => {
    const existingChapters = [
      { index: 0, type: 'dm_handbook', content: { overview: 'DM' }, generatedAt: '2025-01-15T10:00:00.000Z' },
    ];
    const row = makeChapterReviewWithFailures([1], [0], existingChapters);
    // Set previous lastStepTokens
    (row as Record<string, unknown>).last_step_tokens = JSON.stringify({ prompt: 10, completion: 20, total: 30 });
    // 1. getSession
    mockPool.execute.mockResolvedValueOnce([[row], []]);
    // 2. saveSession
    mockPool.execute.mockResolvedValueOnce([[], []]);

    const llmSend = vi.fn().mockRejectedValue(new Error('LLM error'));

    const { service } = makeAdvanceService({ llmSend });
    const result = await service.retryFailedChapters('sess-1');

    // lastStepTokens should remain unchanged from before
    expect(result.lastStepTokens).toEqual({ prompt: 10, completion: 20, total: 30 });
  });
});
