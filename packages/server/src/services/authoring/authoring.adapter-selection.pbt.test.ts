/**
 * **Feature: ephemeral-ai-config, Property 3: 适配器选择一致性**
 *
 * 对于任意会话 ID，若 sessionAdapters Map 中存在该 ID 的条目，则 getAdapterForSession 返回该临时适配器；
 * 若不存在且服务器已配置 AI，则返回默认适配器；若不存在且服务器未配置 AI，则抛出错误。
 * 三种情况互斥且完备。
 *
 * **Validates: Requirements 3.2, 3.3, 3.4**
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
    validateApiKey: vi.fn(),
    _isEphemeral: true,
  })),
}));

import { pool } from '../../db/mysql';
import { AuthoringService } from './authoring.service';
import { ILLMAdapter } from '../../adapters/llm-adapter.interface';
import { SkillService } from '../skill.service';
import { GeneratorService } from '../generator.service';
import { ConfigService } from '../config.service';
import type { EphemeralAiConfig } from '@gdgeek/murder-mystery-shared';

const mockPool = pool as unknown as { execute: ReturnType<typeof vi.fn> };

function makeMockLLM(name = 'default'): ILLMAdapter {
  return {
    send: vi.fn(),
    getProviderName: () => `${name}-provider`,
    getDefaultModel: () => `${name}-model`,
    validateApiKey: vi.fn(),
  };
}

function makeConfigService() {
  return {
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
}

/** Arbitrary session ID */
const sessionIdArb = fc.uuid();

/** Arbitrary EphemeralAiConfig */
const ephemeralConfigArb = fc.record({
  provider: fc.constantFrom('openai', 'anthropic', 'doubao'),
  apiKey: fc.string({ minLength: 1 }),
  endpoint: fc.webUrl(),
  model: fc.string({ minLength: 1 }),
});

describe('Property 3: 适配器选择一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
  });

  it('Case 1: returns ephemeral adapter when sessionAdapters has the sessionId', async () => {
    await fc.assert(
      fc.asyncProperty(ephemeralConfigArb, async (config: EphemeralAiConfig) => {
        vi.clearAllMocks();
        mockPool.execute.mockResolvedValue([[], []]);

        const defaultLlm = makeMockLLM('default');
        const skillService = new SkillService();
        const generatorService = new GeneratorService(defaultLlm, skillService);
        const service = new AuthoringService(defaultLlm, skillService, generatorService, makeConfigService());

        // Create session with ephemeral config → adapter gets cached
        const session = await service.createSession('cfg-1', 'staged', config);

        // getAdapterForSession must return the ephemeral adapter, NOT the default
        const adapter = service.getAdapterForSession(session.id);
        expect(adapter).not.toBe(defaultLlm);
        expect(adapter.getProviderName()).toBe(config.provider);
      }),
      { numRuns: 100 },
    );
  });

  it('Case 2: returns default adapter when no cached adapter and server is configured', () => {
    fc.assert(
      fc.property(sessionIdArb, (sessionId: string) => {
        const defaultLlm = makeMockLLM('default');
        const skillService = new SkillService();
        const generatorService = new GeneratorService(defaultLlm, skillService);
        const service = new AuthoringService(defaultLlm, skillService, generatorService, makeConfigService());

        // No ephemeral adapter cached for this sessionId
        const adapter = service.getAdapterForSession(sessionId);

        // Must return the default adapter
        expect(adapter).toBe(defaultLlm);
      }),
      { numRuns: 100 },
    );
  });

  it('Case 3: throws error when no cached adapter and server is not configured', () => {
    fc.assert(
      fc.property(sessionIdArb, (sessionId: string) => {
        const nullLlm = null as unknown as ILLMAdapter;
        const skillService = new SkillService();
        const generatorService = new GeneratorService(makeMockLLM(), skillService);
        const service = new AuthoringService(nullLlm, skillService, generatorService, makeConfigService());

        // Must throw
        expect(() => service.getAdapterForSession(sessionId))
          .toThrow('No AI configuration available. Please provide ephemeralAiConfig.');
      }),
      { numRuns: 100 },
    );
  });

  it('three cases are mutually exclusive and exhaustive for any sessionId', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionIdArb,
        fc.boolean(), // hasEphemeralAdapter
        fc.boolean(), // hasDefaultAdapter
        ephemeralConfigArb,
        async (sessionId, hasEphemeralAdapter, hasDefaultAdapter, config) => {
          vi.clearAllMocks();
          mockPool.execute.mockResolvedValue([[], []]);

          const defaultLlm = hasDefaultAdapter ? makeMockLLM('default') : (null as unknown as ILLMAdapter);
          const skillService = new SkillService();
          const generatorService = new GeneratorService(makeMockLLM(), skillService);
          const service = new AuthoringService(defaultLlm, skillService, generatorService, makeConfigService());

          // Optionally cache an ephemeral adapter
          let cachedSessionId: string | undefined;
          if (hasEphemeralAdapter) {
            const session = await service.createSession('cfg-1', 'staged', config);
            cachedSessionId = session.id;
          }

          // Determine which sessionId to query
          const queryId = hasEphemeralAdapter ? cachedSessionId! : sessionId;

          if (hasEphemeralAdapter && queryId === cachedSessionId) {
            // Case 1: ephemeral adapter exists
            const adapter = service.getAdapterForSession(queryId);
            expect(adapter).not.toBe(defaultLlm);
            expect(adapter.getProviderName()).toBe(config.provider);
          } else if (hasDefaultAdapter) {
            // Case 2: no ephemeral, but default exists
            const adapter = service.getAdapterForSession(queryId);
            expect(adapter).toBe(defaultLlm);
          } else {
            // Case 3: no ephemeral, no default
            expect(() => service.getAdapterForSession(queryId))
              .toThrow('No AI configuration available. Please provide ephemeralAiConfig.');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('adapter selection is deterministic - same input always gives same result', async () => {
    await fc.assert(
      fc.asyncProperty(ephemeralConfigArb, async (config: EphemeralAiConfig) => {
        vi.clearAllMocks();
        mockPool.execute.mockResolvedValue([[], []]);

        const defaultLlm = makeMockLLM('default');
        const skillService = new SkillService();
        const generatorService = new GeneratorService(defaultLlm, skillService);
        const service = new AuthoringService(defaultLlm, skillService, generatorService, makeConfigService());

        const session = await service.createSession('cfg-1', 'staged', config);

        // Call getAdapterForSession multiple times — must always return the same adapter
        const adapter1 = service.getAdapterForSession(session.id);
        const adapter2 = service.getAdapterForSession(session.id);
        const adapter3 = service.getAdapterForSession(session.id);

        expect(adapter1).toBe(adapter2);
        expect(adapter2).toBe(adapter3);
      }),
      { numRuns: 100 },
    );
  });
});
