/**
 * 状态机 (SessionStateMachine)
 *
 * 纯函数实现，不依赖外部状态。负责校验状态转换合法性。
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { SessionState, AuthoringMode } from '@gdgeek/murder-mystery-shared';

// ─── 转换结果 ───

export interface StateTransitionResult {
  success: boolean;
  newState?: SessionState;
  error?: string;
}

// ─── 合法转换表 ───

/** 分阶段模式转换表 */
export const STAGED_TRANSITIONS: Record<string, SessionState[]> = {
  draft: ['planning'],
  planning: ['plan_review', 'failed'],
  plan_review: ['designing'],
  designing: ['design_review', 'failed'],
  design_review: ['executing'],
  executing: ['chapter_review', 'failed'],
  chapter_review: ['executing', 'completed'],
};

/** 一键生成模式转换表 */
export const VIBE_TRANSITIONS: Record<string, SessionState[]> = {
  draft: ['generating'],
  generating: ['completed', 'failed'],
};

// ─── 转换函数 ───

/**
 * 校验并执行状态转换。
 *
 * - 正常转换：检查 (currentState → targetState) 是否在对应模式的转换表中
 * - failed 状态重试：允许从 failed 转换到任何在转换表中以 failed 为合法目标的源状态
 *   （即那些可能失败的阶段起始状态），用于重试恢复
 */
export function transition(
  currentState: SessionState,
  targetState: SessionState,
  mode: AuthoringMode,
): StateTransitionResult {
  const table = mode === 'staged' ? STAGED_TRANSITIONS : VIBE_TRANSITIONS;

  // 正常转换路径
  const allowed = table[currentState];
  if (allowed && allowed.includes(targetState)) {
    return { success: true, newState: targetState };
  }

  // failed 状态重试：允许回退到可失败阶段的起始状态
  if (currentState === 'failed') {
    const canRetryTo = Object.entries(table)
      .filter(([, targets]) => targets.includes('failed'))
      .map(([source]) => source as SessionState);

    if (canRetryTo.includes(targetState)) {
      return { success: true, newState: targetState };
    }
  }

  return {
    success: false,
    error: `Invalid transition from '${currentState}' to '${targetState}' in '${mode}' mode`,
  };
}
