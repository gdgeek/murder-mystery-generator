/**
 * LLMAdapter - LLM适配器实现
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import {
  LLMRequest,
  LLMResponse,
  LLMError,
  LLM_RETRY_CONFIG,
} from '@murder-mystery/shared';
import { ILLMAdapter } from './llm-adapter.interface';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export class LLMAdapter implements ILLMAdapter {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private provider: string;

  constructor(opts?: { apiKey?: string; endpoint?: string; model?: string; provider?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.LLM_API_KEY ?? '';
    this.endpoint = opts?.endpoint ?? process.env.LLM_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
    this.model = opts?.model ?? process.env.LLM_MODEL ?? 'gpt-4';
    this.provider = opts?.provider ?? process.env.LLM_PROVIDER ?? 'openai';
  }

  getProviderName(): string {
    return this.provider;
  }

  getDefaultModel(): string {
    return this.model;
  }

  /**
   * Send a request to the LLM with exponential backoff retry.
   * Requirements 9.3, 9.4, 9.5
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const { maxRetries, baseDelayMs, backoffMultiplier } = LLM_RETRY_CONFIG;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        await this.sleep(delay);
      }

      const startTime = Date.now();

      try {
        const response = await this.doFetch(request);
        const responseTimeMs = Date.now() - startTime;

        if (!response.ok) {
          const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
          const errBody = await response.text();
          console.error(`[LLMAdapter] Error ${response.status} from ${this.provider}/${this.model}:`, errBody.slice(0, 500));

          if (isRetryable && attempt < maxRetries) {
            lastError = new LLMError(
              `LLM API error: ${response.status}`,
              { statusCode: response.status, retryAttempts: attempt + 1, provider: this.provider, isRetryable: true },
            );
            continue;
          }

          throw new LLMError(
            `LLM API error: ${response.status}`,
            { statusCode: response.status, retryAttempts: attempt, provider: this.provider, isRetryable },
          );
        }

        const body = await response.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
        const content = body.choices?.[0]?.message?.content ?? '';
        const usage = body.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        console.log(`[LLMAdapter] Response from ${this.provider}/${this.model} (${responseTimeMs}ms, tokens: ${usage.prompt_tokens}+${usage.completion_tokens}=${usage.prompt_tokens + usage.completion_tokens})`);
        console.log(`[LLMAdapter] Content (first 2000 chars):\n${content.slice(0, 2000)}`);
        if (content.length > 2000) {
          console.log(`[LLMAdapter] ... (total ${content.length} chars)`);
        }

        return {
          content,
          tokenUsage: {
            prompt: usage.prompt_tokens,
            completion: usage.completion_tokens,
            total: usage.prompt_tokens + usage.completion_tokens,
          },
          responseTimeMs,
        };
      } catch (err) {
        if (err instanceof LLMError) {
          lastError = err;
          if (!err.isRetryable || attempt >= maxRetries) throw err;
          continue;
        }
        // Network errors are retryable
        lastError = err as Error;
        if (attempt >= maxRetries) {
          throw new LLMError(
            `LLM request failed: ${(err as Error).message}`,
            { retryAttempts: attempt, provider: this.provider, isRetryable: true },
          );
        }
      }
    }

    throw lastError ?? new Error('Unexpected LLM error');
  }

  /** Overridable for testing */
  protected async doFetch(request: LLMRequest): Promise<Response> {
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    return fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        response_format: { type: 'json_object' },
      }),
    });
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
