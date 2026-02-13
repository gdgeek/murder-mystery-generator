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
import type { AuthoringMode, PhaseName } from '@murder-mystery/shared';

const router: Router = Router();
const llmAdapter = createLLMAdapter();
const skillService = new SkillService();
const configService = new ConfigService();
const generatorService = new GeneratorService(llmAdapter, skillService);
const authoringService = new AuthoringService(llmAdapter, skillService, generatorService, configService);

const VALID_MODES: AuthoringMode[] = ['staged', 'vibe'];
const VALID_PHASES: PhaseName[] = ['plan', 'outline', 'chapter'];

/**
 * POST /api/authoring-sessions
 * Create a new authoring session.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { configId, mode } = req.body;

    if (!configId || typeof configId !== 'string') {
      res.status(400).json({ error: 'configId is required and must be a string' });
      return;
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      res.status(400).json({ error: `mode is required and must be one of: ${VALID_MODES.join(', ')}` });
      return;
    }

    const session = await authoringService.createSession(configId, mode);
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
 * GET /api/authoring-sessions
 * List sessions with optional filters.
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
 * GET /api/authoring-sessions/:id
 * Get session by ID — use this to poll for progress.
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
 * POST /api/authoring-sessions/:id/advance
 * Non-blocking: returns 202 immediately, LLM runs in background.
 * Poll GET /:id to check when state changes.
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
 * PUT /api/authoring-sessions/:id/phases/:phase/edit
 * Save author edits for current phase. (synchronous, no LLM)
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
 * POST /api/authoring-sessions/:id/phases/:phase/approve
 * Non-blocking: returns 202 immediately, LLM runs in background.
 * Poll GET /:id to check when state changes.
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

    // For chapter approve on last chapter, no LLM needed — can be sync
    if (phase === 'chapter' && session.currentChapterIndex >= session.totalChapters - 1) {
      const result = await authoringService.approvePhase(req.params.id, phase as PhaseName, req.body.notes);
      res.json(result);
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
 * POST /api/authoring-sessions/:id/chapters/:chapterIndex/regenerate
 * Non-blocking: returns 202 immediately, LLM runs in background.
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
 * POST /api/authoring-sessions/:id/retry
 * Retry from failed state. (synchronous, no LLM — just resets state)
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
 * POST /api/authoring-sessions/:id/assemble
 * Assemble script from completed session. (synchronous, no LLM)
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
