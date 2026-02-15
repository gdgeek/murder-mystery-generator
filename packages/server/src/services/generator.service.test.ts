import { describe, it, expect, vi } from 'vitest';
import { GeneratorService } from './generator.service';
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
} from '@gdgeek/murder-mystery-shared';
import { ILLMAdapter } from '../adapters/llm-adapter.interface';

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
