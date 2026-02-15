/**
 * LLMRouter - 多模型路由器
 * 实现 ILLMAdapter 接口，按任务类型路由请求，执行 fallback 链，注入语言指令。
 * Requirements: 1.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4, 7.3, 7.4, 7.5
 */

import {
  LLMRequest,
  LLMResponse,
  LLMError,
  RoutingConfig,
  TaskRoute,
  AggregateRouterError,
  ProviderAttempt,
  SupportedLanguage,
} from '@gdgeek/murder-mystery-shared';
import { ILLMAdapter } from './llm-adapter.interface';
import { LLMAdapter } from './llm-adapter';
import { getLanguageDirective } from './language-directives';

export class LLMRouter implements ILLMAdapter {
  private adapters: Map<string, LLMAdapter>;
  private config: RoutingConfig;

  constructor(config: RoutingConfig) {
    this.config = config;
    this.adapters = new Map();
    for (const provider of config.providers) {
      this.adapters.set(
        provider.providerName,
        new LLMAdapter({
          apiKey: provider.apiKey,
          endpoint: provider.endpoint,
          model: provider.defaultModel,
          provider: provider.providerName,
        }),
      );
    }
  }

  /**
   * 根据 taskType 解析路由规则，未匹配时回退到 default。
   * Made public for property-based testing (Property 5, 6).
   */
  resolveRoute(taskType?: string): TaskRoute {
    if (taskType && taskType in this.config.routing) {
      return this.config.routing[taskType];
    }
    return this.config.routing['default'];
  }

  /**
   * 合并路由配置参数到请求中（请求自身参数优先）。
   * Made public for property-based testing (Property 7).
   */
  mergeParams(request: LLMRequest, route: TaskRoute): LLMRequest {
    return {
      ...request,
      temperature: request.temperature ?? route.temperature,
      maxTokens: request.maxTokens ?? route.maxTokens,
      ...(route.model ? { model: route.model } : {}),
    };
  }

  /**
   * 根据语言设置在 systemPrompt 前注入语言指令。
   */
  injectLanguageDirective(request: LLMRequest, language: string): LLMRequest {
    const defaultLang = this.config.defaultLanguage ?? 'en-US';
    const directive = getLanguageDirective(language, defaultLang);

    const systemPrompt = request.systemPrompt
      ? `${directive}\n${request.systemPrompt}`
      : directive;

    return { ...request, systemPrompt };
  }

  /**
   * 判断错误是否可重试（429 或 5xx）。
   */
  private isRetryableError(error: LLMError): boolean {
    return error.isRetryable;
  }

  /**
   * 发送请求：路由 → 参数合并 → 语言注入 → 主模型 → fallback。
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const route = this.resolveRoute(request.taskType);
    const mergedRequest = this.mergeParams(request, route);
    const language = request.language ?? this.config.defaultLanguage ?? 'en-US';
    const finalRequest = this.injectLanguageDirective(mergedRequest, language);

    // Build provider chain: primary + fallbacks
    const providerChain = [route.provider, ...(route.fallback ?? [])];
    const attempts: ProviderAttempt[] = [];

    for (const providerName of providerChain) {
      const adapter = this.adapters.get(providerName);
      if (!adapter) {
        attempts.push({
          provider: providerName,
          error: `Provider "${providerName}" not found in adapters`,
          retryAttempts: 0,
        });
        continue;
      }

      try {
        return await adapter.send(finalRequest);
      } catch (err) {
        if (err instanceof LLMError) {
          attempts.push({
            provider: providerName,
            error: err.message,
            statusCode: err.statusCode,
            retryAttempts: err.retryAttempts,
          });

          // Non-retryable errors: throw immediately, skip fallback
          if (!this.isRetryableError(err)) {
            throw err;
          }

          // Retryable error: log and try next fallback
          console.warn(
            `[LLMRouter] Provider "${providerName}" failed with ${err.statusCode ?? 'unknown'}, switching to next fallback`,
          );
          continue;
        }

        // Unknown error: record and continue
        attempts.push({
          provider: providerName,
          error: (err as Error).message,
          retryAttempts: 0,
        });
        console.warn(
          `[LLMRouter] Provider "${providerName}" failed with unknown error, switching to next fallback`,
        );
      }
    }

    // All providers failed
    throw new AggregateRouterError(attempts);
  }

  /** 返回默认路由的提供商名称 */
  getProviderName(): string {
    const defaultRoute = this.config.routing['default'];
    return defaultRoute?.provider ?? this.config.providers[0]?.providerName ?? 'unknown';
  }

  /** 返回默认路由的模型名称 */
  getDefaultModel(): string {
    const defaultRoute = this.config.routing['default'];
    if (defaultRoute?.model) return defaultRoute.model;
    const provider = this.config.providers.find(
      (p) => p.providerName === defaultRoute?.provider,
    );
    return provider?.defaultModel ?? 'unknown';
  }

  /** Validate all provider API keys before making any LLM calls */
  validateApiKey(): void {
    for (const [name, adapter] of this.adapters) {
      adapter.validateApiKey();
    }
  }

  /**
   * 从环境变量构建单提供商回退配置。
   * Requirements: 5.1
   */
  static fromEnv(): LLMRouter {
    const providerName = process.env.LLM_PROVIDER ?? 'openai';
    const config: RoutingConfig = {
      providers: [
        {
          providerName,
          apiKey: process.env.LLM_API_KEY ?? '',
          endpoint:
            process.env.LLM_ENDPOINT ??
            'https://api.openai.com/v1/chat/completions',
          defaultModel: process.env.LLM_MODEL ?? 'gpt-4',
        },
      ],
      routing: {
        default: {
          provider: providerName,
        },
      },
    };
    return new LLMRouter(config);
  }
}
