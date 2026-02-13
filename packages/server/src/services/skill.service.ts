/**
 * SkillService - Skill库管理服务
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { GameType, SkillCategory, SkillTemplate } from '@murder-mystery/shared';

import commonSkills from '../skills/common.json';
import honkakuSkills from '../skills/honkaku.json';
import shinHonkakuSkills from '../skills/shin-honkaku.json';
import henkakuSkills from '../skills/henkaku.json';

/** All skill templates loaded from JSON files */
const ALL_TEMPLATES: SkillTemplate[] = [
  ...commonSkills,
  ...honkakuSkills,
  ...shinHonkakuSkills,
  ...henkakuSkills,
] as SkillTemplate[];

export class SkillService {
  private templates: SkillTemplate[] = ALL_TEMPLATES;

  /** Get all loaded templates */
  getAllTemplates(): SkillTemplate[] {
    return [...this.templates];
  }

  /** Get templates by category. Requirement 2.2 */
  async getByCategory(category: SkillCategory): Promise<SkillTemplate[]> {
    return this.templates.filter(t => t.category === category);
  }

  /**
   * Get templates matching a game type, sorted by priority descending.
   * Requirements 2.3, 2.4, 2.5
   */
  async getByGameType(gameType: GameType): Promise<SkillTemplate[]> {
    return this.templates
      .filter(t => t.gameTypes.includes(gameType))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get templates for generation: filtered by game type AND categories, sorted by priority.
   */
  async getForGeneration(gameType: GameType, categories: SkillCategory[]): Promise<SkillTemplate[]> {
    return this.templates
      .filter(t => t.gameTypes.includes(gameType) && categories.includes(t.category))
      .sort((a, b) => b.priority - a.priority);
  }

  /** Serialize a SkillTemplate to JSON string. Requirement 2.6, 2.7 */
  serialize(template: SkillTemplate): string {
    return JSON.stringify(template);
  }

  /** Deserialize a JSON string to SkillTemplate. Requirement 2.6, 2.7 */
  deserialize(json: string): SkillTemplate {
    return JSON.parse(json) as SkillTemplate;
  }
}
