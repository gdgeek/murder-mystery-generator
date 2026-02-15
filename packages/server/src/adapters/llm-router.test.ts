import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LLMRequest,
  LLMError,
  RoutingConfig,
  TaskRoute,
  AggregateRouterError,
} from '@gdgeek/murder-mystery-shared';
import { LLMRouter } from './llm-router';
import { ILLMAdapter } from './llm-adapter.interface';

// ─── Helpers ───

/** Stub adapter that resolves or rejects on send() */
class StubAdapter implements ILLMAdapter {
  constructor(
    public providerName: string,
    private result?: { content: string },
    private error?: LLMError,
  ) {}

  async send(_req: LLMRequest) {
    if (this.error) throw this.error;
    return {
      content: this.result?.content ?? '',
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      responseTimeMs: 10,
    };
  }

  getProviderName() {
    return this.providerName;
  }
  getDefaultModel() {
    return 'stub-model';
  }
  validateApiKey() {}
}

function makeConfig(overrides?: Partial<RoutingConfig>): RoutingConfig {
  return {
    providers: [
      {
        providerName: 'primary',
        apiKey: 'key-a',
        endpoint: 'https://a.test',
        defaultModel: 'model-a',
      },
      {
        providerName: 'fallback1',
        apiKey: 'key-b',
        endpoint: 'https://b.test',
        defaultModel: 'model-b',
      },
    ],
    routing: {
      default: { provider: 'primary', fallback: ['fallback1'] },
      planning: {
        provider: 'primary',
        model: 'gpt-4',
        temperature: 0.8,
        maxTokens: 4096,
        fallback: ['fallback1'],
      },
    },
    defaultLanguage: 'en-US',
    ...overrides,
  };
}

function retryableError(provider: string, statusCode = 429): LLMError {
  return new LLMError(`API error: ${statusCode}`, {
    statusCode,
    retryAttempts: 3,
    provider,
    isRetryable: true,
  });
}

function nonRetryableError(provider: string, statusCode = 401): LLMError {
  return new LLMError(`Auth error: ${statusCode}`, {
    statusCode,
    retryAttempts: 0,
    provider,
    isRetryable: false,
  });
}

// ─── resolveRoute ───

describe('LLMRouter.resolveRoute', () => {
  it('returns matching route for known taskType', () => {
    const router = new LLMRouter(makeConfig());
    const route = router.resolveRoute('planning');
    expect(route.provider).toBe('primary');
    expect(route.model).toBe('gpt-4');
    expect(route.temperature).toBe(0.8);
  });

  it('falls back to default for unknown taskType', () => {
    const router = new LLMRouter(makeConfig());
    const route = router.resolveRoute('unknown_type');
    expect(route.provider).toBe('primary');
    expect(route.model).toBeUndefined();
  });

  it('falls back to default when taskType is undefined', () => {
    const router = new LLMRouter(makeConfig());
    const route = router.resolveRoute(undefined);
    expect(route).toEqual(makeConfig().routing['default']);
  });

  it('falls back to default when taskType is empty string', () => {
    const router = new LLMRouter(makeConfig());
    const route = router.resolveRoute('');
    expect(route).toEqual(makeConfig().routing['default']);
  });
});

// ─── mergeParams ───

describe('LLMRouter.mergeParams', () => {
  it('uses request params when both are set', () => {
    const router = new LLMRouter(makeConfig());
    const req: LLMRequest = { prompt: 'hi', temperature: 0.5, maxTokens: 100 };
    const route: TaskRoute = { provider: 'p', temperature: 0.9, maxTokens: 8000 };
    const merged = router.mergeParams(req, route);
    expect(merged.temperature).toBe(0.5);
    expect(merged.maxTokens).toBe(100);
  });

  it('uses route params when request params are undefined', () => {
    const router = new LLMRouter(makeConfig());
    const req: LLMRequest = { prompt: 'hi' };
    const route: TaskRoute = { provider: 'p', temperature: 0.9, maxTokens: 8000 };
    const merged = router.mergeParams(req, route);
    expect(merged.temperature).toBe(0.9);
    expect(merged.maxTokens).toBe(8000);
  });

  it('leaves params undefined when neither sets them', () => {
    const router = new LLMRouter(makeConfig());
    const req: LLMRequest = { prompt: 'hi' };
    const route: TaskRoute = { provider: 'p' };
    const merged = router.mergeParams(req, route);
    expect(merged.temperature).toBeUndefined();
    expect(merged.maxTokens).toBeUndefined();
  });
});

// ─── injectLanguageDirective ───

describe('LLMRouter.injectLanguageDirective', () => {
  it('prepends directive to existing systemPrompt', () => {
    const router = new LLMRouter(makeConfig());
    const req: LLMRequest = { prompt: 'hi', systemPrompt: 'You are helpful.' };
    const result = router.injectLanguageDirective(req, 'zh-CN');
    expect(result.systemPrompt).toBe('请使用中文回答。\nYou are helpful.');
  });

  it('sets directive as systemPrompt when none exists', () => {
    const router = new LLMRouter(makeConfig());
    const req: LLMRequest = { prompt: 'hi' };
    const result = router.injectLanguageDirective(req, 'en-US');
    expect(result.systemPrompt).toBe('Please respond in English.');
  });

  it('falls back to defaultLanguage for unsupported language', () => {
    const router = new LLMRouter(makeConfig({ defaultLanguage: 'zh-CN' }));
    const req: LLMRequest = { prompt: 'hi' };
    const result = router.injectLanguageDirective(req, 'fr-FR');
    expect(result.systemPrompt).toBe('请使用中文回答。');
  });
});

// ─── send ───

describe('LLMRouter.send', () => {
  /**
   * To test send() we need to inject stub adapters.
   * We'll use a helper that replaces the internal adapters map.
   */
  function injectAdapters(
    router: LLMRouter,
    stubs: Map<string, ILLMAdapter>,
  ) {
    // Access private field for testing
    (router as any).adapters = stubs;
  }

  it('routes to primary provider and returns response', async () => {
    const router = new LLMRouter(makeConfig());
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set('primary', new StubAdapter('primary', { content: 'hello' }));
    stubs.set('fallback1', new StubAdapter('fallback1', { content: 'fb' }));
    injectAdapters(router, stubs);

    const res = await router.send({ prompt: 'test' });
    expect(res.content).toBe('hello');
  });

  it('falls back on retryable error from primary', async () => {
    const router = new LLMRouter(makeConfig());
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set(
      'primary',
      new StubAdapter('primary', undefined, retryableError('primary')),
    );
    stubs.set('fallback1', new StubAdapter('fallback1', { content: 'from-fb' }));
    injectAdapters(router, stubs);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await router.send({ prompt: 'test' });
    expect(res.content).toBe('from-fb');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws immediately on non-retryable error, skips fallback', async () => {
    const router = new LLMRouter(makeConfig());
    const stubs = new Map<string, ILLMAdapter>();
    const sendSpy = vi.fn();
    stubs.set(
      'primary',
      new StubAdapter('primary', undefined, nonRetryableError('primary')),
    );
    const fbAdapter = new StubAdapter('fallback1', { content: 'fb' });
    fbAdapter.send = sendSpy;
    stubs.set('fallback1', fbAdapter);
    injectAdapters(router, stubs);

    await expect(router.send({ prompt: 'test' })).rejects.toThrow(LLMError);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('throws AggregateRouterError when all providers fail with retryable errors', async () => {
    const router = new LLMRouter(makeConfig());
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set(
      'primary',
      new StubAdapter('primary', undefined, retryableError('primary', 500)),
    );
    stubs.set(
      'fallback1',
      new StubAdapter('fallback1', undefined, retryableError('fallback1', 503)),
    );
    injectAdapters(router, stubs);

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await router.send({ prompt: 'test' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AggregateRouterError);
      const aggErr = err as AggregateRouterError;
      expect(aggErr.attempts).toHaveLength(2);
      expect(aggErr.attempts[0].provider).toBe('primary');
      expect(aggErr.attempts[1].provider).toBe('fallback1');
    }
    vi.restoreAllMocks();
  });

  it('injects language directive from request.language', async () => {
    const router = new LLMRouter(makeConfig());
    const captured: LLMRequest[] = [];
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set('primary', {
      send: async (req) => {
        captured.push(req);
        return { content: 'ok', tokenUsage: { prompt: 0, completion: 0, total: 0 }, responseTimeMs: 1 };
      },
      getProviderName: () => 'primary',
      getDefaultModel: () => 'model-a',
      validateApiKey: () => {},
    });
    injectAdapters(router, stubs);

    await router.send({ prompt: 'test', language: 'zh-CN' });
    expect(captured[0].systemPrompt).toContain('请使用中文回答。');
  });

  it('uses config defaultLanguage when request has no language', async () => {
    const router = new LLMRouter(makeConfig({ defaultLanguage: 'zh-CN' }));
    const captured: LLMRequest[] = [];
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set('primary', {
      send: async (req) => {
        captured.push(req);
        return { content: 'ok', tokenUsage: { prompt: 0, completion: 0, total: 0 }, responseTimeMs: 1 };
      },
      getProviderName: () => 'primary',
      getDefaultModel: () => 'model-a',
      validateApiKey: () => {},
    });
    injectAdapters(router, stubs);

    await router.send({ prompt: 'test' });
    expect(captured[0].systemPrompt).toContain('请使用中文回答。');
  });

  it('merges route params into request', async () => {
    const router = new LLMRouter(makeConfig());
    const captured: LLMRequest[] = [];
    const stubs = new Map<string, ILLMAdapter>();
    stubs.set('primary', {
      send: async (req) => {
        captured.push(req);
        return { content: 'ok', tokenUsage: { prompt: 0, completion: 0, total: 0 }, responseTimeMs: 1 };
      },
      getProviderName: () => 'primary',
      getDefaultModel: () => 'model-a',
      validateApiKey: () => {},
    });
    injectAdapters(router, stubs);

    await router.send({ prompt: 'test', taskType: 'planning' as any });
    expect(captured[0].temperature).toBe(0.8);
    expect(captured[0].maxTokens).toBe(4096);
  });
});

// ─── getProviderName / getDefaultModel ───

describe('LLMRouter metadata', () => {
  it('getProviderName returns default route provider', () => {
    const router = new LLMRouter(makeConfig());
    expect(router.getProviderName()).toBe('primary');
  });

  it('getDefaultModel returns provider defaultModel when route has no model', () => {
    const router = new LLMRouter(makeConfig());
    expect(router.getDefaultModel()).toBe('model-a');
  });

  it('getDefaultModel returns route model when specified', () => {
    const config = makeConfig();
    config.routing['default'] = { provider: 'primary', model: 'custom-model' };
    const router = new LLMRouter(config);
    expect(router.getDefaultModel()).toBe('custom-model');
  });
});

// ─── fromEnv ───

describe('LLMRouter.fromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates single-provider config from env vars', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_ENDPOINT = 'https://api.anthropic.com/v1/messages';
    process.env.LLM_MODEL = 'claude-3-sonnet';

    const router = LLMRouter.fromEnv();
    expect(router.getProviderName()).toBe('anthropic');
    expect(router.getDefaultModel()).toBe('claude-3-sonnet');
  });

  it('uses openai defaults when env vars are not set', () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_ENDPOINT;
    delete process.env.LLM_MODEL;

    const router = LLMRouter.fromEnv();
    expect(router.getProviderName()).toBe('openai');
    expect(router.getDefaultModel()).toBe('gpt-4');
  });
});
