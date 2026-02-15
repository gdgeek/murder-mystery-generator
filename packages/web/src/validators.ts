/**
 * 表单校验器 - 纯函数模块
 * 校验规则与后端 ConfigService.validate 对齐
 * Requirements: 2.3, 2.4, 3.4
 */

import {
  GameType,
  AgeGroup,
  SettingType,
  ScriptStyle,
} from '@gdgeek/murder-mystery-shared';
import type { CreateConfigInput, SpecialSetting } from '@gdgeek/murder-mystery-shared';

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

const VALID_GAME_TYPES = Object.values(GameType);
const VALID_AGE_GROUPS = Object.values(AgeGroup);
const VALID_SETTING_TYPES = Object.values(SettingType);
const VALID_STYLES = Object.values(ScriptStyle);

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 校验特殊设定字段（settingTypes + settingDescription）
 */
export function validateSpecialSetting(data: Partial<SpecialSetting>): ValidationResult {
  const errors: FieldError[] = [];

  if (!Array.isArray(data.settingTypes) || data.settingTypes.length === 0) {
    errors.push({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
  } else {
    for (const st of data.settingTypes) {
      if (!VALID_SETTING_TYPES.includes(st as SettingType)) {
        errors.push({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
        break;
      }
    }
  }

  if (!isNonEmptyString(data.settingDescription)) {
    errors.push({ field: 'settingDescription', message: '请输入设定描述' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 校验配置表单所有字段
 * 当 gameType 为 shin_honkaku 时额外校验 specialSetting
 */
export function validateConfigForm(data: Partial<CreateConfigInput>): ValidationResult {
  const errors: FieldError[] = [];

  // playerCount: 1-6 整数
  if (!isInteger(data.playerCount) || data.playerCount! < 1 || data.playerCount! > 6) {
    errors.push({ field: 'playerCount', message: '玩家人数必须为 1-6 的整数' });
  }

  // durationHours: 2-6 整数
  if (!isInteger(data.durationHours) || data.durationHours! < 2 || data.durationHours! > 6) {
    errors.push({ field: 'durationHours', message: '游戏时长必须为 2-6 的整数' });
  }

  // gameType: 有效枚举值
  if (!isNonEmptyString(data.gameType) || !VALID_GAME_TYPES.includes(data.gameType as GameType)) {
    errors.push({ field: 'gameType', message: '请选择游戏类型' });
  }

  // ageGroup: 有效枚举值
  if (!isNonEmptyString(data.ageGroup) || !VALID_AGE_GROUPS.includes(data.ageGroup as AgeGroup)) {
    errors.push({ field: 'ageGroup', message: '请选择目标年龄段' });
  }

  // restorationRatio: 0-100 整数
  if (!isInteger(data.restorationRatio) || data.restorationRatio! < 0 || data.restorationRatio! > 100) {
    errors.push({ field: 'restorationRatio', message: '还原比例必须为 0-100 的整数' });
  }

  // era: 非空字符串
  if (!isNonEmptyString(data.era)) {
    errors.push({ field: 'era', message: '请输入时代背景' });
  }

  // location: 非空字符串
  if (!isNonEmptyString(data.location)) {
    errors.push({ field: 'location', message: '请输入地点' });
  }

  // theme: 非空字符串
  if (!isNonEmptyString(data.theme)) {
    errors.push({ field: 'theme', message: '请输入主题' });
  }

  // style: 有效枚举值（可选，但如果提供则必须有效）
  if (data.style && !VALID_STYLES.includes(data.style as ScriptStyle)) {
    errors.push({ field: 'style', message: '请选择有效的剧本风格' });
  }

  // 当 gameType 为 shin_honkaku 时额外校验 specialSetting
  if (data.gameType === GameType.SHIN_HONKAKU) {
    const ss = data.specialSetting ?? {};
    const ssResult = validateSpecialSetting(ss as Partial<SpecialSetting>);
    for (const err of ssResult.errors) {
      errors.push(err);
    }
  }

  return { valid: errors.length === 0, errors };
}
