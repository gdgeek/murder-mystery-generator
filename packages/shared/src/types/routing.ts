/**
 * 路由配置相关类型定义
 * Requirements: 2.2, 2.3
 */

import { SupportedLanguage } from './script';

/** 提供商配置 */
export interface ProviderConfig {
  providerName: string;
  apiKey: string;
  endpoint: string;
  defaultModel: string;
}

/** 任务路由规则 */
export interface TaskRoute {
  provider: string; // 引用 ProviderConfig.providerName
  model?: string; // 覆盖 provider 的 defaultModel
  temperature?: number;
  maxTokens?: number;
  fallback?: string[]; // 按优先级排列的备选 provider 名称列表
}

/** 路由配置根结构 */
export interface RoutingConfig {
  providers: ProviderConfig[];
  routing: Record<string, TaskRoute>; // key = TaskType 字符串
  defaultLanguage?: SupportedLanguage; // 默认 'en-US'
}

/** Fallback 链中单次尝试的记录 */
export interface ProviderAttempt {
  provider: string;
  error: string;
  statusCode?: number;
  retryAttempts: number;
}

/** 聚合错误：所有提供商均失败时抛出 */
export class AggregateRouterError extends Error {
  attempts: ProviderAttempt[];

  constructor(attempts: ProviderAttempt[]) {
    const summary = attempts
      .map((a) => `${a.provider}: ${a.error}`)
      .join('; ');
    super(`All providers failed: ${summary}`);
    this.name = 'AggregateRouterError';
    this.attempts = attempts;
  }
}
