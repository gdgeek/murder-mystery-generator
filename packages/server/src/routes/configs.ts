/**
 * Config API routes
 * POST /api/configs - Create config
 * GET  /api/configs/:id - Get config by ID
 */

import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/config.service';

const router = Router();
const configService = new ConfigService();

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
