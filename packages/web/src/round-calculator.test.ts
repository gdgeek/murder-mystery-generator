/**
 * 轮次结构计算器 - 单元测试
 * Requirements: 4.1, 4.3
 */

import { describe, it, expect } from 'vitest';
import { calculateRoundStructure } from './round-calculator';

describe('calculateRoundStructure', () => {
  describe('duration to rounds mapping', () => {
    it('2 hours → 2 rounds', () => {
      const result = calculateRoundStructure(2);
      expect(result).not.toBeNull();
      expect(result!.totalRounds).toBe(2);
      expect(result!.rounds).toHaveLength(2);
    });

    it('3 hours → 3 rounds', () => {
      const result = calculateRoundStructure(3);
      expect(result).not.toBeNull();
      expect(result!.totalRounds).toBe(3);
      expect(result!.rounds).toHaveLength(3);
    });

    it('4 hours → 4 rounds', () => {
      const result = calculateRoundStructure(4);
      expect(result).not.toBeNull();
      expect(result!.totalRounds).toBe(4);
      expect(result!.rounds).toHaveLength(4);
    });

    it('5 hours → 4 rounds', () => {
      const result = calculateRoundStructure(5);
      expect(result).not.toBeNull();
      expect(result!.totalRounds).toBe(4);
      expect(result!.rounds).toHaveLength(4);
    });

    it('6 hours → 5 rounds', () => {
      const result = calculateRoundStructure(6);
      expect(result).not.toBeNull();
      expect(result!.totalRounds).toBe(5);
      expect(result!.rounds).toHaveLength(5);
    });
  });

  describe('time allocation', () => {
    it('total time used does not exceed durationHours × 60', () => {
      for (const hours of [2, 3, 4, 5, 6]) {
        const result = calculateRoundStructure(hours)!;
        const roundTime = result.rounds.reduce(
          (sum, r) => sum + r.readingMinutes + r.investigationMinutes + r.discussionMinutes,
          0,
        );
        const totalUsed = roundTime + result.summaryMinutes + result.finalVoteMinutes + result.revealMinutes;
        expect(totalUsed).toBeLessThanOrEqual(hours * 60);
      }
    });

    it('each round has positive phase durations', () => {
      for (const hours of [2, 3, 4, 5, 6]) {
        const result = calculateRoundStructure(hours)!;
        for (const round of result.rounds) {
          expect(round.readingMinutes).toBeGreaterThan(0);
          expect(round.investigationMinutes).toBeGreaterThan(0);
          expect(round.discussionMinutes).toBeGreaterThan(0);
        }
      }
    });

    it('includes fixed overhead times', () => {
      const result = calculateRoundStructure(3)!;
      expect(result.summaryMinutes).toBeGreaterThan(0);
      expect(result.finalVoteMinutes).toBeGreaterThan(0);
      expect(result.revealMinutes).toBeGreaterThan(0);
    });
  });

  describe('invalid inputs return null', () => {
    it('returns null for durationHours < 2', () => {
      expect(calculateRoundStructure(1)).toBeNull();
      expect(calculateRoundStructure(0)).toBeNull();
      expect(calculateRoundStructure(-1)).toBeNull();
    });

    it('returns null for durationHours > 6', () => {
      expect(calculateRoundStructure(7)).toBeNull();
      expect(calculateRoundStructure(100)).toBeNull();
    });

    it('returns null for non-integer values', () => {
      expect(calculateRoundStructure(2.5)).toBeNull();
      expect(calculateRoundStructure(3.7)).toBeNull();
    });

    it('returns null for NaN and Infinity', () => {
      expect(calculateRoundStructure(NaN)).toBeNull();
      expect(calculateRoundStructure(Infinity)).toBeNull();
      expect(calculateRoundStructure(-Infinity)).toBeNull();
    });

    it('returns null for non-number types', () => {
      expect(calculateRoundStructure('3' as unknown as number)).toBeNull();
      expect(calculateRoundStructure(null as unknown as number)).toBeNull();
      expect(calculateRoundStructure(undefined as unknown as number)).toBeNull();
    });
  });
});
