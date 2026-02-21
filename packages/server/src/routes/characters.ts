/**
 * Character CRUD API routes (generic character library)
 * Characters store reusable traits (personality, appearance, abilities) without script-specific data.
 * Script-specific data (type, motivation, secrets, backstory) is in script_character_sets.
 *
 * POST   /api/characters      - Create character
 * GET    /api/characters       - List characters (filter by name/tags)
 * GET    /api/characters/:id   - Get character details with experience list
 * PUT    /api/characters/:id   - Update character basic design
 * DELETE /api/characters/:id   - Delete character (only when no associated scripts)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/mysql';
import { RowDataPacket } from 'mysql2';

const router: Router = Router();

const VALID_BLOOD_TYPES = new Set(['A', 'B', 'O', 'AB']);
const VALID_MBTI_TYPES = new Set([
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);
const VALID_ZODIAC_SIGNS = new Set([
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

/** @openapi POST /api/characters - 创建角色（通用角色库） */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, gender, zodiacSign, bloodType, mbtiType, personality, abilities, appearance, tags } = req.body;

    if (!name || !gender || !personality || !appearance) {
      res.status(400).json({ error: 'name, gender, personality, and appearance are required' });
      return;
    }
    if (bloodType !== undefined && !VALID_BLOOD_TYPES.has(bloodType)) {
      res.status(400).json({ error: `Invalid bloodType "${bloodType}". Must be one of: A, B, O, AB` });
      return;
    }
    if (mbtiType !== undefined && !VALID_MBTI_TYPES.has(mbtiType)) {
      res.status(400).json({ error: `Invalid mbtiType "${mbtiType}". Must be one of the 16 valid MBTI types` });
      return;
    }
    if (zodiacSign !== undefined && !VALID_ZODIAC_SIGNS.has(zodiacSign)) {
      res.status(400).json({ error: `Invalid zodiacSign "${zodiacSign}". Must be one of the 12 zodiac signs` });
      return;
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO characters (id, name, gender, zodiac_sign, blood_type, mbti_type, personality, abilities, appearance, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, gender, zodiacSign || null, bloodType || null, mbtiType || null, personality, abilities || null, appearance, tags ? JSON.stringify(tags) : null],
    );

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM characters WHERE id = ?', [id]);
    const character = rows[0];
    character.tags = character.tags ? (typeof character.tags === 'string' ? JSON.parse(character.tags) : character.tags) : null;
    res.status(201).json(character);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** @openapi GET /api/characters - 查询角色列表 */
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM characters';
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (req.query.name) { conditions.push('name LIKE ?'); params.push(`%${req.query.name}%`); }
    if (req.query.tags) {
      try {
        const tagList = JSON.parse(req.query.tags as string) as string[];
        if (Array.isArray(tagList)) { for (const tag of tagList) { conditions.push('JSON_CONTAINS(tags, ?)'); params.push(JSON.stringify(tag)); } }
      } catch { /* ignore */ }
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    const characters = (rows as RowDataPacket[]).map(row => ({
      ...row,
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : null,
    }));
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** @openapi GET /api/characters/{id} - 查询角色详情含经历列表 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [charRows] = await pool.execute<RowDataPacket[]>('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (charRows.length === 0) { res.status(404).json({ error: 'Character not found' }); return; }
    const character = charRows[0];
    character.tags = character.tags ? (typeof character.tags === 'string' ? JSON.parse(character.tags) : character.tags) : null;

    const [expRows] = await pool.execute<RowDataPacket[]>(
      `SELECT scs.id, scs.script_id, scs.character_type, scs.background_story,
              scs.primary_motivation, scs.motivation, scs.experience_summary,
              scs.narrative_role, scs.secrets, scs.relationships, scs.created_at,
              s.title AS script_title
       FROM script_character_sets scs
       LEFT JOIN scripts s ON scs.script_id = s.id
       WHERE scs.character_id = ?
       ORDER BY scs.created_at DESC`,
      [req.params.id],
    );

    const experiences = (expRows as RowDataPacket[]).map(row => ({
      id: row.id,
      scriptId: row.script_id,
      scriptTitle: row.script_title || null,
      characterType: row.character_type,
      backgroundStory: row.background_story || null,
      primaryMotivation: row.primary_motivation || null,
      motivation: row.motivation,
      experienceSummary: row.experience_summary,
      narrativeRole: row.narrative_role,
      secrets: row.secrets ? (typeof row.secrets === 'string' ? JSON.parse(row.secrets) : row.secrets) : null,
      relationships: row.relationships ? (typeof row.relationships === 'string' ? JSON.parse(row.relationships) : row.relationships) : null,
      createdAt: row.created_at,
    }));

    res.json({ ...character, experiences });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** @openapi PUT /api/characters/{id} - 更新角色基本设计 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ error: 'Character not found' }); return; }

    const { bloodType, mbtiType, zodiacSign } = req.body;
    if (bloodType !== undefined && !VALID_BLOOD_TYPES.has(bloodType)) {
      res.status(400).json({ error: `Invalid bloodType "${bloodType}". Must be one of: A, B, O, AB` }); return;
    }
    if (mbtiType !== undefined && !VALID_MBTI_TYPES.has(mbtiType)) {
      res.status(400).json({ error: `Invalid mbtiType "${mbtiType}". Must be one of the 16 valid MBTI types` }); return;
    }
    if (zodiacSign !== undefined && !VALID_ZODIAC_SIGNS.has(zodiacSign)) {
      res.status(400).json({ error: `Invalid zodiacSign "${zodiacSign}". Must be one of the 12 zodiac signs` }); return;
    }

    const allowedFields: Record<string, string> = {
      name: 'name', gender: 'gender', zodiacSign: 'zodiac_sign',
      bloodType: 'blood_type', mbtiType: 'mbti_type', personality: 'personality',
      abilities: 'abilities', appearance: 'appearance', tags: 'tags',
    };
    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
      if (req.body[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = ?`);
        params.push(jsKey === 'tags' ? JSON.stringify(req.body[jsKey]) : req.body[jsKey]);
      }
    }
    if (setClauses.length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }

    params.push(req.params.id);
    await pool.execute(`UPDATE characters SET ${setClauses.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    const character = rows[0];
    character.tags = character.tags ? (typeof character.tags === 'string' ? JSON.parse(character.tags) : character.tags) : null;
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** @openapi DELETE /api/characters/{id} - 删除角色 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ error: 'Character not found' }); return; }
    const [assocRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM script_character_sets WHERE character_id = ?', [req.params.id],
    );
    if (assocRows[0].cnt > 0) { res.status(400).json({ error: 'Cannot delete character with associated scripts' }); return; }
    await pool.execute('DELETE FROM characters WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
