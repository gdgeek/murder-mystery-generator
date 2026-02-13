import { describe, it, expect } from 'vitest';
import { PromptBuilder } from './prompt-builder';
import type {
  ScriptConfig,
  SkillTemplate,
  ScriptPlan,
  ScriptOutline,
  Chapter,
  ChapterType,
  LLMRequest,
} from '@murder-mystery/shared';
import { GameType, AgeGroup, SkillCategory } from '@murder-mystery/shared';

// ─── test fixtures ───

const makeConfig = (overrides?: Partial<ScriptConfig>): ScriptConfig => ({
  id: 'cfg-1',
  playerCount: 4,
  durationHours: 3,
  gameType: GameType.HONKAKU,
  ageGroup: AgeGroup.ADULT,
  restorationRatio: 40,
  deductionRatio: 60,
  era: '民国',
  location: '上海租界',
  theme: '悬疑推理',
  language: 'zh',
  roundStructure: {
    rounds: [
      { readingMinutes: 10, investigationMinutes: 15, discussionMinutes: 15 },
      { readingMinutes: 10, investigationMinutes: 20, discussionMinutes: 20 },
    ],
    totalRounds: 2,
    summaryMinutes: 10,
    finalVoteMinutes: 5,
    revealMinutes: 10,
  },
  ...overrides,
});

const makeSkill = (overrides?: Partial<SkillTemplate>): SkillTemplate => ({
  id: 'skill-1',
  category: SkillCategory.CHARACTER_DESIGN,
  name: '角色设计模板',
  description: '角色设计指导',
  gameTypes: [GameType.HONKAKU],
  priority: 1,
  content: '角色设计要点：动机明确、关系复杂',
  ...overrides,
});

const makePlan = (overrides?: Partial<ScriptPlan>): ScriptPlan => ({
  worldOverview: '民国上海，租界风云',
  characters: [
    { name: '张三', role: '侦探', relationshipSketch: '与李四是旧友' },
    { name: '李四', role: '嫌疑人', relationshipSketch: '与张三有旧怨' },
  ],
  coreTrickDirection: '密室杀人',
  themeTone: '黑暗悬疑',
  eraAtmosphere: '民国乱世，暗流涌动',
  ...overrides,
});

const makeOutline = (overrides?: Partial<ScriptOutline>): ScriptOutline => ({
  detailedTimeline: [
    { time: '1930年春', event: '命案发生', involvedCharacters: ['张三', '李四'] },
  ],
  characterRelationships: [
    { characterA: '张三', characterB: '李四', relationship: '旧友反目' },
  ],
  trickMechanism: '利用暗道进出密室',
  clueChainDesign: [
    { clueId: 'clue-1', description: '血迹', leadsTo: ['clue-2'] },
  ],
  branchSkeleton: [
    { nodeId: 'node-1', description: '第一轮投票', options: ['指控张三', '指控李四'], endingDirections: ['真相大白', '冤案'] },
  ],
  roundFlowSummary: [
    { roundIndex: 0, focus: '搜证', keyEvents: ['发现血迹'] },
  ],
  ...overrides,
});

const makeChapter = (overrides?: Partial<Chapter>): Chapter => ({
  index: 0,
  type: 'dm_handbook',
  content: { overview: 'DM手册内容' },
  generatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ─── helpers ───

function assertValidLLMRequest(req: LLMRequest): void {
  expect(req.prompt).toBeDefined();
  expect(typeof req.prompt).toBe('string');
  expect(req.prompt.length).toBeGreaterThan(0);
  expect(req.systemPrompt).toBeDefined();
  expect(typeof req.systemPrompt).toBe('string');
  expect(req.maxTokens).toBeGreaterThan(0);
  expect(req.temperature).toBeGreaterThanOrEqual(0);
  expect(req.temperature).toBeLessThanOrEqual(1);
}

// ─── tests ───

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  describe('buildPlanningPrompt', () => {
    it('returns a valid LLMRequest', () => {
      const result = builder.buildPlanningPrompt(makeConfig(), []);
      assertValidLLMRequest(result);
    });

    it('includes config info in the prompt', () => {
      const config = makeConfig({ playerCount: 6, era: '唐朝', location: '长安' });
      const result = builder.buildPlanningPrompt(config, []);
      expect(result.prompt).toContain('6');
      expect(result.prompt).toContain('唐朝');
      expect(result.prompt).toContain('长安');
      expect(result.prompt).toContain(config.gameType);
    });

    it('includes skill template content when provided', () => {
      const skill = makeSkill({ name: '推理链设计', content: '推理链要点：环环相扣' });
      const result = builder.buildPlanningPrompt(makeConfig(), [skill]);
      expect(result.prompt).toContain('推理链设计');
      expect(result.prompt).toContain('推理链要点：环环相扣');
    });

    it('works with empty skills array', () => {
      const result = builder.buildPlanningPrompt(makeConfig(), []);
      assertValidLLMRequest(result);
      expect(result.prompt).not.toContain('Skill模板参考');
    });

    it('system prompt instructs JSON output for ScriptPlan', () => {
      const result = builder.buildPlanningPrompt(makeConfig(), []);
      expect(result.systemPrompt).toContain('JSON');
      expect(result.systemPrompt).toContain('worldOverview');
    });
  });

  describe('buildDesignPrompt', () => {
    it('returns a valid LLMRequest', () => {
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), []);
      assertValidLLMRequest(result);
    });

    it('includes approved plan content in the prompt', () => {
      const plan = makePlan({ worldOverview: '蒸汽朋克世界' });
      const result = builder.buildDesignPrompt(makeConfig(), plan, []);
      expect(result.prompt).toContain('蒸汽朋克世界');
    });

    it('includes character info from the plan', () => {
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), []);
      expect(result.prompt).toContain('张三');
      expect(result.prompt).toContain('侦探');
    });

    it('includes author notes when provided (Req 4.6)', () => {
      const notes = '请增加更多悬疑元素，减少恐怖成分';
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), [], notes);
      expect(result.prompt).toContain(notes);
      expect(result.prompt).toContain('作者备注');
    });

    it('does not include author notes section when not provided', () => {
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), []);
      expect(result.prompt).not.toContain('作者备注');
    });

    it('includes skill templates', () => {
      const skill = makeSkill({ name: '线索设计', content: '线索要自洽' });
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), [skill]);
      expect(result.prompt).toContain('线索设计');
      expect(result.prompt).toContain('线索要自洽');
    });

    it('system prompt instructs JSON output for ScriptOutline', () => {
      const result = builder.buildDesignPrompt(makeConfig(), makePlan(), []);
      expect(result.systemPrompt).toContain('JSON');
      expect(result.systemPrompt).toContain('detailedTimeline');
    });
  });

  describe('buildChapterPrompt', () => {
    it('returns a valid LLMRequest for dm_handbook', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'dm_handbook', 0, []);
      assertValidLLMRequest(result);
    });

    it('returns a valid LLMRequest for player_handbook', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'player_handbook', 1, []);
      assertValidLLMRequest(result);
    });

    it('returns a valid LLMRequest for materials', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'materials', 5, []);
      assertValidLLMRequest(result);
    });

    it('returns a valid LLMRequest for branch_structure', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'branch_structure', 6, []);
      assertValidLLMRequest(result);
    });

    it('includes outline content in the prompt', () => {
      const outline = makeOutline({ trickMechanism: '时间倒流诡计' });
      const result = builder.buildChapterPrompt(makeConfig(), outline, 'dm_handbook', 0, []);
      expect(result.prompt).toContain('时间倒流诡计');
    });

    it('includes previous chapters content for consistency (Req 5.7)', () => {
      const prevChapter = makeChapter({
        index: 0,
        type: 'dm_handbook',
        content: { overview: '这是DM手册的概述内容' },
      });
      const result = builder.buildChapterPrompt(
        makeConfig(), makeOutline(), 'player_handbook', 1, [prevChapter],
      );
      expect(result.prompt).toContain('前序章节');
      expect(result.prompt).toContain('这是DM手册的概述内容');
    });

    it('does not include previous chapters section when empty', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'dm_handbook', 0, []);
      expect(result.prompt).not.toContain('前序章节');
    });

    it('includes multiple previous chapters', () => {
      const chapters: Chapter[] = [
        makeChapter({ index: 0, type: 'dm_handbook', content: { overview: 'DM内容' } }),
        makeChapter({ index: 1, type: 'player_handbook', content: { characterName: '张三' }, characterId: 'char-1' }),
      ];
      const result = builder.buildChapterPrompt(
        makeConfig(), makeOutline(), 'player_handbook', 2, chapters,
      );
      expect(result.prompt).toContain('DM内容');
      expect(result.prompt).toContain('张三');
    });

    it('includes config info in the prompt', () => {
      const config = makeConfig({ era: '维多利亚时代' });
      const result = builder.buildChapterPrompt(config, makeOutline(), 'dm_handbook', 0, []);
      expect(result.prompt).toContain('维多利亚时代');
    });

    it('includes chapter type label in system prompt', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'dm_handbook', 0, []);
      expect(result.systemPrompt).toContain('DM手册');
    });

    it('player_handbook prompt references the correct player index', () => {
      const result = builder.buildChapterPrompt(makeConfig(), makeOutline(), 'player_handbook', 3, []);
      // chapterIndex 3 means player index 2 (3rd player), so "第3个玩家手册"
      expect(result.prompt).toContain('第3个玩家手册');
    });
  });
});
