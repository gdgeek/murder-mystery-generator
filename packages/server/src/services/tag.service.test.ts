import { describe, it, expect } from 'vitest';
import { TagService } from './tag.service';
import { GameType, AgeGroup, TagCategory, ScriptConfig } from '@gdgeek/murder-mystery-shared';

const service = new TagService();

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

describe('TagService.generateTagDefs', () => {
  it('generates 5 tag definitions covering all required categories', () => {
    const defs = service.generateTagDefs(makeConfig());
    expect(defs).toHaveLength(5);

    const categories = defs.map(d => d.category);
    expect(categories).toContain(TagCategory.GAME_TYPE);
    expect(categories).toContain(TagCategory.AGE_GROUP);
    expect(categories).toContain(TagCategory.PLAYER_COUNT);
    expect(categories).toContain(TagCategory.ERA);
    expect(categories).toContain(TagCategory.THEME);
  });

  it('maps game type correctly', () => {
    const honkaku = service.generateTagDefs(makeConfig({ gameType: GameType.HONKAKU }));
    expect(honkaku.find(d => d.category === TagCategory.GAME_TYPE)?.name).toBe('本格');

    const shin = service.generateTagDefs(makeConfig({ gameType: GameType.SHIN_HONKAKU }));
    expect(shin.find(d => d.category === TagCategory.GAME_TYPE)?.name).toBe('新本格');

    const henkaku = service.generateTagDefs(makeConfig({ gameType: GameType.HENKAKU }));
    expect(henkaku.find(d => d.category === TagCategory.GAME_TYPE)?.name).toBe('变格');
  });

  it('maps age group correctly', () => {
    const defs = service.generateTagDefs(makeConfig({ ageGroup: AgeGroup.COLLEGE }));
    expect(defs.find(d => d.category === TagCategory.AGE_GROUP)?.name).toBe('大学生');
  });

  it('formats player count as N人本', () => {
    const defs = service.generateTagDefs(makeConfig({ playerCount: 6 }));
    expect(defs.find(d => d.category === TagCategory.PLAYER_COUNT)?.name).toBe('6人本');
  });

  it('uses era and theme from config', () => {
    const defs = service.generateTagDefs(makeConfig({ era: '现代', theme: '恐怖' }));
    expect(defs.find(d => d.category === TagCategory.ERA)?.name).toBe('现代');
    expect(defs.find(d => d.category === TagCategory.THEME)?.name).toBe('恐怖');
  });

  it('works for all game type and age group combinations', () => {
    for (const gt of Object.values(GameType)) {
      for (const ag of Object.values(AgeGroup)) {
        const defs = service.generateTagDefs(makeConfig({ gameType: gt, ageGroup: ag }));
        expect(defs).toHaveLength(5);
      }
    }
  });
});
