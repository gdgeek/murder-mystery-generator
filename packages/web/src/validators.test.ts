import { describe, it, expect } from 'vitest';
import { validateConfigForm, validateSpecialSetting } from './validators';
import { GameType, AgeGroup, SettingType } from '@murder-mystery/shared';
import type { CreateConfigInput, SpecialSetting } from '@murder-mystery/shared';

/** Helper: returns a fully valid config input */
function validInput(): Partial<CreateConfigInput> {
  return {
    playerCount: 4,
    durationHours: 3,
    gameType: GameType.HONKAKU,
    ageGroup: AgeGroup.ADULT,
    restorationRatio: 60,
    era: '现代',
    location: '别墅',
    theme: '复仇',
  };
}

/** Helper: returns a valid shin_honkaku input with specialSetting */
function validShinHonkakuInput(): Partial<CreateConfigInput> {
  return {
    ...validInput(),
    gameType: GameType.SHIN_HONKAKU,
    specialSetting: {
      settingTypes: [SettingType.SUPERPOWER],
      settingDescription: '超能力设定',
      settingConstraints: '',
    },
  };
}

describe('validateConfigForm', () => {
  it('returns valid for a correct input', () => {
    const result = validateConfigForm(validInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for shin_honkaku with valid specialSetting', () => {
    const result = validateConfigForm(validShinHonkakuInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // playerCount validation
  it('rejects playerCount = 0', () => {
    const result = validateConfigForm({ ...validInput(), playerCount: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'playerCount', message: '玩家人数必须为 1-6 的整数' });
  });

  it('rejects playerCount = 7', () => {
    const result = validateConfigForm({ ...validInput(), playerCount: 7 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'playerCount', message: '玩家人数必须为 1-6 的整数' });
  });

  it('rejects non-integer playerCount', () => {
    const result = validateConfigForm({ ...validInput(), playerCount: 3.5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'playerCount', message: '玩家人数必须为 1-6 的整数' });
  });

  it('rejects missing playerCount', () => {
    const input = validInput();
    delete input.playerCount;
    const result = validateConfigForm(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'playerCount', message: '玩家人数必须为 1-6 的整数' });
  });

  // durationHours validation
  it('rejects durationHours = 1', () => {
    const result = validateConfigForm({ ...validInput(), durationHours: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'durationHours', message: '游戏时长必须为 2-6 的整数' });
  });

  it('rejects durationHours = 7', () => {
    const result = validateConfigForm({ ...validInput(), durationHours: 7 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'durationHours', message: '游戏时长必须为 2-6 的整数' });
  });

  // gameType validation
  it('rejects invalid gameType', () => {
    const result = validateConfigForm({ ...validInput(), gameType: 'invalid' as GameType });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'gameType', message: '请选择游戏类型' });
  });

  it('rejects missing gameType', () => {
    const input = validInput();
    delete input.gameType;
    const result = validateConfigForm(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'gameType', message: '请选择游戏类型' });
  });

  // ageGroup validation
  it('rejects invalid ageGroup', () => {
    const result = validateConfigForm({ ...validInput(), ageGroup: 'toddler' as AgeGroup });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'ageGroup', message: '请选择目标年龄段' });
  });

  // restorationRatio validation
  it('rejects restorationRatio = -1', () => {
    const result = validateConfigForm({ ...validInput(), restorationRatio: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'restorationRatio', message: '还原比例必须为 0-100 的整数' });
  });

  it('rejects restorationRatio = 101', () => {
    const result = validateConfigForm({ ...validInput(), restorationRatio: 101 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'restorationRatio', message: '还原比例必须为 0-100 的整数' });
  });

  it('rejects non-integer restorationRatio', () => {
    const result = validateConfigForm({ ...validInput(), restorationRatio: 50.5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'restorationRatio', message: '还原比例必须为 0-100 的整数' });
  });

  // string field validation
  it('rejects empty era', () => {
    const result = validateConfigForm({ ...validInput(), era: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'era', message: '请输入时代背景' });
  });

  it('rejects whitespace-only era', () => {
    const result = validateConfigForm({ ...validInput(), era: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'era', message: '请输入时代背景' });
  });

  it('rejects empty location', () => {
    const result = validateConfigForm({ ...validInput(), location: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'location', message: '请输入地点' });
  });

  it('rejects empty theme', () => {
    const result = validateConfigForm({ ...validInput(), theme: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'theme', message: '请输入主题' });
  });

  // specialSetting conditional validation
  it('does NOT validate specialSetting when gameType is honkaku', () => {
    const input = { ...validInput(), gameType: GameType.HONKAKU, specialSetting: undefined };
    const result = validateConfigForm(input);
    expect(result.valid).toBe(true);
  });

  it('does NOT validate specialSetting when gameType is henkaku', () => {
    const input = { ...validInput(), gameType: GameType.HENKAKU, specialSetting: undefined };
    const result = validateConfigForm(input);
    expect(result.valid).toBe(true);
  });

  it('validates specialSetting when gameType is shin_honkaku', () => {
    const input: Partial<CreateConfigInput> = {
      ...validInput(),
      gameType: GameType.SHIN_HONKAKU,
      // no specialSetting provided
    };
    const result = validateConfigForm(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
    expect(result.errors).toContainEqual({ field: 'settingDescription', message: '请输入设定描述' });
  });

  it('rejects shin_honkaku with empty settingTypes', () => {
    const input: Partial<CreateConfigInput> = {
      ...validInput(),
      gameType: GameType.SHIN_HONKAKU,
      specialSetting: { settingTypes: [], settingDescription: '描述', settingConstraints: '' },
    };
    const result = validateConfigForm(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
  });

  it('rejects shin_honkaku with empty settingDescription', () => {
    const input: Partial<CreateConfigInput> = {
      ...validInput(),
      gameType: GameType.SHIN_HONKAKU,
      specialSetting: { settingTypes: [SettingType.FANTASY], settingDescription: '', settingConstraints: '' },
    };
    const result = validateConfigForm(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingDescription', message: '请输入设定描述' });
  });

  it('collects multiple errors at once', () => {
    const result = validateConfigForm({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(8);
  });

  // boundary values that should pass
  it('accepts playerCount = 1', () => {
    const result = validateConfigForm({ ...validInput(), playerCount: 1 });
    expect(result.valid).toBe(true);
  });

  it('accepts playerCount = 6', () => {
    const result = validateConfigForm({ ...validInput(), playerCount: 6 });
    expect(result.valid).toBe(true);
  });

  it('accepts restorationRatio = 0', () => {
    const result = validateConfigForm({ ...validInput(), restorationRatio: 0 });
    expect(result.valid).toBe(true);
  });

  it('accepts restorationRatio = 100', () => {
    const result = validateConfigForm({ ...validInput(), restorationRatio: 100 });
    expect(result.valid).toBe(true);
  });
});

describe('validateSpecialSetting', () => {
  it('returns valid for correct input', () => {
    const result = validateSpecialSetting({
      settingTypes: [SettingType.SUPERPOWER],
      settingDescription: '超能力设定',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty settingTypes', () => {
    const result = validateSpecialSetting({ settingTypes: [], settingDescription: '描述' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
  });

  it('rejects missing settingTypes', () => {
    const result = validateSpecialSetting({ settingDescription: '描述' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingTypes', message: '请至少选择一种特殊设定类型' });
  });

  it('rejects empty settingDescription', () => {
    const result = validateSpecialSetting({ settingTypes: [SettingType.FANTASY], settingDescription: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingDescription', message: '请输入设定描述' });
  });

  it('rejects missing settingDescription', () => {
    const result = validateSpecialSetting({ settingTypes: [SettingType.FANTASY] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: 'settingDescription', message: '请输入设定描述' });
  });

  it('accepts multiple valid settingTypes', () => {
    const result = validateSpecialSetting({
      settingTypes: [SettingType.SUPERPOWER, SettingType.FANTASY, SettingType.SPECIAL_RULE],
      settingDescription: '多种设定',
    });
    expect(result.valid).toBe(true);
  });
});
