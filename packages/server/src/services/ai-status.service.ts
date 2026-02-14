/**
 * AI Status Service
 * Detects server AI configuration status and verifies ephemeral AI configs.
 * Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4
 */

import type { AiStatusResult, AiVerifyResult, EphemeralAiConfig } from '@murder-mystery/shared';
import { ConfigLoader } from '../adapters/config-loader';
import { LLMAdapter } from '../adapters/llm-adapter';

export class AiStatusService {
  /**
   * Check server AI configuration status.
   * Checks config/llm-routing.json and env var LLM_API_KEY.
   */
  getStatus(): AiStatusResult {
    // First check config file
    try {
      const config = ConfigLoader.load();
      if (config && config.providers.length > 0) {
        const defaultRoute = config.routing['default'];
        const provider = defaultRoute?.provider ?? config.providers[0].providerName;
        const providerConfig = config.providers.find(p => p.providerName === provider);
        const model = defaultRoute?.model ?? providerConfig?.defaultModel;
        return { status: 'configured', provider, model };
      }
    } catch {
      // Config file exists but is invalid — treat as unconfigured
    }

    // Fallback: check env var
    if (process.env.LLM_API_KEY) {
      const provider = process.env.LLM_PROVIDER ?? 'openai';
      const model = process.env.LLM_MODEL ?? 'gpt-4';
      return { status: 'configured', provider, model };
    }

    return { status: 'unconfigured' };
  }

  /**
   * Check server AI configuration status with connectivity verification.
   * If configured, verifies the key actually works. If not, returns unconfigured.
   */
  async getStatusVerified(): Promise<AiStatusResult> {
    const status = this.getStatus();
    if (status.status !== 'configured') return status;

    // Verify connectivity — return configured with verified flag
    try {
      const config = ConfigLoader.load();
      if (config && config.providers.length > 0) {
        const provider = status.provider ?? config.providers[0].providerName;
        const providerConfig = config.providers.find(p => p.providerName === provider);
        if (providerConfig) {
          const result = await this.verify({
            provider,
            apiKey: providerConfig.apiKey,
            endpoint: providerConfig.endpoint,
            model: status.model ?? providerConfig.defaultModel ?? '',
          });
          return { ...status, verified: result.valid };
        }
      }
    } catch { /* fall through to env check */ }

    if (process.env.LLM_API_KEY) {
      const provider = process.env.LLM_PROVIDER ?? 'openai';
      const endpoint = process.env.LLM_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
      const model = process.env.LLM_MODEL ?? 'gpt-4';
      const result = await this.verify({
        provider, apiKey: process.env.LLM_API_KEY, endpoint, model,
      });
      return { ...status, verified: result.valid };
    }

    return { ...status, verified: false };
  }

  /**
   * Verify ephemeral AI config connectivity.
   * Creates a temporary adapter and sends a lightweight test request.
   */
  async verify(config: EphemeralAiConfig): Promise<AiVerifyResult> {
    try {
      const adapter = new LLMAdapter({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        model: config.model,
        provider: config.provider,
      });

      await adapter.sendRaw({
        prompt: 'Say hi',
        maxTokens: 5,
        temperature: 0,
      });

      return { valid: true, provider: config.provider, model: config.model };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }
}
