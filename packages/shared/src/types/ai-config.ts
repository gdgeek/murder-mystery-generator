/**
 * 临时 AI 配置相关类型定义
 * Requirements: 1.1, 2.2, 2.3, 4.3, 5.1
 */

/** 临时 AI 配置（用户通过前端输入） */
export interface EphemeralAiConfig {
  provider: string;
  apiKey: string;
  endpoint: string;
  model: string;
}

/** AI 配置状态 */
export interface AiStatusResult {
  status: 'configured' | 'unconfigured';
  provider?: string;
  model?: string;
}

/** AI 配置验证结果 */
export interface AiVerifyResult {
  valid: boolean;
  provider?: string;
  model?: string;
  error?: string;
}

/** 会话中保存的 AI 配置元信息（不含 apiKey） */
export interface AiConfigMeta {
  provider: string;
  model: string;
}

/** Provider 默认值映射 */
export const PROVIDER_DEFAULTS: Record<string, { endpoint: string; model: string }> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-sonnet',
  },
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-seed-1-8-251228',
  },
  custom: {
    endpoint: '',
    model: '',
  },
};
