import { describe, it, expect, vi } from 'vitest';
import { LLMAdapter } from './llm-adapter';
import { LLMError } from '@murder-mystery/shared';

/** Testable subclass that overrides doFetch and sleep */
class TestLLMAdapter extends LLMAdapter {
  public fetchMock: ReturnType<typeof vi.fn>;
  public sleepCalls: number[] = [];

  constructor(fetchImpl: (...args: unknown[]) => Promise<Response>) {
    super({ apiKey: 'test-key', endpoint: 'https://test.api/v1', model: 'test-model', provider: 'test-provider' });
    this.fetchMock = vi.fn(fetchImpl);
  }

  protected async doFetch(request: unknown): Promise<Response> {
    return this.fetchMock(request);
  }

  protected async sleep(ms: number): Promise<void> {
    this.sleepCalls.push(ms);
    // no actual delay in tests
  }
}

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function successBody(content: string, promptTokens = 10, completionTokens = 20) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  };
}

describe('LLMAdapter', () => {
  it('returns provider name and default model', () => {
    const adapter = new TestLLMAdapter(async () => mockResponse(200, successBody('hi')));
    expect(adapter.getProviderName()).toBe('test-provider');
    expect(adapter.getDefaultModel()).toBe('test-model');
  });

  it('returns content and token usage on success', async () => {
    const adapter = new TestLLMAdapter(async () => mockResponse(200, successBody('hello', 5, 15)));
    const result = await adapter.send({ prompt: 'test' });
    expect(result.content).toBe('hello');
    expect(result.tokenUsage).toEqual({ prompt: 5, completion: 15, total: 20 });
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('retries on 429 with exponential backoff', async () => {
    let callCount = 0;
    const adapter = new TestLLMAdapter(async () => {
      callCount++;
      if (callCount <= 2) return mockResponse(429, {});
      return mockResponse(200, successBody('ok'));
    });

    const result = await adapter.send({ prompt: 'test' });
    expect(result.content).toBe('ok');
    expect(callCount).toBe(3);
    // backoff delays: 1000ms, 2000ms
    expect(adapter.sleepCalls).toEqual([1000, 2000]);
  });

  it('retries on 5xx errors', async () => {
    let callCount = 0;
    const adapter = new TestLLMAdapter(async () => {
      callCount++;
      if (callCount === 1) return mockResponse(503, {});
      return mockResponse(200, successBody('recovered'));
    });

    const result = await adapter.send({ prompt: 'test' });
    expect(result.content).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('throws LLMError after max retries exhausted', async () => {
    const adapter = new TestLLMAdapter(async () => mockResponse(429, {}));

    try {
      await adapter.send({ prompt: 'test' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError);
      const llmErr = err as LLMError;
      expect(llmErr.statusCode).toBe(429);
      expect(llmErr.retryAttempts).toBe(3);
      expect(llmErr.provider).toBe('test-provider');
      expect(llmErr.isRetryable).toBe(true);
    }
  });

  it('does not retry on 4xx (non-429) errors', async () => {
    let callCount = 0;
    const adapter = new TestLLMAdapter(async () => {
      callCount++;
      return mockResponse(400, {});
    });

    try {
      await adapter.send({ prompt: 'test' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError);
      expect((err as LLMError).isRetryable).toBe(false);
      expect(callCount).toBe(1);
    }
  });

  it('retries on network errors', async () => {
    let callCount = 0;
    const adapter = new TestLLMAdapter(async () => {
      callCount++;
      if (callCount === 1) throw new Error('network timeout');
      return mockResponse(200, successBody('ok'));
    });

    const result = await adapter.send({ prompt: 'test' });
    expect(result.content).toBe('ok');
    expect(callCount).toBe(2);
  });

  it('token total equals prompt + completion', async () => {
    const adapter = new TestLLMAdapter(async () => mockResponse(200, successBody('x', 100, 200)));
    const result = await adapter.send({ prompt: 'test' });
    expect(result.tokenUsage.total).toBe(result.tokenUsage.prompt + result.tokenUsage.completion);
  });
});
