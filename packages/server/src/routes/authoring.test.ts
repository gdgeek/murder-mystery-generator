/**
 * Tests for Authoring route extensions — ephemeral AI config handling
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing the router
vi.mock('../services/authoring/authoring.service');
vi.mock('../services/config.service');
vi.mock('../services/skill.service');
vi.mock('../services/generator.service');
vi.mock('../services/ai-status.service');
vi.mock('../adapters/create-llm-adapter', () => ({
  createLLMAdapter: vi.fn(() => ({})),
}));

import { AuthoringService } from '../services/authoring/authoring.service';
import { AiStatusService } from '../services/ai-status.service';
import authoringRouter from './authoring';

const app = express();
app.use(express.json());
app.use('/api/authoring-sessions', authoringRouter);

const validConfig = {
  provider: 'openai',
  apiKey: 'sk-test-key',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
};

const mockSession = {
  id: 'session-1',
  configId: 'config-1',
  mode: 'staged',
  state: 'draft',
  chapters: [],
  chapterEdits: {},
  currentChapterIndex: 0,
  totalChapters: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('POST /api/authoring-sessions — ephemeral AI config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes ephemeralAiConfig to createSession when provided', async () => {
    vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
      status: 'configured',
      provider: 'openai',
    });
    vi.mocked(AuthoringService.prototype.createSession).mockResolvedValue(mockSession as any);

    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({ configId: 'config-1', mode: 'staged', ephemeralAiConfig: validConfig });

    expect(res.status).toBe(201);
    expect(AuthoringService.prototype.createSession).toHaveBeenCalledWith(
      'config-1',
      'staged',
      validConfig,
    );
  });

  it('works without ephemeralAiConfig when server is configured', async () => {
    vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
      status: 'configured',
      provider: 'doubao',
    });
    vi.mocked(AuthoringService.prototype.createSession).mockResolvedValue(mockSession as any);

    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({ configId: 'config-1', mode: 'staged' });

    expect(res.status).toBe(201);
    expect(AuthoringService.prototype.createSession).toHaveBeenCalledWith(
      'config-1',
      'staged',
      undefined,
    );
  });

  it('returns 400 when server is unconfigured and no ephemeralAiConfig provided', async () => {
    vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
      status: 'unconfigured',
    });

    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({ configId: 'config-1', mode: 'staged' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ephemeralAiConfig');
    expect(AuthoringService.prototype.createSession).not.toHaveBeenCalled();
  });

  it('returns 400 when ephemeralAiConfig has invalid fields', async () => {
    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({
        configId: 'config-1',
        mode: 'staged',
        ephemeralAiConfig: {
          provider: 'openai',
          apiKey: '',
          endpoint: 'not-a-url',
          model: '',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.apiKey).toBeDefined();
    expect(res.body.details.endpoint).toBeDefined();
    expect(res.body.details.model).toBeDefined();
    expect(AuthoringService.prototype.createSession).not.toHaveBeenCalled();
  });

  it('still validates configId and mode before checking ephemeralAiConfig', async () => {
    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({ mode: 'staged' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('configId');
  });

  it('returns 404 when config is not found', async () => {
    vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
      status: 'configured',
      provider: 'openai',
    });
    vi.mocked(AuthoringService.prototype.createSession).mockRejectedValue(
      new Error('Config not found: config-999'),
    );

    const res = await request(app)
      .post('/api/authoring-sessions')
      .send({ configId: 'config-999', mode: 'staged' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/authoring-sessions/:id/ai-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with updated session on success', async () => {
    const updatedSession = { ...mockSession, state: 'failed', aiConfigMeta: { provider: 'openai', model: 'gpt-4' } };
    vi.mocked(AuthoringService.prototype.updateAiConfig).mockResolvedValue(updatedSession as any);

    const res = await request(app)
      .put('/api/authoring-sessions/session-1/ai-config')
      .send({ ephemeralAiConfig: validConfig });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('session-1');
    expect(AuthoringService.prototype.updateAiConfig).toHaveBeenCalledWith('session-1', validConfig);
  });

  it('returns 400 when ephemeralAiConfig is missing', async () => {
    const res = await request(app)
      .put('/api/authoring-sessions/session-1/ai-config')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ephemeralAiConfig is required');
    expect(AuthoringService.prototype.updateAiConfig).not.toHaveBeenCalled();
  });

  it('returns 400 when ephemeralAiConfig validation fails', async () => {
    const res = await request(app)
      .put('/api/authoring-sessions/session-1/ai-config')
      .send({
        ephemeralAiConfig: {
          provider: 'openai',
          apiKey: '',
          endpoint: 'not-a-url',
          model: '',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
    expect(AuthoringService.prototype.updateAiConfig).not.toHaveBeenCalled();
  });

  it('returns 404 when session is not found', async () => {
    vi.mocked(AuthoringService.prototype.updateAiConfig).mockRejectedValue(
      new Error('Session not found: session-999'),
    );

    const res = await request(app)
      .put('/api/authoring-sessions/session-999/ai-config')
      .send({ ephemeralAiConfig: validConfig });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Session not found');
  });

  it('returns 409 when session state does not allow AI config update', async () => {
    vi.mocked(AuthoringService.prototype.updateAiConfig).mockRejectedValue(
      new Error("Cannot update AI config in state 'planning'"),
    );

    const res = await request(app)
      .put('/api/authoring-sessions/session-1/ai-config')
      .send({ ephemeralAiConfig: validConfig });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Cannot update AI config in state');
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(AuthoringService.prototype.updateAiConfig).mockRejectedValue(
      new Error('Database connection failed'),
    );

    const res = await request(app)
      .put('/api/authoring-sessions/session-1/ai-config')
      .send({ ephemeralAiConfig: validConfig });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Database connection failed');
  });
});


describe('POST /api/authoring-sessions/:id/retry-failed-chapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with updated session on success', async () => {
    const updatedSession = {
      ...mockSession,
      state: 'chapter_review',
      chapters: [{ index: 0, content: 'ch0' }, { index: 1, content: 'ch1' }],
      parallelBatch: { failedIndices: [], completedIndices: [0, 1] },
    };
    vi.mocked(AuthoringService.prototype.retryFailedChapters).mockResolvedValue(updatedSession as any);

    const res = await request(app)
      .post('/api/authoring-sessions/session-1/retry-failed-chapters')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('chapter_review');
    expect(AuthoringService.prototype.retryFailedChapters).toHaveBeenCalledWith('session-1');
  });

  it('returns 400 when no failed chapters exist', async () => {
    vi.mocked(AuthoringService.prototype.retryFailedChapters).mockRejectedValue(
      new Error('No failed chapters to retry'),
    );

    const res = await request(app)
      .post('/api/authoring-sessions/session-1/retry-failed-chapters')
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No failed chapters');
  });

  it('returns 400 when session is not in chapter_review state', async () => {
    vi.mocked(AuthoringService.prototype.retryFailedChapters).mockRejectedValue(
      new Error("Cannot retry failed chapters in state 'planning', expected 'chapter_review'"),
    );

    const res = await request(app)
      .post('/api/authoring-sessions/session-1/retry-failed-chapters')
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot retry failed chapters in state');
  });

  it('returns 404 when session is not found', async () => {
    vi.mocked(AuthoringService.prototype.retryFailedChapters).mockRejectedValue(
      new Error('Session not found: session-999'),
    );

    const res = await request(app)
      .post('/api/authoring-sessions/session-999/retry-failed-chapters')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Session not found');
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(AuthoringService.prototype.retryFailedChapters).mockRejectedValue(
      new Error('Database connection failed'),
    );

    const res = await request(app)
      .post('/api/authoring-sessions/session-1/retry-failed-chapters')
      .send();

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Database connection failed');
  });
});
