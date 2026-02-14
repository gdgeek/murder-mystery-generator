/**
 * Authoring Session API routes (non-blocking)
 *
 * All LLM-triggering endpoints return 202 immediately with the in-progress state.
 * The client polls GET /api/authoring-sessions/:id to check progress.
 *
 * POST   /api/authoring-sessions                              - Create session
 * GET    /api/authoring-sessions                              - List sessions
 * GET    /api/authoring-sessions/:id                          - Get session (poll this)
 * POST   /api/authoring-sessions/:id/advance                  - Advance (non-blocking)
 * PUT    /api/authoring-sessions/:id/phases/:phase/edit       - Edit phase output
 * POST   /api/authoring-sessions/:id/phases/:phase/approve    - Approve phase (non-blocking)
 * POST   /api/authoring-sessions/:id/chapters/:chapterIndex/regenerate - Regenerate (non-blocking)
 * POST   /api/authoring-sessions/:id/retry                    - Retry from failed
 * PUT    /api/authoring-sessions/:id/ai-config                - Update AI config
 * POST   /api/authoring-sessions/:id/retry-failed-chapters    - Retry failed chapters
 * POST   /api/authoring-sessions/:id/assemble                 - Assemble script
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import { Router, Request, Response } from 'express';
import { AuthoringService } from '../services/authoring/authoring.service';
import { ConfigService } from '../services/config.service';
import { SkillService } from '../services/skill.service';
import { GeneratorService } from '../services/generator.service';
import { createLLMAdapter } from '../adapters/create-llm-adapter';
import { validateEphemeralAiConfig } from '@murder-mystery/shared';
import { AiStatusService } from '../services/ai-status.service';
import type { AuthoringMode, PhaseName } from '@murder-mystery/shared';

const router: Router = Router();
const llmAdapter = createLLMAdapter();
const skillService = new SkillService();
const configService = new ConfigService();
const generatorService = new GeneratorService(llmAdapter, skillService);
const authoringService = new AuthoringService(llmAdapter, skillService, generatorService, configService);
const aiStatusService = new AiStatusService();

const VALID_MODES: AuthoringMode[] = ['staged', 'vibe'];
const VALID_PHASES: PhaseName[] = ['plan', 'outline', 'chapter'];

/**
 * @openapi
 * /api/authoring-sessions:
 *   post:
 *     tags: [创作会话]
 *     summary: 创建创作会话
 *     description: 创建一个新的分阶段创作会话，需要指定配置标识和创作模式。可选传入临时 AI 配置。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSessionRequest'
 *     responses:
 *       201:
 *         description: 会话创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 请求参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { configId, mode, ephemeralAiConfig } = req.body;

    if (!configId || typeof configId !== 'string') {
      res.status(400).json({ error: 'configId is required and must be a string' });
      return;
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      res.status(400).json({ error: `mode is required and must be one of: ${VALID_MODES.join(', ')}` });
      return;
    }

    // Validate ephemeralAiConfig if provided
    if (ephemeralAiConfig) {
      const validationErrors = validateEphemeralAiConfig(ephemeralAiConfig);
      if (validationErrors) {
        res.status(400).json({ error: 'Validation failed', details: validationErrors });
        return;
      }
    }

    // Check if server has AI configured when no ephemeralAiConfig is provided
    if (!ephemeralAiConfig) {
      const aiStatus = aiStatusService.getStatus();
      if (aiStatus.status === 'unconfigured') {
        res.status(400).json({ error: '服务器未配置 AI，请提供 ephemeralAiConfig' });
        return;
      }
    }

    const session = await authoringService.createSession(configId, mode, ephemeralAiConfig);
    res.status(201).json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions:
 *   get:
 *     tags: [创作会话]
 *     summary: 获取创作会话列表
 *     description: 查询创作会话列表，支持按配置标识、状态、模式进行筛选，支持分页。
 *     parameters:
 *       - in: query
 *         name: configId
 *         schema:
 *           type: string
 *         description: 按配置标识筛选
 *       - in: query
 *         name: state
 *         schema:
 *           $ref: '#/components/schemas/SessionState'
 *         description: 按会话状态筛选
 *       - in: query
 *         name: mode
 *         schema:
 *           $ref: '#/components/schemas/AuthoringMode'
 *         description: 按创作模式筛选
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: 分页偏移量
 *     responses:
 *       200:
 *         description: 成功返回会话列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuthoringSession'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.configId) filters.configId = req.query.configId;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.mode) filters.mode = req.query.mode;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string, 10);
    if (req.query.offset) filters.offset = parseInt(req.query.offset as string, 10);

    const sessions = await authoringService.listSessions(filters);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}:
 *   get:
 *     tags: [创作会话]
 *     summary: 获取指定创作会话
 *     description: 根据会话唯一标识获取创作会话详情，可用于轮询异步操作的进度。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     responses:
 *       200:
 *         description: 成功返回会话详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       404:
 *         description: 未找到指定会话
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
    const session = await authoringService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/advance:
 *   post:
 *     tags: [创作会话]
 *     summary: 推进创作会话
 *     description: 异步推进创作会话到下一阶段。立即返回 202 状态码，LLM 在后台执行生成任务。客户端需轮询 GET /api/authoring-sessions/{id} 检查进度。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     responses:
 *       202:
 *         description: 已接受请求，生成任务在后台执行
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                   description: 会话标识
 *                 state:
 *                   $ref: '#/components/schemas/SessionState'
 *                 message:
 *                   type: string
 *                   description: 操作说明
 *       400:
 *         description: 当前状态不允许推进
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/advance', async (req: Request, res: Response) => {
  try {
    const session = await authoringService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }

    // Validate that advance is possible
    if (session.mode === 'vibe' && session.state !== 'draft') {
      res.status(400).json({ error: `Cannot advance vibe session from state '${session.state}'` });
      return;
    }
    if (session.mode === 'staged' && !['draft', 'executing'].includes(session.state)) {
      res.status(400).json({ error: `Cannot advance staged session from state '${session.state}'` });
      return;
    }

    // Validate API key before starting background generation
    try {
      const adapter = authoringService.getAdapterForSession(session.id);
      adapter.validateApiKey();
    } catch (keyErr) {
      res.status(400).json({ error: (keyErr as Error).message });
      return;
    }

    // Return 202 immediately with current state
    res.status(202).json({ sessionId: session.id, state: session.state, message: 'Generation started' });

    // Fire and forget — run LLM in background
    authoringService.advance(req.params.id).catch((err) => {
      console.error(`[Authoring] advance failed for ${req.params.id}:`, (err as Error).message);
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/phases/{phase}/edit:
 *   put:
 *     tags: [创作会话]
 *     summary: 编辑阶段产出物
 *     description: 保存作者对当前阶段产出物的编辑内容。此操作为同步操作，不触发 LLM 生成。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *       - in: path
 *         name: phase
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/PhaseName'
 *         description: 阶段名称
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: object
 *                 description: 编辑后的阶段内容
 *     responses:
 *       200:
 *         description: 编辑保存成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 请求参数验证失败或当前状态不允许编辑
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.put('/:id/phases/:phase/edit', async (req: Request, res: Response) => {
  try {
    const { phase } = req.params;
    if (!VALID_PHASES.includes(phase as PhaseName)) {
      res.status(400).json({ error: `Invalid phase: '${phase}'. Must be one of: ${VALID_PHASES.join(', ')}` });
      return;
    }

    const { content } = req.body;
    if (content === undefined || content === null) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const session = await authoringService.editPhase(req.params.id, phase as PhaseName, content);
    res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Cannot edit') || message.includes('No plan') || message.includes('No outline') || message.includes('No chapter')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/phases/{phase}/approve:
 *   post:
 *     tags: [创作会话]
 *     summary: 审批阶段产出物
 *     description: 审批通过当前阶段的产出物并触发下一阶段生成。异步操作返回 202 状态码，LLM 在后台执行。批次内仍有未审阅章节时为同步操作返回 200。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *       - in: path
 *         name: phase
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/PhaseName'
 *         description: 阶段名称
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: 审批备注
 *     responses:
 *       200:
 *         description: 同步审批成功（批次内仍有未审阅章节）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       202:
 *         description: 已接受请求，下一阶段生成任务在后台执行
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                   description: 会话标识
 *                 state:
 *                   $ref: '#/components/schemas/SessionState'
 *                 message:
 *                   type: string
 *                   description: 操作说明
 *       400:
 *         description: 请求参数验证失败或当前状态不允许审批
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/phases/:phase/approve', async (req: Request, res: Response) => {
  try {
    const { phase } = req.params;
    if (!VALID_PHASES.includes(phase as PhaseName)) {
      res.status(400).json({ error: `Invalid phase: '${phase}'. Must be one of: ${VALID_PHASES.join(', ')}` });
      return;
    }

    const session = await authoringService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }

    // For chapter approve: if within a batch and more chapters to review (no LLM), sync.
    // If triggering next batch generation or final completion, may need async.
    if (phase === 'chapter') {
      const batch = session.parallelBatch;
      if (batch) {
        const unreviewedCount = batch.chapterIndices.filter(
          idx => !batch.reviewedIndices.includes(idx),
        ).length;
        if (unreviewedCount > 1) {
          // More chapters in batch to review — no LLM, sync response
          const result = await authoringService.approvePhase(req.params.id, phase as PhaseName, req.body.notes);
          res.json(result);
          return;
        }
      }
    }

    // Validate API key before starting background generation
    try {
      const adapter = authoringService.getAdapterForSession(session.id);
      adapter.validateApiKey();
    } catch (keyErr) {
      res.status(400).json({ error: (keyErr as Error).message });
      return;
    }

    // Return 202 immediately
    res.status(202).json({ sessionId: session.id, state: session.state, message: `Approving ${phase}, generation started` });

    // Fire and forget
    const { notes } = req.body;
    authoringService.approvePhase(req.params.id, phase as PhaseName, notes).catch((err) => {
      console.error(`[Authoring] approvePhase(${phase}) failed for ${req.params.id}:`, (err as Error).message);
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Cannot approve')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/chapters/{chapterIndex}/regenerate:
 *   post:
 *     tags: [创作会话]
 *     summary: 重新生成指定章节
 *     description: 异步重新生成指定索引的章节内容。立即返回 202 状态码，LLM 在后台执行生成任务。仅在 chapter_review 状态下可用。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *       - in: path
 *         name: chapterIndex
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: 章节索引（从 0 开始）
 *     responses:
 *       202:
 *         description: 已接受请求，章节重新生成任务在后台执行
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                   description: 会话标识
 *                 state:
 *                   $ref: '#/components/schemas/SessionState'
 *                 message:
 *                   type: string
 *                   description: 操作说明
 *       400:
 *         description: 章节索引无效或当前状态不允许重新生成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/chapters/:chapterIndex/regenerate', async (req: Request, res: Response) => {
  try {
    const chapterIndex = parseInt(req.params.chapterIndex, 10);
    if (isNaN(chapterIndex) || chapterIndex < 0) {
      res.status(400).json({ error: 'chapterIndex must be a non-negative integer' });
      return;
    }

    const session = await authoringService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }

    if (session.state !== 'chapter_review') {
      res.status(400).json({ error: `Cannot regenerate chapter in state '${session.state}', expected 'chapter_review'` });
      return;
    }

    // Validate API key before starting background regeneration
    try {
      const adapter = authoringService.getAdapterForSession(session.id);
      adapter.validateApiKey();
    } catch (keyErr) {
      res.status(400).json({ error: (keyErr as Error).message });
      return;
    }

    // Return 202 immediately
    res.status(202).json({ sessionId: session.id, state: session.state, message: `Regenerating chapter ${chapterIndex}` });

    // Fire and forget
    authoringService.regenerateChapter(req.params.id, chapterIndex).catch((err) => {
      console.error(`[Authoring] regenerateChapter(${chapterIndex}) failed for ${req.params.id}:`, (err as Error).message);
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/retry:
 *   post:
 *     tags: [创作会话]
 *     summary: 重试失败的会话
 *     description: 从失败状态重试创作会话，重置会话状态到失败前的状态。此操作为同步操作，不触发 LLM 生成。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     responses:
 *       200:
 *         description: 重试成功，会话状态已重置
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 当前状态不允许重试
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const session = await authoringService.retry(req.params.id);
    res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Cannot retry')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/ai-config:
 *   put:
 *     tags: [创作会话]
 *     summary: 更换会话 AI 配置
 *     description: 更换会话的临时 AI 配置。仅在 failed 或 review 状态下允许。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EphemeralAiConfig'
 *     responses:
 *       200:
 *         description: AI 配置更换成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 配置校验失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 当前状态不允许更换 AI 配置
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
router.put('/:id/ai-config', async (req: Request, res: Response) => {
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

    const session = await authoringService.updateAiConfig(req.params.id, ephemeralAiConfig);
    res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Session not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Cannot update AI config in state')) {
      res.status(409).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/retry-failed-chapters:
 *   post:
 *     tags: [创作会话]
 *     summary: 重试失败的章节
 *     description: 仅重新生成并行批量中失败的章节。要求会话处于 chapter_review 状态且存在失败章节。成功后将新章节合并到已有列表中。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     responses:
 *       200:
 *         description: 重试完成，返回更新后的会话
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 无失败章节或会话状态不允许重试
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/retry-failed-chapters', async (req: Request, res: Response) => {
  try {
    const session = await authoringService.retryFailedChapters(req.params.id);
    res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Session not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('No failed chapters') || message.includes('Cannot retry failed chapters in state')) {
      res.status(400).json({ error: message });
      return;
    }
    if (message.includes('API Key')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * @openapi
 * /api/authoring-sessions/{id}/assemble:
 *   post:
 *     tags: [创作会话]
 *     summary: 组装最终剧本
 *     description: 从已完成的创作会话中组装最终剧本。此操作为同步操作，不触发 LLM 生成。仅在所有章节审批通过后可用。
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 会话唯一标识
 *     responses:
 *       200:
 *         description: 剧本组装成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthoringSession'
 *       400:
 *         description: 当前状态不允许组装
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 未找到指定会话
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
router.post('/:id/assemble', async (req: Request, res: Response) => {
  try {
    const session = await authoringService.assembleScript(req.params.id);
    res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Cannot assemble')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

export default router;
