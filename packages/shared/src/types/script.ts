/**
 * 剧本内容相关类型定义
 * Requirements: 2.1, 3.1, 4.1, 5.1, 6.1
 */

import { AgeGroup, GameType, ScriptConfig, ScriptStyle } from './config';
import { Tag } from './tag';

// ─── Skill 模板 ───

/** Skill 类别 */
export enum SkillCategory {
  CHARACTER_DESIGN = 'character_design',
  CLUE_DESIGN = 'clue_design',
  TIMELINE = 'timeline',
  MOTIVE = 'motive',
  TRICK = 'trick',
  RESTORATION = 'restoration',
  DEDUCTION_CHAIN = 'deduction_chain',
}

/** 任务类型枚举 */
export enum TaskType {
  PLANNING = 'planning',
  DESIGN = 'design',
  CHAPTER_GENERATION = 'chapter_generation',
  ONE_SHOT_GENERATION = 'one_shot_generation',
  OPTIMIZATION = 'optimization',
  DEFAULT = 'default',
}

/** 支持的语言 */
export type SupportedLanguage = 'en-US' | 'zh-CN';

/** Skill 模板 */
export interface SkillTemplate {
  id: string;
  category: SkillCategory;
  name: string;
  description: string;
  gameTypes: GameType[];
  priority: number;
  content: string;
}

// ─── LLM 适配器 ───

/** LLM 请求 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  taskType?: TaskType;
  language?: SupportedLanguage;
}

/** LLM 响应 */
export interface LLMResponse {
  content: string;
  tokenUsage: TokenUsage;
  responseTimeMs: number;
}

/** Token 用量 */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/** LLM 重试配置 */
export const LLM_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
} as const;

// ─── DM 手册 ───

/** 角色摘要 */
export interface CharacterSummary {
  characterId: string;
  characterName: string;
  role: string;
  description: string;
}

/** 时间线事件 */
export interface TimelineEvent {
  time: string;
  event: string;
  involvedCharacterIds: string[];
}

/** 线索分发条目 */
export interface ClueDistributionEntry {
  clueId: string;
  roundIndex: number;
  targetCharacterId: string;
  condition: string;
  timing: string;
}

/** 轮次指引 */
export interface RoundGuide {
  roundIndex: number;
  objectives: string;
  keyEvents: string[];
  dmNotes: string;
}

/** 分支决策点 */
export interface BranchDecisionPoint {
  nodeId: string;
  roundIndex: number;
  voteQuestion: string;
  options: { optionId: string; text: string; outcome: string }[];
}

/** 结局描述 */
export interface EndingDescription {
  endingId: string;
  name: string;
  triggerConditions: string;
  narrative: string;
  playerEndingSummaries: { characterId: string; ending: string }[];
}

/** 判定规则 */
export interface JudgingRules {
  winConditions: string;
  scoringCriteria: string;
}

/** DM 手册 */
export interface DMHandbook {
  overview: string;
  characters: CharacterSummary[];
  timeline: TimelineEvent[];
  clueDistribution: ClueDistributionEntry[];
  roundGuides: RoundGuide[];
  branchDecisionPoints: BranchDecisionPoint[];
  endings: EndingDescription[];
  truthReveal: string;
  judgingRules: JudgingRules;
}

// ─── 玩家手册 ───

/** 角色关系 */
export interface CharacterRelationship {
  targetCharacterId: string;
  targetCharacterName: string;
  relationship: string;
}

/** 轮次行动 */
export interface RoundAction {
  roundIndex: number;
  instructions: string;
  hints: string[];
}

/** 玩家手册 */
export interface PlayerHandbook {
  characterId: string;
  characterName: string;
  backgroundStory: string;
  primaryGoal: string;
  secondaryGoals: string[];
  relationships: CharacterRelationship[];
  knownClues: string[];
  roundActions: RoundAction[];
  secrets: string[];
}

// ─── 游戏物料 ───

/** 物料类型 */
export enum MaterialType {
  CLUE_CARD = 'clue_card',
  PROP_CARD = 'prop_card',
  VOTE_CARD = 'vote_card',
  SCENE_CARD = 'scene_card',
}

/** 游戏物料 */
export interface Material {
  id: string;
  type: MaterialType;
  content: string;
  associatedCharacterId?: string;
  metadata: Record<string, unknown>;
}

/** 线索卡 */
export interface ClueCard extends Material {
  type: MaterialType.CLUE_CARD;
  clueId: string;
  associatedCharacterId: string;
}

// ─── 分支结构 ───

/** 投票选项 */
export interface VoteOption {
  id: string;
  text: string;
  nextNodeId: string | null;
  endingId: string | null;
}

/** 分支节点 */
export interface BranchNode {
  id: string;
  roundIndex: number;
  description: string;
  voteQuestion: string;
  options: VoteOption[];
}

/** 分支边 */
export interface BranchEdge {
  fromNodeId: string;
  toNodeId: string | null;
  toEndingId: string | null;
  optionId: string;
}

/** 触发条件 */
export interface TriggerCondition {
  type: string;
  value: string;
}

/** 玩家结局 */
export interface PlayerEnding {
  characterId: string;
  ending: string;
}

/** 结局 */
export interface Ending {
  id: string;
  name: string;
  triggerConditions: TriggerCondition[];
  narrative: string;
  playerEndings: PlayerEnding[];
}

/** 分支结构 */
export interface BranchStructure {
  nodes: BranchNode[];
  edges: BranchEdge[];
  endings: Ending[];
}

// ─── 剧本 ───

/** 剧本状态 */
export enum ScriptStatus {
  GENERATING = 'generating',
  READY = 'ready',
  OPTIMIZING = 'optimizing',
}

/** 剧本筛选条件 */
export interface ScriptFilters {
  tagIds?: string[];
  configId?: string;
  status?: ScriptStatus;
  limit?: number;
  offset?: number;
}

/** 剧本 */
export interface Script {
  id: string;
  version: string;
  configId: string;
  config: ScriptConfig;
  title: string;
  dmHandbook: DMHandbook;
  playerHandbooks: PlayerHandbook[];
  materials: Material[];
  branchStructure: BranchStructure;
  tags: Tag[];
  parentVersionId?: string;
  status: ScriptStatus;
  aiProvider?: string;
  aiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── 校验 ───

/** 校验错误 */
export interface ValidationError {
  field: string;
  message: string;
  constraint: string;
}

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** 创建配置输入 */
export interface CreateConfigInput {
  playerCount: number;
  durationHours: number;
  gameType: GameType;
  ageGroup: AgeGroup;
  restorationRatio: number;
  deductionRatio: number;
  era: string;
  location: string;
  theme: string;
  language?: string;
  style?: ScriptStyle;
  specialSetting?: {
    settingTypes: string[];
    settingDescription: string;
    settingConstraints: string;
  };
}

// ─── LLM 错误 ───

/** LLM 错误 */
export class LLMError extends Error {
  statusCode: number | undefined;
  retryAttempts: number;
  provider: string;
  isRetryable: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      retryAttempts: number;
      provider: string;
      isRetryable: boolean;
    },
  ) {
    super(message);
    this.name = 'LLMError';
    this.statusCode = options.statusCode;
    this.retryAttempts = options.retryAttempts;
    this.provider = options.provider;
    this.isRetryable = options.isRetryable;
  }
}
