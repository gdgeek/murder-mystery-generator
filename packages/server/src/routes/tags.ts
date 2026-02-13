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

/**
 * @openapi
 * /api/tags:
 *   get:
 *     tags: [标签管理]
 *     summary: 获取标签列表
 *     description: 查询所有标签，支持按类别筛选
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 按标签类别筛选
 *     responses:
 *       200:
 *         description: 成功返回标签列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/tags/popular:
 *   get:
 *     tags: [标签管理]
 *     summary: 获取热门标签
 *     description: 按使用次数降序返回热门标签列表，支持限制返回数量
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 返回结果数量上限，默认为 20
 *     responses:
 *       200:
 *         description: 成功返回热门标签列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/scripts/{id}/tags:
 *   post:
 *     tags: [标签管理]
 *     summary: 为剧本添加自定义标签
 *     description: 为指定剧本添加一个自定义标签，标签名不能为空
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剧本唯一标识
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tagName]
 *             properties:
 *               tagName:
 *                 type: string
 *                 description: 标签名称
 *     responses:
 *       201:
 *         description: 标签添加成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: 请求参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/scripts/{id}/tags/{tagId}:
 *   delete:
 *     tags: [标签管理]
 *     summary: 移除剧本标签
 *     description: 从指定剧本中移除一个标签关联
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剧本唯一标识
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *         description: 标签唯一标识
 *     responses:
 *       204:
 *         description: 标签移除成功
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
scriptTagRouter.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  try {
    await tagService.removeTag(req.params.id, req.params.tagId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
