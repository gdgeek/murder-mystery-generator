/**
 * 剧本生成参数配置相关类型定义
 * Requirements: 1.1, 1.5
 */

/** 剧本风格（侦探角色） */
export enum ScriptStyle {
  DETECTIVE = 'detective',   // 正统侦探 — 悬疑：严密逻辑推理，冷静克制，证据链环环相扣
  DRAMA = 'drama',           // 戏影侦探 — 搞笑：谐音梗、无厘头、喜剧反转
  DISCOVER = 'discover',     // 寻迹侦探 — 探索：多分支多结局，隐藏内容，高可重玩性
  DESTINY = 'destiny',       // 命运侦探 — 浪漫：命运交织，浪漫情感，宿命羁绊
  DREAM = 'dream',           // 幻梦侦探 — 叙诡：梦幻叙事，真假不分，叙述性诡计
  DIMENSION = 'dimension',   // 赛博侦探 — 科幻：全息投影、传送门、太空飞船等高科技设定
  DEATH = 'death',           // 幽冥侦探 — 恐怖：民俗/日式/哥特/克苏鲁恐怖，充满未知
}

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
  style: ScriptStyle;
  roundStructure: RoundStructure;
  specialSetting?: SpecialSetting;
}
