/**
 * Tests for AI Status API routes
 * Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the service before importing the router
vi.mock('../services/ai-status.service');

import { AiStatusService } from '../services/ai-status.service';
import aiStatusRouter from './ai-status';

const app = express();
app.use(express.json());
app.use('/api/ai-status', aiStatusRouter);

describe('AI Status Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ai-status', () => {
    it('returns configured status when AI is configured', async () => {
      vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
        status: 'configured',
        provider: 'doubao',
        model: 'doubao-seed-1-8-251228',
      });

      const res = await request(app).get('/api/ai-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'configured',
        provider: 'doubao',
        model: 'doubao-seed-1-8-251228',
      });
    });

    it('returns unconfigured status when AI is not configured', async () => {
      vi.mocked(AiStatusService.prototype.getStatus).mockReturnValue({
        status: 'unconfigured',
      });

      const res = await request(app).get('/api/ai-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'unconfigured' });
    });

    it('returns 500 when service throws', async () => {
      vi.mocked(AiStatusService.prototype.getStatus).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await request(app).get('/api/ai-status');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Unexpected error' });
    });
  });

  describe('POST /api/ai-status/verify', () => {
    const validConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4',
    };

    it('returns valid result when verification succeeds', async () => {
      vi.mocked(AiStatusService.prototype.verify).mockResolvedValue({
        valid: true,
        provider: 'openai',
        model: 'gpt-4',
      });

      const res = await request(app)
        .post('/api/ai-status/verify')
        .send({ ephemeralAiConfig: validConfig });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: true,
        provider: 'openai',
        model: 'gpt-4',
      });
    });

    it('returns invalid result when verification fails', async () => {
      vi.mocked(AiStatusService.prototype.verify).mockResolvedValue({
        valid: false,
        error: 'Authentication failed',
      });

      const res = await request(app)
        .post('/api/ai-status/verify')
        .send({ ephemeralAiConfig: validConfig });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: false,
        error: 'Authentication failed',
      });
    });

    it('returns 400 when ephemeralAiConfig is missing', async () => {
      const res = await request(app)
        .post('/api/ai-status/verify')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ephemeralAiConfig is required' });
    });

    it('returns 400 when config validation fails', async () => {
      const res = await request(app)
        .post('/api/ai-status/verify')
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
      expect(res.body.details.apiKey).toBeDefined();
      expect(res.body.details.endpoint).toBeDefined();
      expect(res.body.details.model).toBeDefined();
    });

    it('returns 500 when service throws unexpectedly', async () => {
      vi.mocked(AiStatusService.prototype.verify).mockRejectedValue(
        new Error('Internal error'),
      );

      const res = await request(app)
        .post('/api/ai-status/verify')
        .send({ ephemeralAiConfig: validConfig });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal error' });
    });
  });
});
