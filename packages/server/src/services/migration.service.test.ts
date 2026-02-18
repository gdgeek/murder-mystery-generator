import { describe, it, expect } from 'vitest';
import { MigrationService } from './migration.service';
import {
  Script,
  ScriptStatus,
  GameType,
  AgeGroup,
  MaterialType,
} from '@gdgeek/murder-mystery-shared';

const service = new MigrationService();

/** Build a minimal valid legacy Script for testing */
function buildLegacyScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    version: '1.0.0',
    configId: 'config-1',
    config: {
      id: 'config-1',
      playerCount: 3,
      durationHours: 3,
      gameType: GameType.HONKAKU,
      ageGroup: AgeGroup.ADULT,
      restorationRatio: 60,
      deductionRatio: 40,
      era: '民国',
      location: '上海',
      theme: '悬疑推理',
      roundStructure: {
        totalRounds: 2,
        rounds: [
          { roundIndex: 0, readingMinutes: 10, investigationMinutes: 15, discussionMinutes: 15 },
          { roundIndex: 1, readingMinutes: 10, investigationMinutes: 15, discussionMinutes: 15 },
        ],
        summaryMinutes: 30,
        finalVoteMinutes: 10,
        revealMinutes: 10,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    title: '测试剧本',
    dmHandbook: {
      overview: '这是一个测试背景故事',
      characters: [
        { characterId: 'c1', characterName: '张三', role: '侦探', description: '一位聪明的侦探' },
        { characterId: 'c2', characterName: '李四', role: '嫌疑人', description: '神秘的商人' },
      ],
      timeline: [{ time: '20:00', event: '案发', involvedCharacterIds: ['c1'] }],
      clueDistribution: [
        { clueId: 'clue-1', roundIndex: 0, targetCharacterId: 'c1', condition: '搜证获得', timing: '第1轮' },
        { clueId: 'clue-2', roundIndex: 1, targetCharacterId: 'c2', condition: '对话获得', timing: '第2轮' },
      ],
      roundGuides: [
        { roundIndex: 0, objectives: '调查案发现场', keyEvents: ['发现血迹', '找到凶器'], dmNotes: '注意引导玩家' },
        { roundIndex: 1, objectives: '审问嫌疑人', keyEvents: ['揭露不在场证明'], dmNotes: '控制节奏' },
      ],
      branchDecisionPoints: [
        {
          nodeId: 'bp-1',
          roundIndex: 0,
          voteQuestion: '是否搜查密室？',
          options: [
            { optionId: 'opt-1', text: '搜查', outcome: '发现新线索' },
            { optionId: 'opt-2', text: '不搜查', outcome: '错过线索' },
          ],
        },
      ],
      endings: [
        {
          endingId: 'end-1',
          name: '真相大白',
          triggerConditions: '找到所有线索',
          narrative: '凶手被揭露',
          playerEndingSummaries: [{ characterId: 'c1', ending: '成功破案' }],
        },
      ],
      truthReveal: '真相是张三是凶手',
      judgingRules: { winConditions: '找出凶手即胜利', scoringCriteria: '线索收集数量' },
    },
    playerHandbooks: [
      {
        characterId: 'c1',
        characterName: '张三',
        backgroundStory: '张三的背景故事',
        primaryGoal: '找出凶手',
        secondaryGoals: ['保护自己的秘密'],
        relationships: [{ targetCharacterId: 'c2', targetCharacterName: '李四', relationship: '旧识' }],
        knownClues: ['已知线索1'],
        roundActions: [
          { roundIndex: 0, instructions: '调查现场', hints: ['注意地板'] },
          { roundIndex: 1, instructions: '审问李四', hints: ['问他昨晚行踪'] },
        ],
        secrets: ['张三的秘密1', '张三的秘密2'],
      },
    ],
    materials: [
      { id: 'mat-1', type: MaterialType.CLUE_CARD, content: '血迹', clueId: 'clue-1', associatedCharacterId: 'c1', metadata: {} },
    ],
    branchStructure: { nodes: [], edges: [], endings: [] },
    tags: [],
    status: ScriptStatus.READY,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Script;
}

// ─── hasPlayableStructure ───

describe('MigrationService.hasPlayableStructure', () => {
  it('returns false when playableStructure is undefined', () => {
    const script = buildLegacyScript();
    expect(service.hasPlayableStructure(script)).toBe(false);
  });

  it('returns true when playableStructure exists', () => {
    const script = buildLegacyScript();
    const ps = service.migrateToPlayable(script);
    script.playableStructure = ps;
    expect(service.hasPlayableStructure(script)).toBe(true);
  });
});

// ─── migrateToPlayable ───

describe('MigrationService.migrateToPlayable', () => {
  it('produces correct number of acts matching roundGuides length', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts).toHaveLength(2);
    expect(result.dmHandbook.actGuides).toHaveLength(2);
  });

  // Prologue mapping
  it('maps dmHandbook.overview to prologue.backgroundNarrative', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.prologue.backgroundNarrative).toBe('这是一个测试背景故事');
  });

  it('maps dmHandbook.characters to prologue.characterIntros', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.prologue.characterIntros).toHaveLength(2);
    expect(result.prologue.characterIntros[0]).toEqual({
      characterId: 'c1',
      characterName: '张三',
      publicDescription: '一位聪明的侦探',
    });
  });

  // Act mapping
  it('maps roundGuides objectives to act narrative', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].narrative).toBe('调查案发现场');
    expect(result.acts[1].narrative).toBe('审问嫌疑人');
  });

  it('maps roundGuides keyEvents to act objectives', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].objectives).toEqual(['发现血迹', '找到凶器']);
  });

  it('maps clueDistribution to act clueIds by roundIndex', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].clueIds).toContain('clue-1');
    expect(result.acts[1].clueIds).toContain('clue-2');
  });

  it('maps branchDecisionPoints to act vote', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].vote.question).toBe('是否搜查密室？');
    expect(result.acts[0].vote.options).toHaveLength(2);
    expect(result.acts[0].vote.options[0].impact).toBe('发现新线索');
  });

  // ActGuide mapping
  it('maps roundGuides to actGuides with correct fields', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const guide = result.dmHandbook.actGuides[0];
    expect(guide.readAloudText).toBe('调查案发现场');
    expect(guide.keyEventHints).toEqual(['发现血迹', '找到凶器']);
    expect(guide.dmPrivateNotes).toBe('注意引导玩家');
  });

  it('maps clueDistribution to actGuide clueDistributionInstructions', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const instructions = result.dmHandbook.actGuides[0].clueDistributionInstructions;
    expect(instructions).toHaveLength(1);
    expect(instructions[0].clueId).toBe('clue-1');
    expect(instructions[0].targetCharacterId).toBe('c1');
  });

  // Finale mapping
  it('maps truthReveal to finale.truthReveal', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.finale.truthReveal).toBe('真相是张三是凶手');
  });

  it('maps endings to finale.endings', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.finale.endings).toHaveLength(1);
    expect(result.finale.endings[0].endingId).toBe('end-1');
    expect(result.finale.endings[0].triggerCondition).toBe('找到所有线索');
  });

  // DM handbook guides
  it('maps judgingRules to finaleGuide.endingJudgmentNotes', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.dmHandbook.finaleGuide.endingJudgmentNotes).toContain('找出凶手即胜利');
    expect(result.dmHandbook.finaleGuide.endingJudgmentNotes).toContain('线索收集数量');
  });

  it('builds prologueGuide from overview and characters', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.dmHandbook.prologueGuide.openingScript).toBe('这是一个测试背景故事');
    expect(result.dmHandbook.prologueGuide.characterAssignmentNotes).toContain('张三: 侦探');
  });

  // Player handbook mapping
  it('maps playerHandbook backgroundStory to prologueContent', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const ph = result.playerHandbooks[0];
    expect(ph.prologueContent.backgroundStory).toBe('张三的背景故事');
  });

  it('maps playerHandbook relationships to prologueContent', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const ph = result.playerHandbooks[0];
    expect(ph.prologueContent.relationships).toHaveLength(1);
    expect(ph.prologueContent.relationships[0].targetCharacterName).toBe('李四');
  });

  it('maps playerHandbook knownClues to initialKnowledge', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.playerHandbooks[0].prologueContent.initialKnowledge).toEqual(['已知线索1']);
  });

  it('maps roundActions to playerActContents', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const actContents = result.playerHandbooks[0].actContents;
    expect(actContents).toHaveLength(2);
    expect(actContents[0].personalNarrative).toBe('调查现场');
    expect(actContents[0].clueHints).toEqual(['注意地板']);
  });

  it('distributes secrets across actContents as secretInfo', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    const actContents = result.playerHandbooks[0].actContents;
    expect(actContents[0].secretInfo).toBe('张三的秘密1');
    expect(actContents[1].secretInfo).toBe('张三的秘密2');
  });

  // Non-destructive: original Script is not modified
  it('does not modify the original Script object', () => {
    const script = buildLegacyScript();
    const originalOverview = script.dmHandbook.overview;
    const originalRoundGuides = [...script.dmHandbook.roundGuides];
    const originalPlayerHandbooks = script.playerHandbooks.length;

    service.migrateToPlayable(script);

    expect(script.dmHandbook.overview).toBe(originalOverview);
    expect(script.dmHandbook.roundGuides).toEqual(originalRoundGuides);
    expect(script.playerHandbooks).toHaveLength(originalPlayerHandbooks);
    expect(script.playableStructure).toBeUndefined();
  });

  // Edge case: 1-based roundIndex in clueDistribution
  it('handles 1-based roundIndex in clueDistribution', () => {
    const script = buildLegacyScript();
    script.dmHandbook.clueDistribution = [
      { clueId: 'clue-a', roundIndex: 1, targetCharacterId: 'c1', condition: 'cond', timing: 't' },
      { clueId: 'clue-b', roundIndex: 2, targetCharacterId: 'c2', condition: 'cond', timing: 't' },
    ];
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].clueIds).toContain('clue-a');
    expect(result.acts[1].clueIds).toContain('clue-b');
  });

  // Edge case: empty roundGuides
  it('handles empty roundGuides by producing 1 act with empty fields', () => {
    const script = buildLegacyScript();
    script.dmHandbook.roundGuides = [];
    const result = service.migrateToPlayable(script);
    expect(result.acts).toHaveLength(1);
    expect(result.acts[0].narrative).toBe('');
    expect(result.acts[0].objectives).toEqual([]);
  });

  // Act indices are 1-based
  it('uses 1-based actIndex values', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.acts[0].actIndex).toBe(1);
    expect(result.acts[1].actIndex).toBe(2);
    expect(result.dmHandbook.actGuides[0].actIndex).toBe(1);
  });

  // Player act count matches DM act count
  it('produces matching act counts between DM and player handbooks', () => {
    const script = buildLegacyScript();
    const result = service.migrateToPlayable(script);
    expect(result.playerHandbooks[0].actContents).toHaveLength(result.acts.length);
    expect(result.dmHandbook.actGuides).toHaveLength(result.acts.length);
  });
});
