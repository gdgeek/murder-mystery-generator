/**
 * 轮次结构计算器 - 纯函数模块
 * 根据游戏时长计算轮次结构和每轮时间分配
 * Requirements: 4.1, 4.3
 */

import type { RoundStructure, RoundPhase } from '@gdgeek/murder-mystery-shared';

/** 时长到轮次数映射 */
const DURATION_TO_ROUNDS: Record<number, number> = {
  2: 2,
  3: 3,
  4: 4,
  5: 4,
  6: 5,
};

/** 固定开销时间（分钟） */
const SUMMARY_MINUTES = 10;
const FINAL_VOTE_MINUTES = 5;
const REVEAL_MINUTES = 10;
const OVERHEAD_MINUTES = SUMMARY_MINUTES + FINAL_VOTE_MINUTES + REVEAL_MINUTES;

/**
 * 根据游戏时长计算轮次结构
 * @param durationHours 游戏时长（小时），有效值为 2-6 的整数
 * @returns 轮次结构，无效输入返回 null
 */
export function calculateRoundStructure(durationHours: number): RoundStructure | null {
  if (
    typeof durationHours !== 'number' ||
    !Number.isInteger(durationHours) ||
    durationHours < 2 ||
    durationHours > 6
  ) {
    return null;
  }

  const totalRounds = DURATION_TO_ROUNDS[durationHours];
  const totalMinutes = durationHours * 60;
  const availableMinutes = totalMinutes - OVERHEAD_MINUTES;
  const minutesPerRound = Math.floor(availableMinutes / totalRounds);

  // Split each round into 3 phases: reading, investigation, discussion
  // Approximate ratio: reading ~25%, investigation ~37.5%, discussion ~37.5%
  const readingMinutes = Math.floor(minutesPerRound * 0.25);
  const remaining = minutesPerRound - readingMinutes;
  const investigationMinutes = Math.floor(remaining / 2);
  const discussionMinutes = remaining - investigationMinutes;

  const roundPhase: RoundPhase = {
    readingMinutes,
    investigationMinutes,
    discussionMinutes,
  };

  const rounds: RoundPhase[] = Array.from({ length: totalRounds }, () => ({ ...roundPhase }));

  return {
    rounds,
    totalRounds,
    summaryMinutes: SUMMARY_MINUTES,
    finalVoteMinutes: FINAL_VOTE_MINUTES,
    revealMinutes: REVEAL_MINUTES,
  };
}
