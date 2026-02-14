/**
 * Script API routes
 * POST /api/scripts/generate - Generate script
 * GET  /api/scripts - List scripts
 * GET  /api/scripts/:id - Get script
 * GET  /api/scripts/:id/versions - Get version history
 * POST /api/scripts/:id/optimize - Optimize with feedback
 */

import { Router, Request, Response } from 'express';
import { GeneratorService } from '../services/generator.service';
import { ConfigService } from '../services/config.service';
import { SkillService } from '../services/skill.service';
import { createLLMAdapter } from '../adapters/create-llm-adapter';
import { AuthoringService } from '../services/authoring/authoring.service';
import { Script, AiStepMeta } from '@murder-mystery/shared';

const router: Router = Router();
const configService = new ConfigService();
const skillService = new SkillService();
const llmAdapter = createLLMAdapter();
const generatorService = new GeneratorService(llmAdapter, skillService);
const authoringService = new AuthoringService(llmAdapter, skillService, generatorService, configService);

/** Resolve script by ID, falling back to authoring session lookup */
async function resolveScript(id: string): Promise<Script | null> {
  const script = await generatorService.getScript(id);
  if (script) return script;
  // Try as authoring session ID
  const session = await authoringService.getSession(id);
  if (session?.scriptId) {
    return generatorService.getScript(session.scriptId);
  }
  return null;
}

/**
 * @openapi
 * /api/scripts/generate:
 *   post:
 *     tags: [剧本管理]
 *     summary: 生成剧本
 *     description: 根据指定配置异步生成谋杀悬疑剧本，返回生成任务信息
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [configId]
 *             properties:
 *               configId:
 *                 type: string
 *                 description: 关联的剧本配置标识
 *     responses:
 *       202:
 *         description: 剧本生成任务已创建
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: 生成任务标识
 *                 status:
 *                   type: string
 *                   description: 任务状态
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
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { configId } = req.body;
    if (!configId) {
      res.status(400).json({ error: 'configId is required' });
      return;
    }
    const config = await configService.getById(configId);
    if (!config) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }
    const job = await generatorService.startGenerate(config);
    res.status(202).json(job);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/jobs/{jobId}:
 *   get:
 *     tags: [剧本管理]
 *     summary: 查询生成任务状态
 *     description: 根据任务标识查询剧本生成任务的当前状态和结果
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 生成任务唯一标识
 *     responses:
 *       200:
 *         description: 成功返回任务状态
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: 任务标识
 *                 status:
 *                   type: string
 *                   description: 任务状态
 *       404:
 *         description: 未找到指定任务
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
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await generatorService.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts:
 *   get:
 *     tags: [剧本管理]
 *     summary: 获取剧本列表
 *     description: 查询所有剧本，支持按配置标识、状态筛选及分页
 *     parameters:
 *       - in: query
 *         name: configId
 *         schema:
 *           type: string
 *         description: 按配置标识筛选
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 按剧本状态筛选
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 返回结果数量上限
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: 分页偏移量
 *     responses:
 *       200:
 *         description: 成功返回剧本列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
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
    if (req.query.status) filters.status = req.query.status;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string, 10);
    if (req.query.offset) filters.offset = parseInt(req.query.offset as string, 10);
    const scripts = await generatorService.listScripts(filters);
    res.json(scripts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/export-all:
 *   get:
 *     tags: [剧本管理]
 *     summary: 导出所有剧本列表（含下载链接）
 *     description: 返回所有剧本的摘要信息及各自的导出链接
 *     responses:
 *       200:
 *         description: 成功返回剧本导出列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   status:
 *                     type: string
 *                   exportUrl:
 *                     type: string
 */
router.get('/export-all', async (_req: Request, res: Response) => {
  try {
    const scripts = await generatorService.listScripts({});
    const list = (scripts as Array<{ id: string; title: string; status: string; createdAt: unknown }>).map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt,
      exportUrl: `/api/scripts/${s.id}/export`,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/{id}:
 *   get:
 *     tags: [剧本管理]
 *     summary: 获取指定剧本
 *     description: 根据剧本唯一标识获取剧本详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剧本唯一标识
 *     responses:
 *       200:
 *         description: 成功返回剧本详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: 未找到指定剧本
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
    const script = await resolveScript(req.params.id);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/{id}/export:
 *   get:
 *     tags: [剧本管理]
 *     summary: 导出剧本 JSON 文件
 *     description: 将指定剧本导出为 JSON 文件下载，文件名为剧本标题
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剧本唯一标识
 *     responses:
 *       200:
 *         description: 成功返回剧本 JSON 文件
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: 未找到指定剧本
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const script = await resolveScript(req.params.id);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    // Build AI usage summary from authoring session
    let aiUsageSummary: {
      steps: Array<{ phase: string; index?: number; meta: AiStepMeta }>;
      totalTokens: { prompt: number; completion: number; total: number };
      totalResponseTimeMs: number;
    } | undefined;

    const session = await authoringService.getSessionByScriptId(script.id);
    if (session) {
      const steps: Array<{ phase: string; index?: number; meta: AiStepMeta }> = [];
      const totals = { prompt: 0, completion: 0, total: 0 };
      let totalTime = 0;

      if (session.planOutput?.aiMeta) {
        steps.push({ phase: 'plan', meta: session.planOutput.aiMeta });
        totals.prompt += session.planOutput.aiMeta.tokenUsage.prompt;
        totals.completion += session.planOutput.aiMeta.tokenUsage.completion;
        totals.total += session.planOutput.aiMeta.tokenUsage.total;
        totalTime += session.planOutput.aiMeta.responseTimeMs;
      }
      if (session.outlineOutput?.aiMeta) {
        steps.push({ phase: 'outline', meta: session.outlineOutput.aiMeta });
        totals.prompt += session.outlineOutput.aiMeta.tokenUsage.prompt;
        totals.completion += session.outlineOutput.aiMeta.tokenUsage.completion;
        totals.total += session.outlineOutput.aiMeta.tokenUsage.total;
        totalTime += session.outlineOutput.aiMeta.responseTimeMs;
      }
      for (const chapter of session.chapters) {
        if (chapter.aiMeta) {
          steps.push({ phase: 'chapter', index: chapter.index, meta: chapter.aiMeta });
          totals.prompt += chapter.aiMeta.tokenUsage.prompt;
          totals.completion += chapter.aiMeta.tokenUsage.completion;
          totals.total += chapter.aiMeta.tokenUsage.total;
          totalTime += chapter.aiMeta.responseTimeMs;
        }
      }

      if (steps.length > 0) {
        aiUsageSummary = { steps, totalTokens: totals, totalResponseTimeMs: totalTime };
      }
    }

    const exportData = { ...script, aiUsageSummary };
    const filename = encodeURIComponent(script.title || script.id) + '.json';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/{id}/versions:
 *   get:
 *     tags: [剧本管理]
 *     summary: 获取剧本版本历史
 *     description: 根据剧本标识获取该剧本的所有历史版本列表
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剧本唯一标识
 *     responses:
 *       200:
 *         description: 成功返回版本历史列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await generatorService.getScriptVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/scripts/{id}/optimize:
 *   post:
 *     tags: [剧本管理]
 *     summary: 优化剧本
 *     description: 根据反馈意见对指定剧本进行优化，生成新版本
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
 *             required: [feedback]
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: 优化反馈意见
 *     responses:
 *       201:
 *         description: 剧本优化成功，返回新版本信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: 剧本标识
 *                 version:
 *                   type: integer
 *                   description: 新版本号
 *                 title:
 *                   type: string
 *                   description: 剧本标题
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
router.post('/:id/optimize', async (req: Request, res: Response) => {
  try {
    const { feedback } = req.body;
    if (!feedback) {
      res.status(400).json({ error: 'feedback is required' });
      return;
    }
    const script = await generatorService.optimizeWithFeedback(req.params.id, feedback);
    res.status(201).json({ id: script.id, version: script.version, title: script.title });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
