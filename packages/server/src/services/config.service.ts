/**
 * ConfigService - 剧本生成参数配置服务
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GameType,
  AgeGroup,
  SettingType,
  ScriptStyle,
  ScriptConfig,
  RoundStructure,
  RoundPhase,
  CreateConfigInput,
  ValidationResult,
  ValidationError,
} from '@murder-mystery/shared';
import { pool } from '../db/mysql';

/** Round mapping: durationHours → { totalRounds, summaryMinutes } */
const ROUND_MAP: Record<number, { totalRounds: number; summaryMinutes: number }> = {
  2: { totalRounds: 2, summaryMinutes: 20 },
  3: { totalRounds: 3, summaryMinutes: 30 },
  4: { totalRounds: 4, summaryMinutes: 30 },
  5: { totalRounds: 4, summaryMinutes: 40 },
  6: { totalRounds: 5, summaryMinutes: 40 },
};

const VALID_GAME_TYPES = Object.values(GameType) as string[];
const VALID_AGE_GROUPS = Object.values(AgeGroup) as string[];
const VALID_SETTING_TYPES = Object.values(SettingType) as string[];
const VALID_STYLES = Object.values(ScriptStyle) as string[];

export class ConfigService {
  /**
   * Validate config input. Returns specific error messages for each invalid field.
   * Requirement 1.4
   */
  validate(input: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (input === null || input === undefined || typeof input !== 'object') {
      return { valid: false, errors: [{ field: 'input', message: 'Input must be a non-null object', constraint: 'object' }] };
    }

    const data = input as Record<string, unknown>;

    // playerCount: integer 1-6
    if (data.playerCount === undefined || data.playerCount === null) {
      errors.push({ field: 'playerCount', message: 'playerCount is required', constraint: 'required' });
    } else if (typeof data.playerCount !== 'number' || !Number.isInteger(data.playerCount) || data.playerCount < 1 || data.playerCount > 6) {
      errors.push({ field: 'playerCount', message: 'playerCount must be an integer between 1 and 6', constraint: 'integer 1-6' });
    }

    // durationHours: integer 2-6
    if (data.durationHours === undefined || data.durationHours === null) {
      errors.push({ field: 'durationHours', message: 'durationHours is required', constraint: 'required' });
    } else if (typeof data.durationHours !== 'number' || !Number.isInteger(data.durationHours) || data.durationHours < 2 || data.durationHours > 6) {
      errors.push({ field: 'durationHours', message: 'durationHours must be an integer between 2 and 6', constraint: 'integer 2-6' });
    }

    // gameType: valid enum
    if (data.gameType === undefined || data.gameType === null) {
      errors.push({ field: 'gameType', message: 'gameType is required', constraint: 'required' });
    } else if (typeof data.gameType !== 'string' || !VALID_GAME_TYPES.includes(data.gameType)) {
      errors.push({ field: 'gameType', message: `gameType must be one of: ${VALID_GAME_TYPES.join(', ')}`, constraint: `enum: ${VALID_GAME_TYPES.join(', ')}` });
    }

    // ageGroup: valid enum
    if (data.ageGroup === undefined || data.ageGroup === null) {
      errors.push({ field: 'ageGroup', message: 'ageGroup is required', constraint: 'required' });
    } else if (typeof data.ageGroup !== 'string' || !VALID_AGE_GROUPS.includes(data.ageGroup)) {
      errors.push({ field: 'ageGroup', message: `ageGroup must be one of: ${VALID_AGE_GROUPS.join(', ')}`, constraint: `enum: ${VALID_AGE_GROUPS.join(', ')}` });
    }

    // restorationRatio: 0-100
    if (data.restorationRatio === undefined || data.restorationRatio === null) {
      errors.push({ field: 'restorationRatio', message: 'restorationRatio is required', constraint: 'required' });
    } else if (typeof data.restorationRatio !== 'number' || data.restorationRatio < 0 || data.restorationRatio > 100) {
      errors.push({ field: 'restorationRatio', message: 'restorationRatio must be a number between 0 and 100', constraint: '0-100' });
    }

    // deductionRatio: 0-100
    if (data.deductionRatio === undefined || data.deductionRatio === null) {
      errors.push({ field: 'deductionRatio', message: 'deductionRatio is required', constraint: 'required' });
    } else if (typeof data.deductionRatio !== 'number' || data.deductionRatio < 0 || data.deductionRatio > 100) {
      errors.push({ field: 'deductionRatio', message: 'deductionRatio must be a number between 0 and 100', constraint: '0-100' });
    }

    // restorationRatio + deductionRatio = 100
    if (
      typeof data.restorationRatio === 'number' && typeof data.deductionRatio === 'number' &&
      data.restorationRatio >= 0 && data.restorationRatio <= 100 &&
      data.deductionRatio >= 0 && data.deductionRatio <= 100 &&
      data.restorationRatio + data.deductionRatio !== 100
    ) {
      errors.push({ field: 'restorationRatio+deductionRatio', message: 'restorationRatio + deductionRatio must equal 100', constraint: 'sum=100' });
    }

    // era: non-empty string
    if (data.era === undefined || data.era === null) {
      errors.push({ field: 'era', message: 'era is required', constraint: 'required' });
    } else if (typeof data.era !== 'string' || data.era.trim().length === 0) {
      errors.push({ field: 'era', message: 'era must be a non-empty string', constraint: 'non-empty string' });
    }

    // location: non-empty string
    if (data.location === undefined || data.location === null) {
      errors.push({ field: 'location', message: 'location is required', constraint: 'required' });
    } else if (typeof data.location !== 'string' || data.location.trim().length === 0) {
      errors.push({ field: 'location', message: 'location must be a non-empty string', constraint: 'non-empty string' });
    }

    // theme: non-empty string
    if (data.theme === undefined || data.theme === null) {
      errors.push({ field: 'theme', message: 'theme is required', constraint: 'required' });
    } else if (typeof data.theme !== 'string' || data.theme.trim().length === 0) {
      errors.push({ field: 'theme', message: 'theme must be a non-empty string', constraint: 'non-empty string' });
    }

    // style: valid enum (optional, defaults to 'suspense')
    if (data.style !== undefined && data.style !== null) {
      if (typeof data.style !== 'string' || !VALID_STYLES.includes(data.style)) {
        errors.push({ field: 'style', message: `style must be one of: ${VALID_STYLES.join(', ')}`, constraint: `enum: ${VALID_STYLES.join(', ')}` });
      }
    }

    // specialSetting validation (only for shin_honkaku)
    if (data.gameType === GameType.SHIN_HONKAKU && data.specialSetting !== undefined && data.specialSetting !== null) {
      const ss = data.specialSetting as Record<string, unknown>;
      if (!Array.isArray(ss.settingTypes) || ss.settingTypes.length === 0) {
        errors.push({ field: 'specialSetting.settingTypes', message: 'settingTypes must be a non-empty array', constraint: 'non-empty array' });
      } else {
        for (const st of ss.settingTypes) {
          if (!VALID_SETTING_TYPES.includes(st as string)) {
            errors.push({ field: 'specialSetting.settingTypes', message: `Invalid setting type: ${st}. Must be one of: ${VALID_SETTING_TYPES.join(', ')}`, constraint: `enum: ${VALID_SETTING_TYPES.join(', ')}` });
            break;
          }
        }
      }
      if (typeof ss.settingDescription !== 'string' || (ss.settingDescription as string).trim().length === 0) {
        errors.push({ field: 'specialSetting.settingDescription', message: 'settingDescription must be a non-empty string', constraint: 'non-empty string' });
      }
      if (typeof ss.settingConstraints !== 'string' || (ss.settingConstraints as string).trim().length === 0) {
        errors.push({ field: 'specialSetting.settingConstraints', message: 'settingConstraints must be a non-empty string', constraint: 'non-empty string' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Auto-calculate round structure based on duration hours.
   * Requirement 1.6, 1.7
   */
  calculateRoundStructure(durationHours: number): RoundStructure {
    const mapping = ROUND_MAP[durationHours];
    if (!mapping) {
      throw new Error(`Unsupported durationHours: ${durationHours}. Must be 2-6.`);
    }

    const { totalRounds, summaryMinutes } = mapping;
    const finalVoteMinutes = 10;
    const revealMinutes = 10;

    const totalMinutes = durationHours * 60;
    const fixedMinutes = summaryMinutes + finalVoteMinutes + revealMinutes;
    const availableForRounds = totalMinutes - fixedMinutes;
    const perRoundBudget = Math.floor(availableForRounds / totalRounds);

    const rounds: RoundPhase[] = [];
    for (let i = 0; i < totalRounds; i++) {
      // Distribute time within allowed ranges
      // reading: 10-15, investigation: 15-20, discussion: 15-20
      // min total per round = 40, max = 55
      let reading = 10;
      let investigation = 15;
      let discussion = 15;
      let remaining = perRoundBudget - (reading + investigation + discussion);

      // Distribute remaining time evenly across phases, respecting max limits
      if (remaining > 0) {
        const addReading = Math.min(remaining, 15 - reading);
        reading += addReading;
        remaining -= addReading;
      }
      if (remaining > 0) {
        const addInvestigation = Math.min(remaining, 20 - investigation);
        investigation += addInvestigation;
        remaining -= addInvestigation;
      }
      if (remaining > 0) {
        const addDiscussion = Math.min(remaining, 20 - discussion);
        discussion += addDiscussion;
        remaining -= addDiscussion;
      }

      rounds.push({
        readingMinutes: reading,
        investigationMinutes: investigation,
        discussionMinutes: discussion,
      });
    }

    return {
      rounds,
      totalRounds,
      summaryMinutes,
      finalVoteMinutes,
      revealMinutes,
    };
  }

  /**
   * Create a new config: validate, calculate round structure, generate UUID, store in MySQL.
   * Requirement 1.5
   */
  async create(input: CreateConfigInput): Promise<ScriptConfig> {
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);
    }

    const id = uuidv4();
    const roundStructure = this.calculateRoundStructure(input.durationHours);
    const language = input.language || 'zh';
    const style = input.style || ScriptStyle.DETECTIVE;

    const config: ScriptConfig = {
      id,
      playerCount: input.playerCount,
      durationHours: input.durationHours,
      gameType: input.gameType,
      ageGroup: input.ageGroup,
      restorationRatio: input.restorationRatio,
      deductionRatio: input.deductionRatio,
      era: input.era,
      location: input.location,
      theme: input.theme,
      language,
      style,
      roundStructure,
    };

    // Add specialSetting for shin_honkaku
    if (input.gameType === GameType.SHIN_HONKAKU && input.specialSetting) {
      config.specialSetting = {
        settingTypes: input.specialSetting.settingTypes as unknown as SettingType[],
        settingDescription: input.specialSetting.settingDescription,
        settingConstraints: input.specialSetting.settingConstraints,
      };
    }

    await pool.execute(
      `INSERT INTO script_configs (id, player_count, duration_hours, game_type, age_group, restoration_ratio, deduction_ratio, era, location, theme, language, style, round_structure, special_setting)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.id,
        config.playerCount,
        config.durationHours,
        config.gameType,
        config.ageGroup,
        config.restorationRatio,
        config.deductionRatio,
        config.era,
        config.location,
        config.theme,
        config.language,
        config.style,
        JSON.stringify(config.roundStructure),
        config.specialSetting ? JSON.stringify(config.specialSetting) : null,
      ],
    );

    return config;
  }

  /**
   * Fetch a config by ID from MySQL.
   */
  async getById(id: string): Promise<ScriptConfig | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM script_configs WHERE id = ?',
      [id],
    );

    const results = rows as Record<string, unknown>[];
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id as string,
      playerCount: row.player_count as number,
      durationHours: row.duration_hours as number,
      gameType: row.game_type as GameType,
      ageGroup: row.age_group as AgeGroup,
      restorationRatio: row.restoration_ratio as number,
      deductionRatio: row.deduction_ratio as number,
      era: row.era as string,
      location: row.location as string,
      theme: row.theme as string,
      language: (row.language as string) || 'zh',
      style: (row.style as ScriptStyle) || ScriptStyle.DETECTIVE,
      roundStructure: typeof row.round_structure === 'string'
        ? JSON.parse(row.round_structure)
        : row.round_structure as RoundStructure,
      specialSetting: row.special_setting
        ? (typeof row.special_setting === 'string'
          ? JSON.parse(row.special_setting)
          : row.special_setting)
        : undefined,
    } as ScriptConfig;
  }
}
