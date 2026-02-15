import { describe, it, expect } from 'vitest';
import { ConfigService } from './config.service';
import { GameType, AgeGroup } from '@gdgeek/murder-mystery-shared';

const service = new ConfigService();

/** Helper: build a valid config input object */
function validInput(overrides: Record<string, unknown> = {}) {
  return {
    playerCount: 4,
    durationHours: 3,
    gameType: GameType.HONKAKU,
    ageGroup: AgeGroup.ADULT,
    restorationRatio: 60,
    deductionRatio: 40,
    era: '民国',
    location: '上海',
    theme: '悬疑推理',
    ...overrides,
  };
}

// ─── validate ───

describe('ConfigService.validate', () => {
  it('returns valid=true for a correct input', () => {
    const result = service.validate(validInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null input', () => {
    const result = service.validate(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-object input', () => {
    const result = service.validate('string');
    expect(result.valid).toBe(false);
  });

  // playerCount
  it('rejects playerCount < 1', () => {
    const result = service.validate(validInput({ playerCount: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'playerCount')).toBe(true);
  });

  it('rejects playerCount > 6', () => {
    const result = service.validate(validInput({ playerCount: 7 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'playerCount')).toBe(true);
  });

  it('rejects non-integer playerCount', () => {
    const result = service.validate(validInput({ playerCount: 3.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'playerCount')).toBe(true);
  });

  it('rejects missing playerCount', () => {
    const input = validInput();
    delete (input as Record<string, unknown>).playerCount;
    const result = service.validate(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'playerCount')).toBe(true);
  });

  // durationHours
  it('rejects durationHours < 2', () => {
    const result = service.validate(validInput({ durationHours: 1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'durationHours')).toBe(true);
  });

  it('rejects durationHours > 6', () => {
    const result = service.validate(validInput({ durationHours: 7 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'durationHours')).toBe(true);
  });

  // gameType
  it('rejects invalid gameType', () => {
    const result = service.validate(validInput({ gameType: 'invalid' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'gameType')).toBe(true);
  });

  // ageGroup
  it('rejects invalid ageGroup', () => {
    const result = service.validate(validInput({ ageGroup: 'toddler' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'ageGroup')).toBe(true);
  });

  // ratio sum
  it('rejects ratios that do not sum to 100', () => {
    const result = service.validate(validInput({ restorationRatio: 50, deductionRatio: 60 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'restorationRatio+deductionRatio')).toBe(true);
  });

  it('rejects restorationRatio out of range', () => {
    const result = service.validate(validInput({ restorationRatio: -1, deductionRatio: 101 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'restorationRatio')).toBe(true);
  });

  // string fields
  it('rejects empty era', () => {
    const result = service.validate(validInput({ era: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'era')).toBe(true);
  });

  it('rejects empty location', () => {
    const result = service.validate(validInput({ location: '  ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'location')).toBe(true);
  });

  it('rejects empty theme', () => {
    const result = service.validate(validInput({ theme: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'theme')).toBe(true);
  });

  // multiple errors
  it('reports multiple errors at once', () => {
    const result = service.validate({ playerCount: 0, durationHours: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });

  // boundary values
  it('accepts playerCount=1 (min)', () => {
    const result = service.validate(validInput({ playerCount: 1 }));
    expect(result.valid).toBe(true);
  });

  it('accepts playerCount=6 (max)', () => {
    const result = service.validate(validInput({ playerCount: 6 }));
    expect(result.valid).toBe(true);
  });

  it('accepts durationHours=2 (min)', () => {
    const result = service.validate(validInput({ durationHours: 2 }));
    expect(result.valid).toBe(true);
  });

  it('accepts durationHours=6 (max)', () => {
    const result = service.validate(validInput({ durationHours: 6 }));
    expect(result.valid).toBe(true);
  });

  it('accepts ratio 0+100', () => {
    const result = service.validate(validInput({ restorationRatio: 0, deductionRatio: 100 }));
    expect(result.valid).toBe(true);
  });

  it('accepts ratio 100+0', () => {
    const result = service.validate(validInput({ restorationRatio: 100, deductionRatio: 0 }));
    expect(result.valid).toBe(true);
  });

  // all valid game types
  it('accepts all valid gameType values', () => {
    for (const gt of [GameType.HONKAKU, GameType.SHIN_HONKAKU, GameType.HENKAKU]) {
      const result = service.validate(validInput({ gameType: gt }));
      expect(result.valid).toBe(true);
    }
  });

  // all valid age groups
  it('accepts all valid ageGroup values', () => {
    for (const ag of [AgeGroup.ELEMENTARY, AgeGroup.MIDDLE_SCHOOL, AgeGroup.COLLEGE, AgeGroup.ADULT]) {
      const result = service.validate(validInput({ ageGroup: ag }));
      expect(result.valid).toBe(true);
    }
  });
});

// ─── calculateRoundStructure ───

describe('ConfigService.calculateRoundStructure', () => {
  it('returns 2 rounds for 2h with 20min summary', () => {
    const rs = service.calculateRoundStructure(2);
    expect(rs.totalRounds).toBe(2);
    expect(rs.rounds).toHaveLength(2);
    expect(rs.summaryMinutes).toBe(20);
  });

  it('returns 3 rounds for 3h with 30min summary', () => {
    const rs = service.calculateRoundStructure(3);
    expect(rs.totalRounds).toBe(3);
    expect(rs.rounds).toHaveLength(3);
    expect(rs.summaryMinutes).toBe(30);
  });

  it('returns 4 rounds for 4h with 30min summary', () => {
    const rs = service.calculateRoundStructure(4);
    expect(rs.totalRounds).toBe(4);
    expect(rs.rounds).toHaveLength(4);
    expect(rs.summaryMinutes).toBe(30);
  });

  it('returns 4 rounds for 5h with 40min summary', () => {
    const rs = service.calculateRoundStructure(5);
    expect(rs.totalRounds).toBe(4);
    expect(rs.rounds).toHaveLength(4);
    expect(rs.summaryMinutes).toBe(40);
  });

  it('returns 5 rounds for 6h with 40min summary', () => {
    const rs = service.calculateRoundStructure(6);
    expect(rs.totalRounds).toBe(5);
    expect(rs.rounds).toHaveLength(5);
    expect(rs.summaryMinutes).toBe(40);
  });

  it('each round has reading 10-15min', () => {
    for (let h = 2; h <= 6; h++) {
      const rs = service.calculateRoundStructure(h);
      for (const r of rs.rounds) {
        expect(r.readingMinutes).toBeGreaterThanOrEqual(10);
        expect(r.readingMinutes).toBeLessThanOrEqual(15);
      }
    }
  });

  it('each round has investigation 15-20min', () => {
    for (let h = 2; h <= 6; h++) {
      const rs = service.calculateRoundStructure(h);
      for (const r of rs.rounds) {
        expect(r.investigationMinutes).toBeGreaterThanOrEqual(15);
        expect(r.investigationMinutes).toBeLessThanOrEqual(20);
      }
    }
  });

  it('each round has discussion 15-20min', () => {
    for (let h = 2; h <= 6; h++) {
      const rs = service.calculateRoundStructure(h);
      for (const r of rs.rounds) {
        expect(r.discussionMinutes).toBeGreaterThanOrEqual(15);
        expect(r.discussionMinutes).toBeLessThanOrEqual(20);
      }
    }
  });

  it('total time does not exceed durationHours * 60', () => {
    for (let h = 2; h <= 6; h++) {
      const rs = service.calculateRoundStructure(h);
      const roundsTotal = rs.rounds.reduce(
        (sum, r) => sum + r.readingMinutes + r.investigationMinutes + r.discussionMinutes,
        0,
      );
      const total = roundsTotal + rs.summaryMinutes + rs.finalVoteMinutes + rs.revealMinutes;
      expect(total).toBeLessThanOrEqual(h * 60);
    }
  });

  it('includes finalVoteMinutes and revealMinutes', () => {
    const rs = service.calculateRoundStructure(3);
    expect(rs.finalVoteMinutes).toBeGreaterThan(0);
    expect(rs.revealMinutes).toBeGreaterThan(0);
  });

  it('throws for unsupported durationHours', () => {
    expect(() => service.calculateRoundStructure(1)).toThrow();
    expect(() => service.calculateRoundStructure(7)).toThrow();
  });
});
