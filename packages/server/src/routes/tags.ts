/**
 * Tag API routes
 * GET    /api/tags - Get tags (optional ?category= filter)
 * GET    /api/tags/popular - Popular tags
 * POST   /api/scripts/:id/tags - Add custom tag
 * DELETE /api/scripts/:id/tags/:tagId - Remove tag
 */

import { Router, Request, Response } from 'express';
import { TagService } from '../services/tag.service';
import { pool } from '../db/mysql';
import { TagCategory } from '@murder-mystery/shared';

const router: Router = Router();
const tagService = new TagService();

// GET /api/tags
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM tags';
    const params: unknown[] = [];
    if (req.query.category) {
      query += ' WHERE category = ?';
      params.push(req.query.category);
    }
    query += ' ORDER BY name';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/tags/popular
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const tags = await tagService.getPopularTags(limit);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as tagRouter };
// Script-tag routes (mounted under /api/scripts)
export const scriptTagRouter: Router = Router();

// POST /api/scripts/:id/tags
scriptTagRouter.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { tagName } = req.body;
    if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      res.status(400).json({ error: 'tagName is required' });
      return;
    }
    const tag = await tagService.addCustomTag(req.params.id, tagName.trim());
    res.status(201).json(tag);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/scripts/:id/tags/:tagId
scriptTagRouter.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  try {
    await tagService.removeTag(req.params.id, req.params.tagId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
