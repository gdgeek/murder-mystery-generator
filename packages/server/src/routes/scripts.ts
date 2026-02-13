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

const router: Router = Router();
const configService = new ConfigService();
const skillService = new SkillService();
const llmAdapter = createLLMAdapter();
const generatorService = new GeneratorService(llmAdapter, skillService);

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

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const script = await generatorService.getScript(req.params.id);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await generatorService.getScriptVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

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
