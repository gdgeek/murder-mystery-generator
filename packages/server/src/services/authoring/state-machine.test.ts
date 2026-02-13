import { describe, it, expect } from 'vitest';
import {
  transition,
  STAGED_TRANSITIONS,
  VIBE_TRANSITIONS,
  type StateTransitionResult,
} from './state-machine';
import type { SessionState, AuthoringMode } from '@murder-mystery/shared';

// ─── helpers ───

const ALL_STATES: SessionState[] = [
  'draft', 'planning', 'plan_review',
  'designing', 'design_review',
  'executing', 'chapter_review',
  'completed', 'generating', 'failed',
];

// ─── STAGED_TRANSITIONS table ───

describe('STAGED_TRANSITIONS', () => {
  it('draft → planning', () => {
    expect(STAGED_TRANSITIONS['draft']).toEqual(['planning']);
  });

  it('planning → plan_review | failed', () => {
    expect(STAGED_TRANSITIONS['planning']).toEqual(['plan_review', 'failed']);
  });

  it('plan_review → designing', () => {
    expect(STAGED_TRANSITIONS['plan_review']).toEqual(['designing']);
  });

  it('designing → design_review | failed', () => {
    expect(STAGED_TRANSITIONS['designing']).toEqual(['design_review', 'failed']);
  });

  it('design_review → executing', () => {
    expect(STAGED_TRANSITIONS['design_review']).toEqual(['executing']);
  });

  it('executing → chapter_review | failed', () => {
    expect(STAGED_TRANSITIONS['executing']).toEqual(['chapter_review', 'failed']);
  });

  it('chapter_review → executing | completed', () => {
    expect(STAGED_TRANSITIONS['chapter_review']).toEqual(['executing', 'completed']);
  });
});

// ─── VIBE_TRANSITIONS table ───

describe('VIBE_TRANSITIONS', () => {
  it('draft → generating', () => {
    expect(VIBE_TRANSITIONS['draft']).toEqual(['generating']);
  });

  it('generating → completed | failed', () => {
    expect(VIBE_TRANSITIONS['generating']).toEqual(['completed', 'failed']);
  });
});

// ─── transition() — staged mode valid paths ───

describe('transition() — staged mode valid transitions', () => {
  const validPairs: [SessionState, SessionState][] = [
    ['draft', 'planning'],
    ['planning', 'plan_review'],
    ['planning', 'failed'],
    ['plan_review', 'designing'],
    ['designing', 'design_review'],
    ['designing', 'failed'],
    ['design_review', 'executing'],
    ['executing', 'chapter_review'],
    ['executing', 'failed'],
    ['chapter_review', 'executing'],
    ['chapter_review', 'completed'],
  ];

  for (const [from, to] of validPairs) {
    it(`${from} → ${to} succeeds`, () => {
      const result = transition(from, to, 'staged');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(to);
      expect(result.error).toBeUndefined();
    });
  }
});

// ─── transition() — vibe mode valid paths ───

describe('transition() — vibe mode valid transitions', () => {
  const validPairs: [SessionState, SessionState][] = [
    ['draft', 'generating'],
    ['generating', 'completed'],
    ['generating', 'failed'],
  ];

  for (const [from, to] of validPairs) {
    it(`${from} → ${to} succeeds`, () => {
      const result = transition(from, to, 'vibe');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(to);
      expect(result.error).toBeUndefined();
    });
  }
});

// ─── transition() — invalid transitions ───

describe('transition() — invalid transitions', () => {
  it('rejects draft → completed in staged mode', () => {
    const result = transition('draft', 'completed', 'staged');
    expect(result.success).toBe(false);
    expect(result.error).toContain('draft');
    expect(result.error).toContain('completed');
  });

  it('rejects draft → generating in staged mode', () => {
    const result = transition('draft', 'generating', 'staged');
    expect(result.success).toBe(false);
  });

  it('rejects draft → planning in vibe mode', () => {
    const result = transition('draft', 'planning', 'vibe');
    expect(result.success).toBe(false);
  });

  it('rejects completed → draft in staged mode', () => {
    const result = transition('completed', 'draft', 'staged');
    expect(result.success).toBe(false);
  });

  it('rejects plan_review → executing (skipping designing)', () => {
    const result = transition('plan_review', 'executing', 'staged');
    expect(result.success).toBe(false);
  });

  it('error message includes current and target state', () => {
    const result = transition('draft', 'completed', 'staged');
    expect(result.success).toBe(false);
    expect(result.error).toContain('draft');
    expect(result.error).toContain('completed');
    expect(result.error).toContain('staged');
  });
});

// ─── transition() — failed state retry ───

describe('transition() — failed state retry', () => {
  it('allows failed → planning in staged mode (retry)', () => {
    const result = transition('failed', 'planning', 'staged');
    expect(result.success).toBe(true);
    expect(result.newState).toBe('planning');
  });

  it('allows failed → designing in staged mode (retry)', () => {
    const result = transition('failed', 'designing', 'staged');
    expect(result.success).toBe(true);
    expect(result.newState).toBe('designing');
  });

  it('allows failed → executing in staged mode (retry)', () => {
    const result = transition('failed', 'executing', 'staged');
    expect(result.success).toBe(true);
    expect(result.newState).toBe('executing');
  });

  it('allows failed → generating in vibe mode (retry)', () => {
    const result = transition('failed', 'generating', 'vibe');
    expect(result.success).toBe(true);
    expect(result.newState).toBe('generating');
  });

  it('rejects failed → draft in staged mode (draft cannot fail)', () => {
    const result = transition('failed', 'draft', 'staged');
    expect(result.success).toBe(false);
  });

  it('rejects failed → completed in staged mode', () => {
    const result = transition('failed', 'completed', 'staged');
    expect(result.success).toBe(false);
  });

  it('rejects failed → plan_review in staged mode (not a retryable state)', () => {
    const result = transition('failed', 'plan_review', 'staged');
    expect(result.success).toBe(false);
  });

  it('rejects failed → planning in vibe mode (not in vibe table)', () => {
    const result = transition('failed', 'planning', 'vibe');
    expect(result.success).toBe(false);
  });
});
