import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pool module before importing the service
vi.mock('../../db/mysql', () => ({
  pool: {
    execute: vi.fn(),
  },
}));

// Mock the LLMAdapter constructor
vi.mock('../../adapters/llm-adapter', () => ({
  LLMAdapter: vi.fn().mockImplementation((opts: Record<string, string>) => ({
    send: vi.fn(),
    getProviderName: () => opts?.provider ?? 'mock',
    getDefaultModel: () => opts?.model ?? 'mock-model',
    validateApiKey: vi.fn(),
  })),
}));

import { pool } from '../../db/mysql';
import { AuthoringService } from './authoring.service';
import { ILLMAdapter } from '../../adapters/llm-adapter.interface';
import { LLMAdapter } from '../../adapters/llm-adapter';
import { SkillService } from '../skill.service';
import { GeneratorService } from '../generator.service';
import { ConfigService } from '../config.service';
import type { EphemeralAiConfig } from '@gdgeek/murder-mystery-shared';

const mockPool = pool as unknown as { execute: ReturnType<typeof vi.fn> };

function makeMockLLM(): ILLMAdapter {
  return {
    send: vi.fn(),
    getProviderName: () => 'default-provider',
    getDefaultModel: () => 'default-model',
    validateApiKey: vi.fn(),
  };
}

function makeService(llmAdapter?: ILLMAdapter) {
  const llm = llmAdapter ?? makeMockLLM();
  const skillService = new SkillService();
  const generatorService = new GeneratorService(llm, skillService);
  const configService = {
    getById: vi.fn().mockResolvedValue({
      id: 'cfg-1',
      playerCount: 4,
      durationHours: 3,
      gameType: 'honkaku',
      ageGroup: 'adult',
      restorationRatio: 60,
      deductionRatio: 40,
      era: '民国',
      location: '上海',
      theme: '悬疑推理',
      language: 'zh',
      roundStructure: { rounds: [], totalRounds: 3, summaryMinutes: 30, finalVoteMinutes: 10, revealMinutes: 10 },
    }),
  } as unknown as ConfigService;

  return new AuthoringService(llm, skillService, generatorService, configService);
}

const sampleEphemeralConfig: EphemeralAiConfig = {
  provider: 'openai',
  apiKey: 'sk-test-secret-key-12345',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
};

describe('AuthoringService adapter management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  describe('createSession with ephemeralAiConfig', () => {
    it('creates and caches a temporary adapter when ephemeralAiConfig is provided', async () => {
      const service = makeService();
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      expect(LLMAdapter).toHaveBeenCalledWith({
        apiKey: 'sk-test-secret-key-12345',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        provider: 'openai',
      });

      // The adapter should be retrievable for this session
      const adapter = service.getAdapterForSession(session.id);
      expect(adapter.getProviderName()).toBe('openai');
    });

    it('sets aiConfigMeta with provider and model (no apiKey)', async () => {
      const service = makeService();
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      expect(session.aiConfigMeta).toEqual({
        provider: 'openai',
        model: 'gpt-4',
      });
      // Ensure apiKey is NOT in aiConfigMeta
      expect(session.aiConfigMeta).not.toHaveProperty('apiKey');
    });

    it('does not create adapter when ephemeralAiConfig is not provided', async () => {
      const service = makeService();
      const session = await service.createSession('cfg-1', 'staged');

      expect(LLMAdapter).not.toHaveBeenCalled();
      expect(session.aiConfigMeta).toBeUndefined();
    });
  });

  describe('getAdapterForSession', () => {
    it('returns cached adapter when present', async () => {
      const service = makeService();
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      const adapter = service.getAdapterForSession(session.id);
      expect(adapter.getProviderName()).toBe('openai');
    });

    it('returns default adapter when no cached adapter exists', () => {
      const defaultLlm = makeMockLLM();
      const service = makeService(defaultLlm);

      const adapter = service.getAdapterForSession('unknown-session');
      expect(adapter).toBe(defaultLlm);
    });

    it('throws error when no cached adapter and no default adapter', () => {
      // Create service with a falsy llmAdapter to simulate unconfigured server
      const llm = null as unknown as ILLMAdapter;
      const skillService = new SkillService();
      const generatorService = new GeneratorService(makeMockLLM(), skillService);
      const configService = { getById: vi.fn() } as unknown as ConfigService;
      const service = new AuthoringService(llm, skillService, generatorService, configService);

      expect(() => service.getAdapterForSession('unknown-session'))
        .toThrow('No AI configuration available. Please provide ephemeralAiConfig.');
    });
  });

  describe('cleanupSessionAdapter', () => {
    it('removes the cached adapter for a session', async () => {
      const defaultLlm = makeMockLLM();
      const service = makeService(defaultLlm);
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      // Adapter should be cached
      const adapter = service.getAdapterForSession(session.id);
      expect(adapter.getProviderName()).toBe('openai');

      // Cleanup
      service.cleanupSessionAdapter(session.id);

      // Now should fall back to default
      const fallback = service.getAdapterForSession(session.id);
      expect(fallback).toBe(defaultLlm);
    });

    it('is a no-op for non-existent session', () => {
      const service = makeService();
      // Should not throw
      expect(() => service.cleanupSessionAdapter('nonexistent')).not.toThrow();
    });
  });

  describe('cleanup on completed/failed state', () => {
    it('cleans up adapter when session state becomes completed via saveSession', async () => {
      const defaultLlm = makeMockLLM();
      const service = makeService(defaultLlm);
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      // Verify adapter is cached
      expect(service.getAdapterForSession(session.id).getProviderName()).toBe('openai');

      // Simulate session completing
      session.state = 'completed';
      await service.saveSession(session);

      // Adapter should be cleaned up, falls back to default
      expect(service.getAdapterForSession(session.id)).toBe(defaultLlm);
    });

    it('cleans up adapter when session state becomes failed via saveSession', async () => {
      const defaultLlm = makeMockLLM();
      const service = makeService(defaultLlm);
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      // Simulate session failing
      session.state = 'failed';
      await service.saveSession(session);

      // Adapter should be cleaned up
      expect(service.getAdapterForSession(session.id)).toBe(defaultLlm);
    });
  });

  describe('sessionToRow / rowToSession serialization', () => {
    it('sessionToRow includes ai_config_meta without apiKey', async () => {
      const service = makeService();
      const session = await service.createSession('cfg-1', 'staged', sampleEphemeralConfig);

      // Check the INSERT call params
      const [, params] = mockPool.execute.mock.calls[0];
      // ai_config_meta is at index 12 in the INSERT params
      const aiConfigMetaParam = params[12];
      expect(aiConfigMetaParam).toBeDefined();

      const parsed = JSON.parse(aiConfigMetaParam as string);
      expect(parsed).toEqual({ provider: 'openai', model: 'gpt-4' });
      expect(parsed).not.toHaveProperty('apiKey');
      expect(aiConfigMetaParam).not.toContain('sk-test-secret-key-12345');
    });

    it('rowToSession parses ai_config_meta correctly', async () => {
      const now = new Date('2025-01-15T10:00:00Z');
      mockPool.execute.mockResolvedValueOnce([[{
        id: 'sess-1',
        config_id: 'cfg-1',
        mode: 'staged',
        state: 'draft',
        plan_output: null,
        outline_output: null,
        chapters: '[]',
        chapter_edits: '{}',
        current_chapter_index: 0,
        total_chapters: 0,
        parallel_batch: null,
        script_id: null,
        ai_config_meta: JSON.stringify({ provider: 'openai', model: 'gpt-4' }),
        failure_info: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }], []]);

      const service = makeService();
      const session = await service.getSession('sess-1');

      expect(session).not.toBeNull();
      expect(session!.aiConfigMeta).toEqual({ provider: 'openai', model: 'gpt-4' });
    });

    it('rowToSession handles null ai_config_meta', async () => {
      const now = new Date('2025-01-15T10:00:00Z');
      mockPool.execute.mockResolvedValueOnce([[{
        id: 'sess-1',
        config_id: 'cfg-1',
        mode: 'staged',
        state: 'draft',
        plan_output: null,
        outline_output: null,
        chapters: '[]',
        chapter_edits: '{}',
        current_chapter_index: 0,
        total_chapters: 0,
        parallel_batch: null,
        script_id: null,
        ai_config_meta: null,
        failure_info: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }], []]);

      const service = makeService();
      const session = await service.getSession('sess-1');

      expect(session!.aiConfigMeta).toBeUndefined();
    });
  });
});
