/**
 * AI Status API routes
 *
 * GET  /api/ai-status          - Returns AI configuration status
 * POST /api/ai-status/verify   - Verifies ephemeral AI config connectivity
 *
 * Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4
 */

import { Router, Request, Response } from 'express';
import { validateEphemeralAiConfig } from '@gdgeek/murder-mystery-shared';
import { AiStatusService } from '../services/ai-status.service';

const router: Router = Router();
const aiStatusService = new AiStatusService();

/**
 * @openapi
 * /api/ai-status:
 *   get:
 *     tags: [AI 状态]
 *     summary: 获取 AI 配置状态
 *     description: 返回当前系统的 AI 配置状态，包括是否已配置、服务提供商和模型信息
 *     responses:
 *       200:
 *         description: 成功返回 AI 配置状态
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiStatusResult'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const status = await aiStatusService.getStatusVerified();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/ai-status/verify:
 *   post:
 *     tags: [AI 状态]
 *     summary: 验证临时 AI 配置
 *     description: 验证用户提供的临时 AI 配置是否可用，检查连接性和凭证有效性
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ephemeralAiConfig]
 *             properties:
 *               ephemeralAiConfig:
 *                 $ref: '#/components/schemas/EphemeralAiConfig'
 *     responses:
 *       200:
 *         description: 成功返回验证结果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiVerifyResult'
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
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { ephemeralAiConfig } = req.body;

    if (!ephemeralAiConfig) {
      res.status(400).json({ error: 'ephemeralAiConfig is required' });
      return;
    }

    const validationErrors = validateEphemeralAiConfig(ephemeralAiConfig);
    if (validationErrors) {
      res.status(400).json({ error: 'Validation failed', details: validationErrors });
      return;
    }

    const result = await aiStatusService.verify(ephemeralAiConfig);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
