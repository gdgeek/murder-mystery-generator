/**
 * TagService - 标签系统服务
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Tag,
  TagCategory,
  ScriptTag,
  Script,
  ScriptConfig,
  GameType,
  AgeGroup,
} from '@murder-mystery/shared';
import { pool } from '../db/mysql';
import { redis } from '../db/redis';

const POPULAR_TAGS_KEY = 'tags:popular';
const POPULAR_TAGS_TTL = 300; // 5 minutes

export class TagService {
  /**
   * Auto-generate tags from script config.
   * Requirement 7.1
   */
  async autoGenerateTags(script: Script): Promise<Tag[]> {
    const config = script.config;
    const tagDefs: { name: string; category: TagCategory }[] = [
      { name: this.gameTypeLabel(config.gameType), category: TagCategory.GAME_TYPE },
      { name: this.ageGroupLabel(config.ageGroup), category: TagCategory.AGE_GROUP },
      { name: `${config.playerCount}人本`, category: TagCategory.PLAYER_COUNT },
      { name: config.era, category: TagCategory.ERA },
      { name: config.theme, category: TagCategory.THEME },
    ];

    const tags: Tag[] = [];
    for (const def of tagDefs) {
      const tag = await this.findOrCreateTag(def.name, def.category);
      tags.push(tag);
      await this.linkTag(script.id, tag.id, true);
    }

    return tags;
  }

  /**
   * Add a custom tag to a script.
   * Requirement 7.2
   */
  async addCustomTag(scriptId: string, tagName: string): Promise<Tag> {
    const tag = await this.findOrCreateTag(tagName, TagCategory.CUSTOM);
    await this.linkTag(scriptId, tag.id, false);
    return tag;
  }

  /** Remove a tag association from a script */
  async removeTag(scriptId: string, tagId: string): Promise<void> {
    await pool.execute('DELETE FROM script_tags WHERE script_id = ? AND tag_id = ?', [scriptId, tagId]);
  }

  /** Get all tags for a script */
  async getScriptTags(scriptId: string): Promise<Tag[]> {
    const [rows] = await pool.execute(
      'SELECT t.* FROM tags t INNER JOIN script_tags st ON t.id = st.tag_id WHERE st.script_id = ?',
      [scriptId],
    );
    return (rows as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as TagCategory,
    }));
  }

  /**
   * Search scripts by tag IDs (must match ALL specified tags).
   * Requirement 7.3
   */
  async searchByTags(tagIds: string[], limit: number, offset: number): Promise<string[]> {
    if (tagIds.length === 0) return [];

    const placeholders = tagIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT st.script_id FROM script_tags st
       WHERE st.tag_id IN (${placeholders})
       GROUP BY st.script_id
       HAVING COUNT(DISTINCT st.tag_id) = ?
       LIMIT ? OFFSET ?`,
      [...tagIds, tagIds.length, limit, offset],
    );
    return (rows as Record<string, unknown>[]).map(r => r.script_id as string);
  }

  /**
   * Get popular tags sorted by usage count, with Redis cache.
   * Requirement 7.4
   */
  async getPopularTags(limit: number): Promise<Tag[]> {
    // Try cache first
    try {
      const cached = await redis.zrevrange(POPULAR_TAGS_KEY, 0, limit - 1, 'WITHSCORES');
      if (cached && cached.length > 0) {
        const tagIds = cached.filter((_, i) => i % 2 === 0);
        return this.getTagsByIds(tagIds);
      }
    } catch {
      // Redis unavailable, fall through to DB
    }

    // Query DB
    const [rows] = await pool.execute(
      `SELECT t.*, COUNT(st.script_id) as usage_count
       FROM tags t INNER JOIN script_tags st ON t.id = st.tag_id
       GROUP BY t.id ORDER BY usage_count DESC LIMIT ?`,
      [limit],
    );

    const results = rows as Record<string, unknown>[];
    const tags = results.map(r => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as TagCategory,
    }));

    // Update cache
    try {
      if (results.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.del(POPULAR_TAGS_KEY);
        for (const r of results) {
          pipeline.zadd(POPULAR_TAGS_KEY, r.usage_count as number, r.id as string);
        }
        pipeline.expire(POPULAR_TAGS_KEY, POPULAR_TAGS_TTL);
        await pipeline.exec();
      }
    } catch {
      // Cache update failure is non-critical
    }

    return tags;
  }

  // ─── Helpers ───

  /** Pure function: generate tag definitions from config (for testing) */
  generateTagDefs(config: ScriptConfig): { name: string; category: TagCategory }[] {
    return [
      { name: this.gameTypeLabel(config.gameType), category: TagCategory.GAME_TYPE },
      { name: this.ageGroupLabel(config.ageGroup), category: TagCategory.AGE_GROUP },
      { name: `${config.playerCount}人本`, category: TagCategory.PLAYER_COUNT },
      { name: config.era, category: TagCategory.ERA },
      { name: config.theme, category: TagCategory.THEME },
    ];
  }

  private gameTypeLabel(gt: GameType): string {
    const map: Record<GameType, string> = {
      [GameType.HONKAKU]: '本格',
      [GameType.SHIN_HONKAKU]: '新本格',
      [GameType.HENKAKU]: '变格',
    };
    return map[gt] || gt;
  }

  private ageGroupLabel(ag: AgeGroup): string {
    const map: Record<AgeGroup, string> = {
      [AgeGroup.ELEMENTARY]: '小学生',
      [AgeGroup.MIDDLE_SCHOOL]: '中学生',
      [AgeGroup.COLLEGE]: '大学生',
      [AgeGroup.ADULT]: '成年人',
    };
    return map[ag] || ag;
  }

  private async findOrCreateTag(name: string, category: TagCategory): Promise<Tag> {
    const [existing] = await pool.execute(
      'SELECT * FROM tags WHERE name = ? AND category = ?',
      [name, category],
    );
    const rows = existing as Record<string, unknown>[];
    if (rows.length > 0) {
      return { id: rows[0].id as string, name: rows[0].name as string, category: rows[0].category as TagCategory };
    }

    const id = uuidv4();
    await pool.execute('INSERT INTO tags (id, name, category) VALUES (?, ?, ?)', [id, name, category]);
    return { id, name, category };
  }

  private async linkTag(scriptId: string, tagId: string, isAutoGenerated: boolean): Promise<void> {
    await pool.execute(
      'INSERT IGNORE INTO script_tags (script_id, tag_id, is_auto_generated) VALUES (?, ?, ?)',
      [scriptId, tagId, isAutoGenerated],
    );
  }

  private async getTagsByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(`SELECT * FROM tags WHERE id IN (${placeholders})`, ids);
    return (rows as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as TagCategory,
    }));
  }
}
