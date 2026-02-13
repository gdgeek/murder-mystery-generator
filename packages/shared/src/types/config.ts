/**
 * 剧本生成参数配置相关类型定义
 * Requirements: 1.1, 1.5
 */

/** 游戏类型 */
export enum GameType {
  HONKAKU = 'honkaku',
  SHIN_HONKAKU = 'shin_honkaku',
  HENKAKU = 'henkaku',
}

/** 目标年龄段 */
export enum AgeGroup {
  ELEMENTARY = 'elementary',
  MIDDLE_SCHOOL = 'middle_school',
  COLLEGE = 'college',
  ADULT = 'adult',
}

/** 新本格特殊设定类型 */
export enum SettingType {
  SUPERPOWER = 'setting_superpower',
  FANTASY = 'setting_fantasy',
  SPECIAL_RULE = 'setting_special_rule',
  NARRATIVE_TRICK = 'setting_narrative_trick',
}

/** 特殊设定配置（仅新本格使用） */
export interface SpecialSetting {
  settingTypes: SettingType[];
  settingDescription: string;
  settingConstraints: string;
}

/** 轮次阶段时间 */
export interface RoundPhase {
  readingMinutes: number;     // 10-15
  investigationMinutes: number; // 15-20
  discussionMinutes: number;  // 15-20
}

/** 轮次结构 */
export interface RoundStructure {
  rounds: RoundPhase[];
  totalRounds: number;
  summaryMinutes: number;
  finalVoteMinutes: number;
  revealMinutes: number;
}

/** 剧本生成配置 */
export interface ScriptConfig {
  id: string;
  playerCount: number;
  durationHours: number;
  gameType: GameType;
  ageGroup: AgeGroup;
  restorationRatio: number;
  deductionRatio: number;
  era: string;
  location: string;
  theme: string;
  language: string;
  roundStructure: RoundStructure;
  specialSetting?: SpecialSetting;
}
