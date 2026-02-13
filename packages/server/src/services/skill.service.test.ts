import { describe, it, expect } from 'vitest';
import { SkillService } from './skill.service';
import { GameType, SkillCategory } from '@murder-mystery/shared';

const service = new SkillService();

describe('SkillService.getAllTemplates', () => {
  it('returns a non-empty array', () => {
    const all = service.getAllTemplates();
    expect(all.length).toBeGreaterThan(0);
  });

  it('every template has required fields', () => {
    for (const t of service.getAllTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.gameTypes.length).toBeGreaterThan(0);
      expect(typeof t.priority).toBe('number');
      expect(t.content).toBeTruthy();
    }
  });
});

describe('SkillService.getByCategory', () => {
  it('returns only templates of the requested category', async () => {
    const results = await service.getByCategory(SkillCategory.TRICK);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.category).toBe(SkillCategory.TRICK);
    }
  });

  it('returns empty for a category with no templates', async () => {
    // All categories should have at least some templates, but let's verify filtering works
    const all = service.getAllTemplates();
    const categories = new Set(all.map(t => t.category));
    for (const cat of Object.values(SkillCategory)) {
      const results = await service.getByCategory(cat);
      if (categories.has(cat)) {
        expect(results.length).toBeGreaterThan(0);
      } else {
        expect(results).toHaveLength(0);
      }
    }
  });
});

describe('SkillService.getByGameType', () => {
  it('returns only templates matching the game type', async () => {
    const results = await service.getByGameType(GameType.HONKAKU);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.gameTypes).toContain(GameType.HONKAKU);
    }
  });

  it('results are sorted by priority descending', async () => {
    for (const gt of Object.values(GameType)) {
      const results = await service.getByGameType(gt);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].priority).toBeGreaterThanOrEqual(results[i].priority);
      }
    }
  });

  it('includes common templates for all game types', async () => {
    for (const gt of Object.values(GameType)) {
      const results = await service.getByGameType(gt);
      const ids = results.map(t => t.id);
      // common templates should appear for every game type
      expect(ids.some(id => id.startsWith('common-'))).toBe(true);
    }
  });
});

describe('SkillService.getForGeneration', () => {
  it('filters by both game type and categories', async () => {
    const results = await service.getForGeneration(GameType.HONKAKU, [SkillCategory.TRICK]);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.gameTypes).toContain(GameType.HONKAKU);
      expect(t.category).toBe(SkillCategory.TRICK);
    }
  });

  it('returns empty when no match', async () => {
    // henkaku has no deduction_chain templates
    const results = await service.getForGeneration(GameType.HENKAKU, [SkillCategory.DEDUCTION_CHAIN]);
    expect(results).toHaveLength(0);
  });
});

describe('SkillService.serialize / deserialize', () => {
  it('round-trips a template correctly', () => {
    const templates = service.getAllTemplates();
    for (const t of templates) {
      const json = service.serialize(t);
      const restored = service.deserialize(json);
      expect(restored).toEqual(t);
    }
  });
});
