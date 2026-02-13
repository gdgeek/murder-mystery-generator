/**
 * Config API routes
 * POST /api/configs - Create config
 * GET  /api/configs/:id - Get config by ID
 */

import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/config.service';

const router = Router();
const configService = new ConfigService();

/**
 * @openapi
 * /api/configs:
 *   post:
 *     tags: [配置管理]
 *     summary: 创建剧本配置
 *     description: 创建一个新的剧本生成参数配置，包含玩家人数、游戏时长、风格等信息
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateConfigRequest'
 *     responses:
 *       201:
 *         description: 配置创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptConfig'
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = configService.validate(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
    const config = await configService.create(req.body);
    res.status(201).json(config);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/configs/{id}:
 *   get:
 *     tags: [配置管理]
 *     summary: 获取指定配置
 *     description: 根据配置唯一标识获取剧本生成参数配置详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 配置唯一标识
 *     responses:
 *       200:
 *         description: 成功返回配置详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptConfig'
 *       404:
 *         description: 未找到指定配置
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const config = await configService.getById(req.params.id);
    if (!config) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
