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
  playableStructure?: PlayableStructure;
  characterProfiles?: FullCharacterProfile[];
  generationMode?: GenerationMode;
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

// ─── 可游玩结构（Playable Structure） ───

/** 交流建议 */
export interface ActDiscussion {
  topics: string[];
  guidingQuestions: string[];
  suggestedMinutes: number;
}

/** 幕投票选项 */
export interface ActVoteOption {
  id: string;
  text: string;
  impact: string;
  nextNodeId?: string;
}

/** 幕投票 */
export interface ActVote {
  question: string;
  options: ActVoteOption[];
}

/** 角色介绍（序幕用） */
export interface CharacterIntro {
  characterId: string;
  characterName: string;
  publicDescription: string;
}

/** 序幕 */
export interface Prologue {
  backgroundNarrative: string;
  worldSetting: string;
  characterIntros: CharacterIntro[];
}

/** 幕 */
export interface Act {
  actIndex: number;
  title: string;
  narrative: string;
  objectives: string[];
  clueIds: string[];
  discussion: ActDiscussion;
  vote: ActVote;
}

/** 终幕结局 */
export interface FinaleEnding {
  endingId: string;
  name: string;
  triggerCondition: string;
  narrative: string;
  playerEndingSummaries: { characterId: string; ending: string }[];
}

/** 终幕 */
export interface Finale {
  finalVote: ActVote;
  truthReveal: string;
  endings: FinaleEnding[];
}

/** 线索分发指令 */
export interface PlayableClueDistributionInstruction {
  clueId: string;
  targetCharacterId: string;
  condition: string;
}

/** DM幕指引 */
export interface ActGuide {
  actIndex: number;
  readAloudText: string;
  keyEventHints: string[];
  clueDistributionInstructions: PlayableClueDistributionInstruction[];
  discussionGuidance: string;
  voteHostingNotes: string;
  dmPrivateNotes: string;
}

/** 序幕DM指引 */
export interface PrologueGuide {
  openingScript: string;
  characterAssignmentNotes: string;
  rulesIntroduction: string;
}

/** 终幕DM指引 */
export interface FinaleGuide {
  finalVoteHostingFlow: string;
  truthRevealScript: string;
  endingJudgmentNotes: string;
}

/** 玩家幕内容 */
export interface PlayerActContent {
  actIndex: number;
  characterId: string;
  personalNarrative: string;
  objectives: string[];
  clueHints: string[];
  discussionSuggestions: string[];
  secretInfo: string;
}

/** 玩家序幕内容 */
export interface PlayerPrologueContent {
  characterId: string;
  backgroundStory: string;
  relationships: CharacterRelationship[];
  initialKnowledge: string[];
}

/** 玩家终幕内容 */
export interface PlayerFinaleContent {
  characterId: string;
  closingStatementGuide: string;
  votingSuggestion: string;
}

/** DM可游玩手册 */
export interface PlayableDMHandbook {
  prologueGuide: PrologueGuide;
  actGuides: ActGuide[];
  finaleGuide: FinaleGuide;
}

/** 玩家可游玩手册 */
export interface PlayablePlayerHandbook {
  characterId: string;
  characterName: string;
  prologueContent: PlayerPrologueContent;
  actContents: PlayerActContent[];
  finaleContent: PlayerFinaleContent;
}

/** 可游玩结构 */
export interface PlayableStructure {
  prologue: Prologue;
  acts: Act[];
  finale: Finale;
  dmHandbook: PlayableDMHandbook;
  playerHandbooks: PlayablePlayerHandbook[];
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

// ─── 生成模式 ───

/** 生成模式 */
export type GenerationMode = 'oneshot' | 'character_first';

// ─── 角色设定 ───

/** 关系类型 */
export type RelationshipType =
  | 'ally'
  | 'rival'
  | 'lover'
  | 'family'
  | 'colleague'
  | 'stranger'
  | 'enemy'
  | 'mentor'
  | 'suspect';

/** 叙事功能定位 */
export type NarrativeRole =
  | 'murderer'
  | 'detective'
  | 'witness'
  | 'suspect'
  | 'victim'
  | 'accomplice'
  | 'bystander';

/** 血型 */
export type BloodType = 'A' | 'B' | 'O' | 'AB';

/** 角色类型（剧本中的角色定位，非角色库固有属性） */
export type CharacterType = 'player' | 'npc';

/** 星座 */
export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

/** 角色关系（扩展版） */
export interface CharacterProfileRelationship {
  targetCharacterId: string;
  targetCharacterName: string;
  relationshipType: RelationshipType;
  description: string;
}

/**
 * 角色设定（通用角色库）
 * 存储与剧本无关的通用角色属性，便于跨剧本复用。
 * 性格、外貌、能力等描述应保持通用，不涉及具体剧情。
 */
export interface CharacterProfile {
  characterId: string;
  characterName: string;
  gender: string;
  zodiacSign?: ZodiacSign;
  bloodType: BloodType;
  mbtiType: string;
  /** 通用性格描述（不涉及具体剧情） */
  personality: string;
  /** 通用外貌描述（不涉及具体剧情） */
  appearance: string;
  /** 通用能力/特质（不涉及具体剧情） */
  specialTraits?: string[];
}

/**
 * 剧本角色绑定（剧本关联表）
 * 存储角色在某个剧本中的特定设定：类型、背景故事、动机、秘密、关系等。
 */
export interface ScriptCharacterBinding {
  characterId: string;
  characterName: string;
  characterType: CharacterType;
  backgroundStory: string;
  primaryMotivation: string;
  secrets: string[];
  relationships: CharacterProfileRelationship[];
  secondaryMotivations?: string[];
  narrativeRole?: NarrativeRole;
}

/**
 * 完整角色设定（生成阶段使用）
 * 合并通用角色属性 + 剧本关联属性，用于 LLM 生成流程。
 */
export interface FullCharacterProfile extends CharacterProfile, ScriptCharacterBinding {}

/** 角色草稿状态 */
export type CharacterDraftStatus = 'pending_review' | 'confirmed';

/** 角色草稿 */
export interface CharacterDraft {
  jobId: string;
  configId: string;
  characters: FullCharacterProfile[];
  status: CharacterDraftStatus;
  createdAt: string;
  updatedAt: string;
}
