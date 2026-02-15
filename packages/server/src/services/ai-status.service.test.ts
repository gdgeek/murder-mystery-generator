/**
 * Tests for AiStatusService
 * Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiStatusService } from './ai-status.service';
import { ConfigLoader } from '../adapters/config-loader';
import { LLMAdapter } from '../adapters/llm-adapter';
import type { RoutingConfig } from '@gdgeek/murder-mystery-shared';

vi.mock('../adapters/config-loader');
vi.mock('../adapters/llm-adapter');

const mockConfig: RoutingConfig = {
  providers: [
    {
      providerName: 'doubao',
      apiKey: 'test-key',
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      defaultModel: 'doubao-seed-1-8-251228',
    },
  ],
  routing: {
    default: { provider: 'doubao' },
  },
};

describe('AiStatusService', () => {
  let service: AiStatusService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiStatusService();
    // Clear env vars
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
  });

  describe('getStatus', () => {
    it('returns configured when config file has valid providers', () => {
      vi.mocked(ConfigLoader.load).mockReturnValue(mockConfig);

      const result = service.getStatus();

      expect(result).toEqual({
        status: 'configured',
        provider: 'doubao',
        model: 'doubao-seed-1-8-251228',
      });
    });

    it('returns configured with model from route when route specifies model', () => {
      const configWithModel: RoutingConfig = {
        ...mockConfig,
        routing: {
          default: { provider: 'doubao', model: 'custom-model' },
        },
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(configWithModel);

      const result = service.getStatus();

      expect(result).toEqual({
        status: 'configured',
        provider: 'doubao',
        model: 'custom-model',
      });
    });

    it('returns configured from env var when no config file', () => {
      vi.mocked(ConfigLoader.load).mockReturnValue(null);
      process.env.LLM_API_KEY = 'env-key';
      process.env.LLM_PROVIDER = 'openai';
      process.env.LLM_MODEL = 'gpt-4';

      const result = service.getStatus();

      expect(result).toEqual({
        status: 'configured',
        provider: 'openai',
        model: 'gpt-4',
      });
    });

    it('returns configured with defaults when env has only LLM_API_KEY', () => {
      vi.mocked(ConfigLoader.load).mockReturnValue(null);
      process.env.LLM_API_KEY = 'env-key';

      const result = service.getStatus();

      expect(result).toEqual({
        status: 'configured',
        provider: 'openai',
        model: 'gpt-4',
      });
    });

    it('returns unconfigured when no config file and no env var', () => {
      vi.mocked(ConfigLoader.load).mockReturnValue(null);

      const result = service.getStatus();

      expect(result).toEqual({ status: 'unconfigured' });
    });

    it('returns unconfigured when config file is invalid', () => {
      vi.mocked(ConfigLoader.load).mockImplementation(() => {
        throw new Error('Config validation failed');
      });

      const result = service.getStatus();

      expect(result).toEqual({ status: 'unconfigured' });
    });

    it('returns unconfigured when config has empty providers', () => {
      vi.mocked(ConfigLoader.load).mockReturnValue({
        providers: [],
        routing: { default: { provider: '' } },
      });

      const result = service.getStatus();

      expect(result).toEqual({ status: 'unconfigured' });
    });
  });

  describe('verify', () => {
    it('returns valid when adapter send succeeds', async () => {
      const mockSendRaw = vi.fn().mockResolvedValue({
        content: 'Hello',
        tokenUsage: { prompt: 1, completion: 1, total: 2 },
        responseTimeMs: 100,
      });
      vi.mocked(LLMAdapter).mockImplementation(() => ({
        send: vi.fn(),
        sendRaw: mockSendRaw,
        getProviderName: vi.fn().mockReturnValue('openai'),
        getDefaultModel: vi.fn().mockReturnValue('gpt-4'),
      }) as unknown as LLMAdapter);

      const result = await service.verify({
        provider: 'openai',
        apiKey: 'test-key',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
      });

      expect(result).toEqual({
        valid: true,
        provider: 'openai',
        model: 'gpt-4',
      });
      expect(LLMAdapter).toHaveBeenCalledWith({
        apiKey: 'test-key',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        provider: 'openai',
      });
      expect(mockSendRaw).toHaveBeenCalledWith({
        prompt: 'Say hi',
        maxTokens: 5,
        temperature: 0,
      });
    });

    it('returns invalid with error when adapter send fails', async () => {
      vi.mocked(LLMAdapter).mockImplementation(() => ({
        send: vi.fn(),
        sendRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
        getProviderName: vi.fn(),
        getDefaultModel: vi.fn(),
      }) as unknown as LLMAdapter);

      const result = await service.verify({
        provider: 'openai',
        apiKey: 'bad-key',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
      });

      expect(result).toEqual({
        valid: false,
        error: 'Connection refused',
      });
    });
  });
});
