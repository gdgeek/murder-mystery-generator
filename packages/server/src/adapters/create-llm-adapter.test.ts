/**
 * Tests for createLLMAdapter factory function.
 * Requirements: 2.4, 5.1, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMAdapter } from './create-llm-adapter';
import { LLMRouter } from './llm-router';
import { ConfigLoader } from './config-loader';
import type { RoutingConfig } from '@gdgeek/murder-mystery-shared';

vi.mock('./config-loader');
vi.mock('./llm-router');

const mockConfig: RoutingConfig = {
  providers: [
    {
      providerName: 'openai',
      apiKey: 'test-key',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4',
    },
  ],
  routing: {
    default: { provider: 'openai' },
  },
};

describe('createLLMAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create LLMRouter from config when config file exists', () => {
    vi.mocked(ConfigLoader.load).mockReturnValue(mockConfig);
    const mockRouter = {} as LLMRouter;
    vi.mocked(LLMRouter).mockImplementation(() => mockRouter as any);

    const adapter = createLLMAdapter();

    expect(ConfigLoader.load).toHaveBeenCalledOnce();
    expect(LLMRouter).toHaveBeenCalledWith(mockConfig);
    expect(adapter).toBe(mockRouter);
  });

  it('should fall back to LLMRouter.fromEnv() when no config file exists', () => {
    vi.mocked(ConfigLoader.load).mockReturnValue(null);
    const mockRouter = {} as LLMRouter;
    vi.mocked(LLMRouter.fromEnv).mockReturnValue(mockRouter);

    const adapter = createLLMAdapter();

    expect(ConfigLoader.load).toHaveBeenCalledOnce();
    expect(LLMRouter.fromEnv).toHaveBeenCalledOnce();
    expect(adapter).toBe(mockRouter);
  });

  it('should propagate errors from ConfigLoader.load()', () => {
    vi.mocked(ConfigLoader.load).mockImplementation(() => {
      throw new Error('Config validation failed: providers[0].apiKey: required');
    });

    expect(() => createLLMAdapter()).toThrow('Config validation failed');
  });
});
