/**
 * 分阶段剧本创作工作流相关类型定义
 * Requirements: 1.1, 1.6, 2.1, 3.2, 4.2, 7.1, 7.4, 7.5
 */

import type { AiConfigMeta } from './ai-config';
import type { TokenUsage } from './script';

// ─── 枚举与联合类型 ───

/** 创作模式 */
export type AuthoringMode = 'staged' | 'vibe';

/** 会话状态 */
export type SessionState =
  | 'draft' | 'planning' | 'plan_review'
  | 'designing' | 'design_review'
  | 'executing' | 'chapter_review'
  | 'completed' | 'generating' | 'failed';

/** 阶段名称 */
export type PhaseName = 'plan' | 'outline' | 'chapter';

/** 章节类型 */
export type ChapterType = 'dm_handbook' | 'player_handbook' | 'materials' | 'branch_structure';

/** AI 生成元信息（附加到每个生成步骤） */
export interface AiStepMeta {
  provider: string;
  model: string;
  tokenUsage: TokenUsage;
  responseTimeMs: number;
  generatedAt: Date;
}

// ─── 企划书 ───

/** 企划书 */
export interface ScriptPlan {
  /** 剧本标题（吸引人的、有悬念感的标题） */
  title?: string;
  worldOverview: string;
  characters: {
    name: string;
    role: string;
    relationshipSketch: string;
  }[];
  coreTrickDirection: string;
  themeTone: string;
  eraAtmosphere: string;
  /** 新本格独特设定（仅 shin_honkaku 类型生成） */
  specialSetting?: {
    settingName: string;
    settingDescription: string;
    settingRules: string[];
    impactOnDeduction: string;
  };
}

// ─── 剧本大纲 ───

/** 剧本大纲 */
export interface ScriptOutline {
  detailedTimeline: {
    time: string;
    event: string;
    involvedCharacters: string[];
  }[];
  characterRelationships: {
    characterA: string;
    characterB: string;
    relationship: string;
  }[];
  trickMechanism: string;
  clueChainDesign: {
    clueId: string;
    description: string;
    leadsTo: string[];
  }[];
  branchSkeleton: {
    nodeId: string;
    description: string;
    options: string[];
    endingDirections: string[];
  }[];
  roundFlowSummary: {
    roundIndex: number;
    focus: string;
    keyEvents: string[];
  }[];
}

// ─── 章节 ───

/** 章节 */
export interface Chapter {
  index: number;
  type: ChapterType;
  characterId?: string;       // 仅 player_handbook 类型
  content: unknown;           // DMHandbook | PlayerHandbook | Material[] | BranchStructure
  generatedAt: Date;
  aiMeta?: AiStepMeta;       // AI 生成元信息
}

// ─── 编辑与产出物 ───

/** 作者编辑记录 */
export interface AuthorEdit {
  editedAt: Date;
  originalContent: unknown;
  editedContent: unknown;
}

/** 阶段产出物 */
export interface PhaseOutput {
  phase: PhaseName;
  llmOriginal: unknown;       // LLM 原始生成内容
  authorEdited?: unknown;     // 作者编辑后版本（若有编辑）
  authorNotes?: string;       // 作者附加备注
  edits: AuthorEdit[];        // 编辑历史
  approved: boolean;
  approvedAt?: Date;
  generatedAt: Date;
  aiMeta?: AiStepMeta;       // AI 生成元信息
}

// ─── 筛选与失败信息 ───

/** 会话筛选条件 */
export interface SessionFilters {
  configId?: string;
  state?: SessionState;
  mode?: AuthoringMode;
  limit?: number;
  offset?: number;
}

/** 失败信息 */
export interface FailureInfo {
  phase: PhaseName | 'generating';
  error: string;
  failedAt: Date;
  retryFromState: SessionState;
}

// ─── 创作会话 ───

/** 并行批次信息 */
export interface ParallelBatch {
  chapterIndices: number[];       // 本批次包含的章节索引
  completedIndices: number[];     // 已生成完成的章节索引
  failedIndices: number[];        // 生成失败的章节索引
  reviewedIndices: number[];      // 已审阅通过的章节索引
}

/** 创作会话 */
export interface AuthoringSession {
  id: string;
  configId: string;
  mode: AuthoringMode;
  state: SessionState;
  planOutput?: PhaseOutput;
  outlineOutput?: PhaseOutput;
  chapters: Chapter[];
  chapterEdits: Record<number, AuthorEdit[]>;
  currentChapterIndex: number;
  totalChapters: number;
  parallelBatch?: ParallelBatch;  // 当前并行生成批次
  scriptId?: string;              // 完成后关联的 Script ID
  aiConfigMeta?: AiConfigMeta;  // 临时 AI 配置元信息（不含 apiKey）
  lastStepTokens?: TokenUsage;  // 最近一次 LLM 调用的 token 用量
  failureInfo?: FailureInfo;
  createdAt: Date;
  updatedAt: Date;
}
