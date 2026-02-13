/**
 * **Feature: ephemeral-ai-config, Property 2: apiKey 不出现在序列化输出中**
 *
 * 对于任意包含 ephemeralAiConfig 的 AuthoringSession，将其序列化为 JSON（用于数据库存储或 API 响应）后，
 * 输出字符串中不包含原始 apiKey 值，且 aiConfigMeta 仅包含 provider 和 model 字段。
 *
 * **Validates: Requirements 4.1, 4.3, 4.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

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
  })),
}));

import { pool } from '../../db/mysql';
import { AuthoringService } from './authoring.service';
import { ILLMAdapter } from '../../adapters/llm-adapter.interface';
import { SkillService } from '../skill.service';
import { GeneratorService } from '../generator.service';
import { ConfigService } from '../config.service';
import type { EphemeralAiConfig } from '@murder-mystery/shared';

const mockPool = pool as unknown as { execute: ReturnType<typeof vi.fn> };

function makeMockLLM(): ILLMAdapter {
  return {
    send: vi.fn(),
    getProviderName: () => 'default-provider',
    getDefaultModel: () => 'default-model',
  };
}

function makeService() {
  const llm = makeMockLLM();
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

/** Generate a non-empty string for apiKey (must be non-empty to be meaningful) */
const nonEmptyApiKey = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

/** Generate a valid provider name */
const providerArb = fc.constantFrom('openai', 'anthropic', 'doubao', 'custom');

/** Generate a valid URL */
const validUrlArb = fc.webUrl();

/** Generate a non-empty model name */
const nonEmptyModel = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

/** Generate an arbitrary EphemeralAiConfig with a meaningful apiKey */
const ephemeralAiConfigArb = fc.record({
  provider: providerArb,
  apiKey: nonEmptyApiKey,
  endpoint: validUrlArb,
  model: nonEmptyModel,
});

describe('Property 2: apiKey 不出现在序列化输出中', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  it('apiKey never appears in the DB INSERT params when creating a session with ephemeralAiConfig', async () => {
    await fc.assert(
      fc.asyncProperty(ephemeralAiConfigArb, async (config: EphemeralAiConfig) => {
        vi.clearAllMocks();
        mockPool.execute.mockResolvedValue([[], []]);

        const service = makeService();
        const session = await service.createSession('cfg-1', 'staged', config);

        // Get the INSERT call params
        const [query, params] = mockPool.execute.mock.calls[0];
        expect(query).toContain('INSERT INTO authoring_sessions');

        // Serialize all params to a single string to check for apiKey leakage
        const serializedParams = JSON.stringify(params);

        // The apiKey must NOT appear anywhere in the serialized DB params
        if (config.apiKey.length >= 3) {
          // Only check for non-trivial apiKeys to avoid false positives with very short strings
          expect(serializedParams).not.toContain(config.apiKey);
        }

        // aiConfigMeta must only have provider and model
        expect(session.aiConfigMeta).toBeDefined();
        expect(Object.keys(session.aiConfigMeta!)).toEqual(['provider', 'model']);
        expect(session.aiConfigMeta!.provider).toBe(config.provider);
        expect(session.aiConfigMeta!.model).toBe(config.model);
      }),
      { numRuns: 100 },
    );
  });

  it('aiConfigMeta in serialized session JSON never contains apiKey field', async () => {
    await fc.assert(
      fc.asyncProperty(ephemeralAiConfigArb, async (config: EphemeralAiConfig) => {
        vi.clearAllMocks();
        mockPool.execute.mockResolvedValue([[], []]);

        const service = makeService();
        const session = await service.createSession('cfg-1', 'staged', config);

        // Serialize the entire session to JSON (simulating API response)
        const sessionJson = JSON.stringify(session);

        // The apiKey must NOT appear in the serialized session
        if (config.apiKey.length >= 3) {
          expect(sessionJson).not.toContain(config.apiKey);
        }

        // Parse back and verify aiConfigMeta structure
        const parsed = JSON.parse(sessionJson);
        expect(parsed.aiConfigMeta).toBeDefined();
        expect(parsed.aiConfigMeta).toEqual({
          provider: config.provider,
          model: config.model,
        });
        expect(parsed.aiConfigMeta).not.toHaveProperty('apiKey');
        expect(parsed.aiConfigMeta).not.toHaveProperty('endpoint');
      }),
      { numRuns: 100 },
    );
  });
});
