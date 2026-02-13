/**
 * 临时 AI 配置校验函数
 * Requirements: 2.5
 */

import type { EphemeralAiConfig } from '../types/ai-config';

export interface AiConfigValidationErrors {
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

/**
 * 判断字符串是否为有效 URL 格式。
 * 使用正则匹配 http(s):// 开头的 URL。
 */
function isValidUrl(value: string): boolean {
  const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
  return urlPattern.test(value);
}

/**
 * 校验 EphemeralAiConfig 对象。
 *
 * 规则：
 * - apiKey 不能为空字符串
 * - endpoint 必须是有效 URL 格式
 * - model 不能为空字符串
 *
 * @returns 包含字段级错误的对象，若无错误则返回 null
 */
export function validateEphemeralAiConfig(
  config: EphemeralAiConfig,
): AiConfigValidationErrors | null {
  const errors: AiConfigValidationErrors = {};

  if (config.apiKey === '') {
    errors.apiKey = 'API Key 不能为空';
  }

  if (!isValidUrl(config.endpoint)) {
    errors.endpoint = 'Endpoint 必须是有效的 URL 格式';
  }

  if (config.model === '') {
    errors.model = '模型名称不能为空';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
