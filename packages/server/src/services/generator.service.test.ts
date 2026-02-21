import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneratorService, GenerateJob } from './generator.service';
import { SkillService } from './skill.service';
import {
  ScriptConfig,
  GameType,
  AgeGroup,
  ScriptStatus,
  MaterialType,
  Script,
  DMHandbook,
  PlayerHandbook,
  Material,
  BranchStructure,
  AggregatedFeedback,
  LLMResponse,
  SkillTemplate,
  SkillCategory,
  SettingType,
  LLMError,
  CharacterDraft,
} from '@gdgeek/murder-mystery-shared';
import { ILLMAdapter } from '../adapters/llm-adapter.interface';

// ─── Mock Redis ───
const mockRedisStore = new Map<string, string>();
vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { mockRedisStore.set(key, value); }),
    del: vi.fn(async (key: string) => { mockRedisStore.delete(key); }),
  },
}));

// ─── Helpers ───

function makeConfig(overrides: Partial<ScriptConfig> = {}): ScriptConfig {
  return {
    id: 'cfg-1',
    playerCount: 4,
    durationHours: 3,
    gameType: GameType.HONKAKU,
    ageGroup: AgeGroup.ADULT,
    restorationRatio: 60,
    deductionRatio: 40,
    era: '民国',
    location: '上海',
    theme: '悬疑推理',
    language: 'zh',
    roundStructure: { rounds: [], totalRounds: 3, summaryMinutes: 30, finalVoteMinutes: 10, revealMinutes: 10 },
    ...overrides,
  };
}

function makeMockLLM(content: string): ILLMAdapter {
  return {
    send: async () => ({ content, tokenUsage: { prompt: 10, completion: 20, total: 30 }, responseTimeMs: 100 }),
    getProviderName: () => 'mock',
    getDefaultModel: () => 'mock-model',
    validateApiKey: () => {},
  };
}

function makeValidScriptJSON(playerCount = 4): string {
  const playerHandbooks: PlayerHandbook[] = Array.from({ length: playerCount }, (_, i) => ({
    characterId: `char-${i}`,
    characterName: `角色${i}`,
    backgroundStory: `背景${i}`,
    primaryGoal: '找出真相',
    secondaryGoals: ['次要目标'],
    relationships: [],
    knownClues: [],
    roundActions: [],
    secrets: [`秘密${i}`],
  }));

  const materials: Material[] = [
    { id: 'mat-1', type: MaterialType.CLUE_CARD, content: '线索1', clueId: 'clue-1', associatedCharacterId: 'char-0', metadata: {} } as Material & { clueId: string },
    { id: 'mat-2', type: MaterialType.CLUE_CARD, content: '线索2', clueId: 'clue-2', associatedCharacterId: 'char-1', metadata: {} } as Material & { clueId: string },
  ];

  const dmHandbook: DMHandbook = {
    overview: '概述',
    characters: [],
    timeline: [],
    clueDistribution: [
      { clueId: 'clue-1', roundIndex: 0, targetCharacterId: 'char-0', condition: '', timing: '' },
      { clueId: 'clue-2', roundIndex: 1, targetCharacterId: 'char-1', condition: '', timing: '' },
    ],
    roundGuides: [],
    branchDecisionPoints: [],
    endings: [{ endingId: 'end-1', name: '结局1', triggerConditions: '', narrative: '', playerEndingSummaries: [] }],
    truthReveal: '真相',
    judgingRules: { winConditions: '', scoringCriteria: '' },
  };

  const branchStructure: BranchStructure = {
    nodes: [{ id: 'node-1', roundIndex: 0, description: '', voteQuestion: '投票', options: [{ id: 'opt-1', text: '选项A', nextNodeId: null, endingId: 'end-1' }] }],
    edges: [],
    endings: [{ id: 'end-1', name: '结局1', triggerConditions: [], narrative: '', playerEndings: [] }],
  };

  return JSON.stringify({ title: '测试剧本', dmHandbook, playerHandbooks, materials, branchStructure });
}

// ─── Tests ───

describe('GeneratorService.buildSystemPrompt', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('includes language instruction for zh', () => {
    const prompt = service.buildSystemPrompt(makeConfig({ language: 'zh' }));
    expect(prompt).toContain('中文');
  });

  it('includes language instruction for non-zh', () => {
    const prompt = service.buildSystemPrompt(makeConfig({ language: 'en' }));
    expect(prompt).toContain('en');
  });

  it('includes special setting instructions for shin_honkaku', () => {
    const config = makeConfig({
      gameType: GameType.SHIN_HONKAKU,
      specialSetting: { settingTypes: [], settingDescription: '飞行能力', settingConstraints: '每次不超过5分钟' },
    });
    const prompt = service.buildSystemPrompt(config);
    expect(prompt).toContain('飞行能力');
    expect(prompt).toContain('每次不超过5分钟');
    expect(prompt).toContain('新本格');
  });
});

describe('GeneratorService.buildUserPrompt', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('includes config parameters', () => {
    const prompt = service.buildUserPrompt(makeConfig(), []);
    expect(prompt).toContain('4'); // playerCount
    expect(prompt).toContain('民国');
    expect(prompt).toContain('上海');
  });

  it('includes feedback low-score dimensions', () => {
    const feedback: AggregatedFeedback = {
      scriptId: 's1',
      totalReviews: 10,
      dimensions: [
        { dimension: '推理难度', averageScore: 4.5, count: 10 },
        { dimension: '角色深度', averageScore: 7.0, count: 10 },
      ],
      frequentSuggestions: ['增加线索'],
    };
    const prompt = service.buildUserPrompt(makeConfig(), [], feedback);
    expect(prompt).toContain('推理难度');
    expect(prompt).toContain('4.5');
    expect(prompt).toContain('增加线索');
    // Should NOT include high-score dimension as optimization target
    expect(prompt).not.toContain('角色深度(平均');
  });
});

describe('GeneratorService.parseGeneratedContent', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('parses valid JSON', () => {
    const json = makeValidScriptJSON();
    const result = service.parseGeneratedContent(json);
    expect(result.title).toBe('测试剧本');
    expect(result.playerHandbooks).toHaveLength(4);
  });

  it('parses JSON wrapped in markdown fences', () => {
    const json = '```json\n' + makeValidScriptJSON() + '\n```';
    const result = service.parseGeneratedContent(json);
    expect(result.title).toBe('测试剧本');
  });

  it('throws on invalid JSON', () => {
    expect(() => service.parseGeneratedContent('not json')).toThrow();
  });
});

describe('GeneratorService.validateGenerated', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('passes for valid content', () => {
    const parsed = JSON.parse(makeValidScriptJSON());
    expect(() => service.validateGenerated(parsed, makeConfig())).not.toThrow();
  });

  it('logs warning when player handbook count mismatches', () => {
    const parsed = JSON.parse(makeValidScriptJSON(3)); // 3 handbooks but config says 4
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => service.validateGenerated(parsed, makeConfig({ playerCount: 4 }))).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Player handbook count mismatch'));
    warnSpy.mockRestore();
  });

  it('logs warning when clue in distribution but not in materials', () => {
    const parsed = JSON.parse(makeValidScriptJSON());
    parsed.dmHandbook.clueDistribution.push({ clueId: 'missing-clue', roundIndex: 0, targetCharacterId: 'char-0', condition: '', timing: '' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => service.validateGenerated(parsed, makeConfig())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing-clue'));
    warnSpy.mockRestore();
  });
});

describe('GeneratorService.validateBranchReachability', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('passes when all paths reach an ending', () => {
    const branch: BranchStructure = {
      nodes: [{ id: 'n1', roundIndex: 0, description: '', voteQuestion: '', options: [{ id: 'o1', text: '', nextNodeId: null, endingId: 'e1' }] }],
      edges: [],
      endings: [{ id: 'e1', name: '', triggerConditions: [], narrative: '', playerEndings: [] }],
    };
    expect(() => service.validateBranchReachability(branch)).not.toThrow();
  });

  it('throws when no path reaches an ending', () => {
    const branch: BranchStructure = {
      nodes: [{ id: 'n1', roundIndex: 0, description: '', voteQuestion: '', options: [{ id: 'o1', text: '', nextNodeId: 'n2', endingId: null }] },
              { id: 'n2', roundIndex: 1, description: '', voteQuestion: '', options: [] }],
      edges: [],
      endings: [{ id: 'e1', name: '', triggerConditions: [], narrative: '', playerEndings: [] }],
    };
    expect(() => service.validateBranchReachability(branch)).toThrow('unreachable');
  });

  it('passes for empty branch', () => {
    expect(() => service.validateBranchReachability({ nodes: [], edges: [], endings: [] })).not.toThrow();
  });
});

describe('GeneratorService.serializeScript / deserializeScript', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('round-trips a script correctly', () => {
    const script: Script = {
      id: 's1',
      version: 'v1.0',
      configId: 'cfg-1',
      config: makeConfig(),
      title: '测试',
      dmHandbook: JSON.parse(makeValidScriptJSON()).dmHandbook,
      playerHandbooks: JSON.parse(makeValidScriptJSON()).playerHandbooks,
      materials: JSON.parse(makeValidScriptJSON()).materials,
      branchStructure: JSON.parse(makeValidScriptJSON()).branchStructure,
      tags: [],
      status: ScriptStatus.READY,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    };

    const json = service.serializeScript(script);
    const restored = service.deserializeScript(json);

    expect(restored.id).toBe(script.id);
    expect(restored.version).toBe(script.version);
    expect(restored.playerHandbooks).toHaveLength(script.playerHandbooks.length);
    expect(restored.createdAt).toEqual(script.createdAt);
    expect(restored.updatedAt).toEqual(script.updatedAt);
  });
});


describe('GeneratorService.incrementVersion', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('increments v1.0 to v1.1', () => {
    expect(service.incrementVersion('v1.0')).toBe('v1.1');
  });

  it('increments v1.9 to v1.10', () => {
    expect(service.incrementVersion('v1.9')).toBe('v1.10');
  });

  it('increments v2.3 to v2.4', () => {
    expect(service.incrementVersion('v2.3')).toBe('v2.4');
  });

  it('returns v1.1 for invalid format', () => {
    expect(service.incrementVersion('invalid')).toBe('v1.1');
  });
});

describe('GeneratorService.checkAutoOptimizeTrigger', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('returns false when totalReviews < threshold', () => {
    const feedback: AggregatedFeedback = {
      scriptId: 's1', totalReviews: 3,
      dimensions: [{ dimension: 'd1', averageScore: 4.0, count: 3 }],
      frequentSuggestions: [],
    };
    expect(service.checkAutoOptimizeTrigger(feedback, 5)).toBe(false);
  });

  it('returns false when all dimensions >= 6', () => {
    const feedback: AggregatedFeedback = {
      scriptId: 's1', totalReviews: 10,
      dimensions: [
        { dimension: 'd1', averageScore: 7.0, count: 10 },
        { dimension: 'd2', averageScore: 8.0, count: 10 },
      ],
      frequentSuggestions: [],
    };
    expect(service.checkAutoOptimizeTrigger(feedback, 5)).toBe(false);
  });

  it('returns true when reviews >= threshold AND any dimension < 6', () => {
    const feedback: AggregatedFeedback = {
      scriptId: 's1', totalReviews: 5,
      dimensions: [
        { dimension: 'd1', averageScore: 5.9, count: 5 },
        { dimension: 'd2', averageScore: 8.0, count: 5 },
      ],
      frequentSuggestions: [],
    };
    expect(service.checkAutoOptimizeTrigger(feedback, 5)).toBe(true);
  });

  it('returns true at exact threshold boundary', () => {
    const feedback: AggregatedFeedback = {
      scriptId: 's1', totalReviews: 5,
      dimensions: [{ dimension: 'd1', averageScore: 5.0, count: 5 }],
      frequentSuggestions: [],
    };
    expect(service.checkAutoOptimizeTrigger(feedback, 5)).toBe(true);
  });
});

describe('GeneratorService.buildOptimizationPrompt', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('includes original script title and version', () => {
    const original: Script = {
      id: 's1', version: 'v1.0', configId: 'cfg-1', config: makeConfig(),
      title: '原始剧本', dmHandbook: {} as any, playerHandbooks: [], materials: [],
      branchStructure: { nodes: [], edges: [], endings: [] }, tags: [],
      status: ScriptStatus.READY, createdAt: new Date(), updatedAt: new Date(),
    };
    const feedback: AggregatedFeedback = {
      scriptId: 's1', totalReviews: 10,
      dimensions: [{ dimension: '推理难度', averageScore: 4.0, count: 10 }],
      frequentSuggestions: ['增加线索'],
    };
    const prompt = service.buildOptimizationPrompt(original, feedback, []);
    expect(prompt).toContain('原始剧本');
    expect(prompt).toContain('v1.0');
    expect(prompt).toContain('推理难度');
    expect(prompt).toContain('增加线索');
  });
});

describe('GeneratorService.parsePlayableContent', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  function makeValidPlayableRaw() {
    return {
      prologue: { backgroundNarrative: '背景', worldSetting: '世界观', characterIntros: [] },
      acts: [{ actIndex: 1, title: '第一幕', narrative: '叙述', objectives: [], clueIds: [], discussion: { topics: [], guidingQuestions: [], suggestedMinutes: 5 }, vote: { question: '投票', options: [] } }],
      finale: { finalVote: { question: '最终投票', options: [] }, truthReveal: '真相', endings: [] },
      dmHandbook: { prologueGuide: {}, actGuides: [], finaleGuide: {} },
      playerHandbooks: [{ characterId: 'c1', characterName: '角色1', prologueContent: {}, actContents: [], finaleContent: {} }],
    };
  }

  it('returns valid PlayableStructure for complete input', () => {
    const raw = makeValidPlayableRaw();
    const result = service.parsePlayableContent(raw);
    expect(result.prologue).toBeDefined();
    expect(result.acts).toHaveLength(1);
    expect(result.finale).toBeDefined();
    expect(result.dmHandbook).toBeDefined();
    expect(result.playerHandbooks).toHaveLength(1);
  });

  it('throws when input is null', () => {
    expect(() => service.parsePlayableContent(null)).toThrow('missing or not an object');
  });

  it('throws when input is undefined', () => {
    expect(() => service.parsePlayableContent(undefined)).toThrow('missing or not an object');
  });

  it('throws when input is a string', () => {
    expect(() => service.parsePlayableContent('not an object')).toThrow('missing or not an object');
  });

  it('lists all missing fields when input is empty object', () => {
    expect(() => service.parsePlayableContent({})).toThrow('prologue, acts, finale, dmHandbook, playerHandbooks');
  });

  it('throws when prologue is missing', () => {
    const raw = makeValidPlayableRaw();
    delete (raw as Record<string, unknown>).prologue;
    expect(() => service.parsePlayableContent(raw)).toThrow('prologue');
  });

  it('throws when acts is empty array', () => {
    const raw = makeValidPlayableRaw();
    raw.acts = [];
    expect(() => service.parsePlayableContent(raw)).toThrow('acts');
  });

  it('throws when acts is not an array', () => {
    const raw = makeValidPlayableRaw();
    (raw as Record<string, unknown>).acts = 'not-array';
    expect(() => service.parsePlayableContent(raw)).toThrow('acts');
  });

  it('throws when finale is missing', () => {
    const raw = makeValidPlayableRaw();
    delete (raw as Record<string, unknown>).finale;
    expect(() => service.parsePlayableContent(raw)).toThrow('finale');
  });

  it('throws when dmHandbook is missing', () => {
    const raw = makeValidPlayableRaw();
    delete (raw as Record<string, unknown>).dmHandbook;
    expect(() => service.parsePlayableContent(raw)).toThrow('dmHandbook');
  });

  it('throws when playerHandbooks is empty array', () => {
    const raw = makeValidPlayableRaw();
    raw.playerHandbooks = [];
    expect(() => service.parsePlayableContent(raw)).toThrow('playerHandbooks');
  });

  it('lists multiple missing fields', () => {
    const raw = { prologue: { backgroundNarrative: '背景' } };
    expect(() => service.parsePlayableContent(raw)).toThrow('acts, finale, dmHandbook, playerHandbooks');
  });
});


// ─── Helper: make a valid CharacterProfile ───

import { FullCharacterProfile, BloodType, CharacterType } from '@gdgeek/murder-mystery-shared';

function makeCharacterProfile(overrides: Partial<FullCharacterProfile> = {}, id = 'char-1'): FullCharacterProfile {
  return {
    characterId: id,
    characterName: `角色${id}`,
    characterType: 'player',
    gender: '男',
    bloodType: 'A',
    mbtiType: 'INTJ',
    personality: '沉稳冷静',
    appearance: '高大英俊',
    backgroundStory: '背景故事',
    primaryMotivation: '寻找真相',
    secrets: ['秘密1'],
    relationships: [],
    ...overrides,
  };
}

function makeValidCharacterSet(playerCount: number): FullCharacterProfile[] {
  const characters: FullCharacterProfile[] = [];
  for (let i = 0; i < playerCount; i++) {
    characters.push(makeCharacterProfile({
      characterId: `player-${i}`,
      characterName: `玩家${i}`,
      characterType: 'player',
      relationships: [],
    }, `player-${i}`));
  }
  // Add one NPC
  characters.push(makeCharacterProfile({
    characterId: 'npc-0',
    characterName: 'NPC角色',
    characterType: 'npc',
    relationships: [],
  }, 'npc-0'));

  // Add relationships for diversity: one rival and one ally
  characters[0].relationships = [
    { targetCharacterId: `player-1`, targetCharacterName: '玩家1', relationshipType: 'rival', description: '对手' },
    { targetCharacterId: 'npc-0', targetCharacterName: 'NPC角色', relationshipType: 'ally', description: '盟友' },
  ];

  return characters;
}

describe('GeneratorService.validateCharacterProfiles', () => {
  const service = new GeneratorService(makeMockLLM(''), new SkillService());

  it('passes for a valid character set', () => {
    const config = makeConfig({ playerCount: 3 });
    const characters = makeValidCharacterSet(3);
    expect(() => service.validateCharacterProfiles(characters, config)).not.toThrow();
  });

  it('throws when player count does not match config.playerCount', () => {
    const config = makeConfig({ playerCount: 4 });
    const characters = makeValidCharacterSet(3); // only 3 players
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('Expected 4 player characters, got 3');
  });

  it('does not count NPC characters toward playerCount', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    // Add extra NPCs — should still pass
    characters.push(makeCharacterProfile({
      characterId: 'npc-1',
      characterName: 'NPC2',
      characterType: 'npc',
      relationships: [],
    }, 'npc-1'));
    expect(() => service.validateCharacterProfiles(characters, config)).not.toThrow();
  });

  it('throws for invalid bloodType', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].bloodType = 'X' as BloodType;
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('Invalid bloodType');
  });

  it('throws for invalid mbtiType', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].mbtiType = 'XXXX';
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('Invalid mbtiType');
  });

  it('throws for empty gender', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].gender = '';
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('Gender must be non-empty');
  });

  it('throws for whitespace-only gender', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].gender = '   ';
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('Gender must be non-empty');
  });

  it('throws when a character has no secrets', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].secrets = [];
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('must have at least one secret');
  });

  it('throws when no opposing relationship exists', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    // Remove rival, keep only ally
    characters[0].relationships = [
      { targetCharacterId: 'npc-0', targetCharacterName: 'NPC角色', relationshipType: 'ally', description: '盟友' },
    ];
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('at least one opposing relationship');
  });

  it('throws when no cooperative relationship exists', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    // Remove ally, keep only rival
    characters[0].relationships = [
      { targetCharacterId: `player-1`, targetCharacterName: '玩家1', relationshipType: 'rival', description: '对手' },
    ];
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('at least one cooperative relationship');
  });

  it('throws when relationship references non-existent character', () => {
    const config = makeConfig({ playerCount: 2 });
    const characters = makeValidCharacterSet(2);
    characters[0].relationships.push({
      targetCharacterId: 'non-existent',
      targetCharacterName: '不存在',
      relationshipType: 'enemy',
      description: '敌人',
    });
    expect(() => service.validateCharacterProfiles(characters, config)).toThrow('does not exist in the character set');
  });

  it('collects multiple errors in a single throw', () => {
    const config = makeConfig({ playerCount: 5 }); // mismatch
    const characters = makeValidCharacterSet(2);
    characters[0].bloodType = 'Z' as BloodType;
    characters[0].gender = '';
    try {
      service.validateCharacterProfiles(characters, config);
      expect.unreachable('Should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('Expected 5 player characters');
      expect(msg).toContain('Invalid bloodType');
      expect(msg).toContain('Gender must be non-empty');
    }
  });

  it('accepts all valid blood types: A, B, O, AB', () => {
    const config = makeConfig({ playerCount: 4 });
    const bloodTypes: BloodType[] = ['A', 'B', 'O', 'AB'];
    const characters: FullCharacterProfile[] = bloodTypes.map((bt, i) =>
      makeCharacterProfile({
        characterId: `player-${i}`,
        characterName: `玩家${i}`,
        characterType: 'player',
        bloodType: bt,
        relationships: [],
      }, `player-${i}`),
    );
    // Add NPC and relationships for diversity
    characters.push(makeCharacterProfile({
      characterId: 'npc-0',
      characterName: 'NPC',
      characterType: 'npc',
      relationships: [],
    }, 'npc-0'));
    characters[0].relationships = [
      { targetCharacterId: 'player-1', targetCharacterName: '玩家1', relationshipType: 'enemy', description: '敌人' },
      { targetCharacterId: 'npc-0', targetCharacterName: 'NPC', relationshipType: 'family', description: '亲属' },
    ];
    expect(() => service.validateCharacterProfiles(characters, config)).not.toThrow();
  });
});

// ─── buildCharacterSystemPrompt ───

describe('GeneratorService.buildCharacterSystemPrompt', () => {
  const service = new GeneratorService(makeMockLLM('{}'), new SkillService());

  it('includes character designer role definition', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('专业的剧本杀角色设计师');
  });

  it('includes playerCount requirement', () => {
    const config = makeConfig({ playerCount: 5 });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('5');
    expect(prompt).toContain('player');
  });

  it('includes gender/bloodType/mbtiType generation requirements', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('gender');
    expect(prompt).toContain('bloodType');
    expect(prompt).toContain('mbtiType');
    expect(prompt).toContain('A');
    expect(prompt).toContain('B');
    expect(prompt).toContain('O');
    expect(prompt).toContain('AB');
    expect(prompt).toContain('INTJ');
    expect(prompt).toContain('ENFP');
  });

  it('includes personality-MBTI-bloodType consistency instructions', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('性格特征（personality）必须与其MBTI类型和血型保持合理一致性');
    expect(prompt).toContain('MBTI类型（mbtiType）：16种MBTI类型之一');
  });

  it('includes appearance description requirements', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('外貌描述（appearance）');
    expect(prompt).toContain('体貌特征');
    expect(prompt).toContain('穿着风格');
  });

  it('includes output format as JSON array', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('JSON数组');
    expect(prompt).toContain('zodiacSign');
  });

  it('includes language instruction for zh', () => {
    const config = makeConfig({ language: 'zh' });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('请用中文生成所有内容');
  });

  it('includes language instruction for non-zh', () => {
    const config = makeConfig({ language: 'en' });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('Please generate all content in language: en');
  });

  it('includes special setting for shin_honkaku with specialSetting', () => {
    const config = makeConfig({
      gameType: GameType.SHIN_HONKAKU,
      specialSetting: {
        settingTypes: [SettingType.SUPERPOWER],
        settingDescription: '超能力世界',
        settingConstraints: '每人只能有一种超能力',
      },
    });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('超能力世界');
    expect(prompt).toContain('每人只能有一种超能力');
    expect(prompt).toContain('特殊世界观设定兼容');
  });

  it('does NOT include special setting for non-shin_honkaku', () => {
    const config = makeConfig({
      gameType: GameType.HONKAKU,
      specialSetting: {
        settingTypes: [SettingType.SUPERPOWER],
        settingDescription: '超能力世界',
        settingConstraints: '每人只能有一种超能力',
      },
    });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).not.toContain('超能力世界');
  });

  it('does NOT include special setting for shin_honkaku without specialSetting', () => {
    const config = makeConfig({ gameType: GameType.SHIN_HONKAKU });
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).not.toContain('特殊世界观设定兼容');
  });

  it('includes relationship requirements (opposing and cooperative)', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('对立关系');
    expect(prompt).toContain('合作关系');
  });

  it('includes secret requirement', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterSystemPrompt(config);
    expect(prompt).toContain('秘密');
  });
});

// ─── buildCharacterUserPrompt ───

describe('GeneratorService.buildCharacterUserPrompt', () => {
  const service = new GeneratorService(makeMockLLM('{}'), new SkillService());

  const makeSkill = (overrides: Partial<SkillTemplate> = {}): SkillTemplate => ({
    id: 'skill-1',
    category: SkillCategory.CHARACTER_DESIGN,
    name: '角色设计模板',
    description: '角色设计指导',
    gameTypes: [GameType.HONKAKU],
    priority: 1,
    content: '设计角色时注意性格多样性',
    ...overrides,
  });

  it('includes all config parameters', () => {
    const config = makeConfig({
      playerCount: 6,
      gameType: GameType.HONKAKU,
      ageGroup: AgeGroup.ADULT,
      era: '唐朝',
      location: '长安',
      theme: '宫廷阴谋',
    });
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('6');
    expect(prompt).toContain('honkaku');
    expect(prompt).toContain('adult');
    expect(prompt).toContain('唐朝');
    expect(prompt).toContain('长安');
    expect(prompt).toContain('宫廷阴谋');
  });

  it('includes skill templates', () => {
    const config = makeConfig();
    const skills = [
      makeSkill({ name: '角色设计A', content: '角色设计内容A' }),
      makeSkill({ id: 'skill-2', category: SkillCategory.MOTIVE, name: '动机设计B', content: '动机设计内容B' }),
    ];
    const prompt = service.buildCharacterUserPrompt(config, skills);
    expect(prompt).toContain('角色设计A');
    expect(prompt).toContain('角色设计内容A');
    expect(prompt).toContain('动机设计B');
    expect(prompt).toContain('动机设计内容B');
  });

  it('includes gender/bloodType/mbtiType generation requirements', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('gender');
    expect(prompt).toContain('bloodType');
    expect(prompt).toContain('mbtiType');
  });

  it('includes appearance generation instruction', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('appearance');
    expect(prompt).toContain('外貌描述');
  });

  it('includes personality-MBTI consistency instruction', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('MBTI');
    expect(prompt).toContain('一致性');
  });

  it('includes special setting for shin_honkaku with specialSetting', () => {
    const config = makeConfig({
      gameType: GameType.SHIN_HONKAKU,
      specialSetting: {
        settingTypes: [SettingType.FANTASY],
        settingDescription: '奇幻世界观',
        settingConstraints: '魔法有代价',
      },
    });
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('奇幻世界观');
    expect(prompt).toContain('魔法有代价');
    expect(prompt).toContain('特殊设定');
  });

  it('does NOT include special setting for non-shin_honkaku', () => {
    const config = makeConfig({
      gameType: GameType.HONKAKU,
      specialSetting: {
        settingTypes: [SettingType.FANTASY],
        settingDescription: '奇幻世界观',
        settingConstraints: '魔法有代价',
      },
    });
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).not.toContain('奇幻世界观');
  });

  it('does NOT include special setting for shin_honkaku without specialSetting', () => {
    const config = makeConfig({ gameType: GameType.SHIN_HONKAKU });
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).not.toContain('特殊设定');
  });

  it('handles empty skills array', () => {
    const config = makeConfig();
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).not.toContain('Skill模板参考');
  });

  it('includes playerCount in generation instructions', () => {
    const config = makeConfig({ playerCount: 3 });
    const prompt = service.buildCharacterUserPrompt(config, []);
    expect(prompt).toContain('3');
    expect(prompt).toContain('player');
  });
});

// ─── parseCharacterProfiles ───

describe('parseCharacterProfiles', () => {
  const service = new GeneratorService(makeMockLLM('{}'), null as never);

  const validProfile = {
    characterId: 'c1',
    characterName: '角色1',
    characterType: 'player',
    gender: '男',
    bloodType: 'A',
    mbtiType: 'INTJ',
    personality: '沉稳',
    appearance: '高大',
    backgroundStory: '背景',
    primaryMotivation: '动机',
    secrets: ['秘密'],
    relationships: [],
  };

  it('parses a raw JSON array', () => {
    const content = JSON.stringify([validProfile]);
    const result = service.parseCharacterProfiles(content);
    expect(result).toHaveLength(1);
    expect(result[0].gender).toBe('男');
    expect(result[0].bloodType).toBe('A');
    expect(result[0].mbtiType).toBe('INTJ');
  });

  it('extracts JSON from markdown code fences', () => {
    const content = '```json\n' + JSON.stringify([validProfile]) + '\n```';
    const result = service.parseCharacterProfiles(content);
    expect(result).toHaveLength(1);
    expect(result[0].characterName).toBe('角色1');
  });

  it('extracts JSON from code fences without language tag', () => {
    const content = '```\n' + JSON.stringify([validProfile]) + '\n```';
    const result = service.parseCharacterProfiles(content);
    expect(result).toHaveLength(1);
  });

  it('extracts array from surrounding text', () => {
    const content = 'Here are the characters:\n' + JSON.stringify([validProfile]) + '\nDone.';
    const result = service.parseCharacterProfiles(content);
    expect(result).toHaveLength(1);
  });

  it('extracts array from a wrapper object', () => {
    const content = JSON.stringify({ characters: [validProfile] });
    const result = service.parseCharacterProfiles(content);
    expect(result).toHaveLength(1);
    expect(result[0].bloodType).toBe('A');
  });

  it('throws on invalid JSON', () => {
    expect(() => service.parseCharacterProfiles('not json at all')).toThrow(
      'Failed to parse character profiles from LLM response as JSON',
    );
  });

  it('throws on empty array', () => {
    expect(() => service.parseCharacterProfiles('[]')).toThrow('empty CharacterProfile array');
  });

  it('throws when no array is found in object', () => {
    expect(() => service.parseCharacterProfiles('{"key": "value"}')).toThrow(
      'does not contain a valid CharacterProfile array',
    );
  });

  it('throws when gender is missing', () => {
    const bad = { ...validProfile, gender: '' };
    expect(() => service.parseCharacterProfiles(JSON.stringify([bad]))).toThrow('missing or has empty "gender"');
  });

  it('throws when bloodType is invalid', () => {
    const bad = { ...validProfile, bloodType: 'X' };
    expect(() => service.parseCharacterProfiles(JSON.stringify([bad]))).toThrow('invalid "bloodType"');
  });

  it('throws when mbtiType is invalid', () => {
    const bad = { ...validProfile, mbtiType: 'XXXX' };
    expect(() => service.parseCharacterProfiles(JSON.stringify([bad]))).toThrow('invalid "mbtiType"');
  });

  it('accepts all valid blood types', () => {
    for (const bt of ['A', 'B', 'O', 'AB']) {
      const p = { ...validProfile, bloodType: bt };
      const result = service.parseCharacterProfiles(JSON.stringify([p]));
      expect(result[0].bloodType).toBe(bt);
    }
  });

  it('accepts all 16 valid MBTI types', () => {
    const mbtiTypes = [
      'INTJ', 'INTP', 'ENTJ', 'ENTP',
      'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
      'ISTP', 'ISFP', 'ESTP', 'ESFP',
    ];
    for (const mt of mbtiTypes) {
      const p = { ...validProfile, mbtiType: mt };
      const result = service.parseCharacterProfiles(JSON.stringify([p]));
      expect(result[0].mbtiType).toBe(mt);
    }
  });

  it('parses multiple profiles correctly', () => {
    const p2 = { ...validProfile, characterId: 'c2', characterName: '角色2', gender: '女', bloodType: 'AB', mbtiType: 'ENFP' };
    const result = service.parseCharacterProfiles(JSON.stringify([validProfile, p2]));
    expect(result).toHaveLength(2);
    expect(result[1].gender).toBe('女');
    expect(result[1].bloodType).toBe('AB');
    expect(result[1].mbtiType).toBe('ENFP');
  });
});

// ─── validateCharacterConsistency ───

describe('GeneratorService.validateCharacterConsistency', () => {
  const service = new GeneratorService(makeMockLLM('{}'), new SkillService());

  function makeScript(overrides: Partial<Script> = {}): Script {
    return {
      id: 'script-1',
      version: '1.0.0',
      configId: 'cfg-1',
      config: makeConfig(),
      title: '测试剧本',
      dmHandbook: {
        overview: '概述',
        characters: [],
        timeline: [],
        clueDistribution: [],
        roundGuides: [],
        branchDecisionPoints: [],
        endings: [],
        truthReveal: '真相',
        judgingRules: { winConditions: '', scoringCriteria: '' },
      },
      playerHandbooks: [],
      materials: [],
      branchStructure: { nodes: [], edges: [], endings: [] },
      tags: [],
      status: ScriptStatus.READY,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('passes for a consistent script and character set', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'player-0', characterName: '玩家0', backgroundStory: '背景故事', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
        { characterId: 'player-1', characterName: '玩家1', backgroundStory: '背景故事', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
      dmHandbook: {
        overview: '', characters: [],
        timeline: [{ time: '10:00', event: '事件1', involvedCharacterIds: ['player-0', 'npc-0'] }],
        clueDistribution: [], roundGuides: [], branchDecisionPoints: [], endings: [], truthReveal: '', judgingRules: { winConditions: '', scoringCriteria: '' },
      },
    });
    expect(() => service.validateCharacterConsistency(script, characters)).not.toThrow();
  });

  it('throws when PlayerHandbook exists for an NPC character', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'npc-0', characterName: 'NPC角色', backgroundStory: '背景', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
    });
    expect(() => service.validateCharacterConsistency(script, characters)).toThrow('non-player character');
  });

  it('throws when PlayerHandbook references a non-existent character', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'ghost-id', characterName: '幽灵', backgroundStory: '背景', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
    });
    expect(() => service.validateCharacterConsistency(script, characters)).toThrow('non-existent character');
  });

  it('warns when characterName does not match between handbook and profile', () => {
    const characters = makeValidCharacterSet(2);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'player-0', characterName: '错误名字', backgroundStory: '背景故事', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
    });
    service.validateCharacterConsistency(script, characters);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('name mismatch'));
    warnSpy.mockRestore();
  });

  it('warns when backgroundStory is empty in PlayerHandbook', () => {
    const characters = makeValidCharacterSet(2);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'player-0', characterName: '玩家0', backgroundStory: '', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
    });
    service.validateCharacterConsistency(script, characters);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Empty backgroundStory'));
    warnSpy.mockRestore();
  });

  it('throws when timeline references a non-existent character', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [],
      dmHandbook: {
        overview: '', characters: [],
        timeline: [{ time: '10:00', event: '神秘事件', involvedCharacterIds: ['non-existent-id'] }],
        clueDistribution: [], roundGuides: [], branchDecisionPoints: [], endings: [], truthReveal: '', judgingRules: { winConditions: '', scoringCriteria: '' },
      },
    });
    expect(() => service.validateCharacterConsistency(script, characters)).toThrow('non-existent character');
  });

  it('allows timeline to reference both player and NPC characters', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [],
      dmHandbook: {
        overview: '', characters: [],
        timeline: [
          { time: '10:00', event: '事件1', involvedCharacterIds: ['player-0', 'player-1', 'npc-0'] },
        ],
        clueDistribution: [], roundGuides: [], branchDecisionPoints: [], endings: [], truthReveal: '', judgingRules: { winConditions: '', scoringCriteria: '' },
      },
    });
    expect(() => service.validateCharacterConsistency(script, characters)).not.toThrow();
  });

  it('passes when script has no timeline events', () => {
    const characters = makeValidCharacterSet(2);
    const script = makeScript({
      playerHandbooks: [
        { characterId: 'player-0', characterName: '玩家0', backgroundStory: '背景故事', primaryGoal: '', secondaryGoals: [], relationships: [], knownClues: [], roundActions: [], secrets: [] },
      ],
    });
    expect(() => service.validateCharacterConsistency(script, characters)).not.toThrow();
  });
});

// ─── 8.3 阶段化错误处理 ───

describe('Phased error handling (Task 8.3)', () => {
  const service = new GeneratorService(makeMockLLM('{}'), new SkillService());

  beforeEach(() => {
    mockRedisStore.clear();
  });

  it('phase 1 LLM failure sets errorPhase to "character"', async () => {
    const config = makeConfig();
    const jobId = 'test-job-phase1';

    // Seed a pending job in mock Redis
    const job: GenerateJob = {
      jobId,
      configId: config.id,
      status: 'pending',
      generationMode: 'character_first',
      currentPhase: 'character',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`generate_job:${jobId}`, JSON.stringify(job));

    // Make generateCharacters throw an LLMError
    vi.spyOn(service, 'generateCharacters').mockRejectedValueOnce(
      new LLMError('Rate limit exceeded', {
        statusCode: 429,
        retryAttempts: 3,
        provider: 'openai',
        isRetryable: true,
      }),
    );

    // Call the private method
    await (service as any).runCharacterGenerate(jobId, config);

    // Read the updated job from mock Redis
    const updatedRaw = mockRedisStore.get(`generate_job:${jobId}`);
    expect(updatedRaw).toBeDefined();
    const updatedJob = JSON.parse(updatedRaw!) as GenerateJob;

    expect(updatedJob.status).toBe('failed');
    expect(updatedJob.errorPhase).toBe('character');
    expect(updatedJob.error).toContain('Rate limit exceeded');
    expect(updatedJob.error).toContain('provider=openai');
    expect(updatedJob.error).toContain('statusCode=429');
    expect(updatedJob.error).toContain('retryAttempts=3');
  });

  it('phase 2 LLM failure sets errorPhase to "story"', async () => {
    const config = makeConfig();
    const jobId = 'test-job-phase2';

    // Seed a generating_story job in mock Redis
    const job: GenerateJob = {
      jobId,
      configId: config.id,
      status: 'generating_story',
      generationMode: 'character_first',
      currentPhase: 'story',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`generate_job:${jobId}`, JSON.stringify(job));

    // Seed a confirmed CharacterDraft
    const draft: CharacterDraft = {
      jobId,
      configId: config.id,
      characters: makeValidCharacterSet(4),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`character_draft:${jobId}`, JSON.stringify(draft));

    // Mock getConfig to return config (avoids MySQL)
    vi.spyOn(service as any, 'getConfig').mockResolvedValueOnce(config);

    // Make generateStory throw an LLMError
    vi.spyOn(service, 'generateStory').mockRejectedValueOnce(
      new LLMError('Service unavailable', {
        statusCode: 503,
        retryAttempts: 3,
        provider: 'anthropic',
        isRetryable: true,
      }),
    );

    // Call the private method
    await (service as any).runStoryGenerate(jobId);

    // Read the updated job from mock Redis
    const updatedRaw = mockRedisStore.get(`generate_job:${jobId}`);
    expect(updatedRaw).toBeDefined();
    const updatedJob = JSON.parse(updatedRaw!) as GenerateJob;

    expect(updatedJob.status).toBe('failed');
    expect(updatedJob.errorPhase).toBe('story');
    expect(updatedJob.error).toContain('Service unavailable');
    expect(updatedJob.error).toContain('provider=anthropic');
    expect(updatedJob.error).toContain('statusCode=503');
    expect(updatedJob.error).toContain('retryAttempts=3');
  });

  it('phase 2 failure preserves CharacterDraft confirmed status', async () => {
    const config = makeConfig();
    const jobId = 'test-job-draft-preserved';

    // Seed a generating_story job
    const job: GenerateJob = {
      jobId,
      configId: config.id,
      status: 'generating_story',
      generationMode: 'character_first',
      currentPhase: 'story',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`generate_job:${jobId}`, JSON.stringify(job));

    // Seed a confirmed CharacterDraft
    const draft: CharacterDraft = {
      jobId,
      configId: config.id,
      characters: makeValidCharacterSet(4),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`character_draft:${jobId}`, JSON.stringify(draft));

    // Mock getConfig
    vi.spyOn(service as any, 'getConfig').mockResolvedValueOnce(config);

    // Make generateStory throw
    vi.spyOn(service, 'generateStory').mockRejectedValueOnce(
      new Error('Story generation failed'),
    );

    await (service as any).runStoryGenerate(jobId);

    // Verify CharacterDraft is still confirmed
    const draftRaw = mockRedisStore.get(`character_draft:${jobId}`);
    expect(draftRaw).toBeDefined();
    const updatedDraft = JSON.parse(draftRaw!) as CharacterDraft;
    expect(updatedDraft.status).toBe('confirmed');
  });

  it('LLM error details are included in error message (statusCode, provider, retryAttempts)', async () => {
    const config = makeConfig();
    const jobId = 'test-job-llm-details';

    // Seed a pending job
    const job: GenerateJob = {
      jobId,
      configId: config.id,
      status: 'pending',
      generationMode: 'character_first',
      currentPhase: 'character',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRedisStore.set(`generate_job:${jobId}`, JSON.stringify(job));

    // LLMError without statusCode (undefined)
    vi.spyOn(service, 'generateCharacters').mockRejectedValueOnce(
      new LLMError('Connection timeout', {
        retryAttempts: 2,
        provider: 'deepseek',
        isRetryable: false,
      }),
    );

    await (service as any).runCharacterGenerate(jobId, config);

    const updatedRaw = mockRedisStore.get(`generate_job:${jobId}`);
    const updatedJob = JSON.parse(updatedRaw!) as GenerateJob;

    expect(updatedJob.error).toContain('Connection timeout');
    expect(updatedJob.error).toContain('[LLM Error:');
    expect(updatedJob.error).toContain('provider=deepseek');
    expect(updatedJob.error).toContain('statusCode=N/A');
    expect(updatedJob.error).toContain('retryAttempts=2');
  });
});

// ─── 13.1 向后兼容与 Script 结构一致性 ───

describe('Backward compatibility and Script structure consistency (Task 13.1)', () => {
  const service = new GeneratorService(makeMockLLM(makeValidScriptJSON(4)), new SkillService());

  beforeEach(() => {
    mockRedisStore.clear();
  });

  // ─── startGenerate defaults generationMode to 'oneshot' ───

  it('startGenerate creates a job with generationMode "oneshot"', async () => {
    const config = makeConfig();
    const job = await service.startGenerate(config);

    expect(job.generationMode).toBe('oneshot');
    expect(job.status).toBe('pending');
    expect(job.configId).toBe(config.id);
  });

  it('startCharacterFirstGenerate creates a job with generationMode "character_first"', async () => {
    const config = makeConfig();
    const job = await service.startCharacterFirstGenerate(config);

    expect(job.generationMode).toBe('character_first');
    expect(job.status).toBe('pending');
    expect(job.currentPhase).toBe('character');
  });

  // ─── Both modes produce Scripts with the same required fields ───

  const REQUIRED_SCRIPT_FIELDS = [
    'id', 'version', 'configId', 'config', 'title',
    'dmHandbook', 'playerHandbooks', 'materials',
    'branchStructure', 'tags', 'status', 'createdAt', 'updatedAt',
  ] as const;

  it('oneshot mode (generate) produces a Script with all required fields', async () => {
    const oneshotService = new GeneratorService(makeMockLLM(makeValidScriptJSON(4)), new SkillService());
    vi.spyOn(oneshotService, 'storeScript').mockResolvedValueOnce(undefined);
    const config = makeConfig({ playerCount: 4 });
    const script = await oneshotService.generate(config);

    for (const field of REQUIRED_SCRIPT_FIELDS) {
      expect(script).toHaveProperty(field);
      expect((script as Record<string, unknown>)[field]).toBeDefined();
    }
  });

  it('character_first mode (generateStory) produces a Script with all required fields', async () => {
    const charFirstService = new GeneratorService(makeMockLLM(makeValidScriptJSON(4)), new SkillService());
    const config = makeConfig({ playerCount: 4 });
    const characters = makeValidCharacterSet(4);
    const script = await charFirstService.generateStory(config, characters);

    for (const field of REQUIRED_SCRIPT_FIELDS) {
      expect(script).toHaveProperty(field);
      expect((script as Record<string, unknown>)[field]).toBeDefined();
    }
  });

  it('both modes produce Scripts with identical required field sets', async () => {
    const llmContent = makeValidScriptJSON(4);
    const config = makeConfig({ playerCount: 4 });

    const oneshotService = new GeneratorService(makeMockLLM(llmContent), new SkillService());
    vi.spyOn(oneshotService, 'storeScript').mockResolvedValueOnce(undefined);
    const oneshotScript = await oneshotService.generate(config);

    const charFirstService = new GeneratorService(makeMockLLM(llmContent), new SkillService());
    const characters = makeValidCharacterSet(4);
    const charFirstScript = await charFirstService.generateStory(config, characters);

    // Both must have all required fields
    for (const field of REQUIRED_SCRIPT_FIELDS) {
      expect(oneshotScript).toHaveProperty(field);
      expect(charFirstScript).toHaveProperty(field);
    }

    // character_first may additionally have characterProfiles and generationMode
    expect(charFirstScript.characterProfiles).toBeDefined();
    expect(charFirstScript.generationMode).toBe('character_first');

    // oneshot does NOT set characterProfiles or generationMode
    expect(oneshotScript.characterProfiles).toBeUndefined();
    expect(oneshotScript.generationMode).toBeUndefined();
  });

  // ─── generationMode parameter defaults to 'oneshot' in generate endpoint ───

  it('startGenerate job stored in Redis has generationMode "oneshot"', async () => {
    const config = makeConfig();
    const job = await service.startGenerate(config);

    const raw = mockRedisStore.get(`generate_job:${job.jobId}`);
    expect(raw).toBeDefined();
    const storedJob = JSON.parse(raw!) as GenerateJob;
    expect(storedJob.generationMode).toBe('oneshot');
  });

  it('startCharacterFirstGenerate job stored in Redis has generationMode "character_first"', async () => {
    const config = makeConfig();
    const job = await service.startCharacterFirstGenerate(config);

    const raw = mockRedisStore.get(`generate_job:${job.jobId}`);
    expect(raw).toBeDefined();
    const storedJob = JSON.parse(raw!) as GenerateJob;
    expect(storedJob.generationMode).toBe('character_first');
  });
});
