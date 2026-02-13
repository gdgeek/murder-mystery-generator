/**
 * ConfigLoader - 加载、校验、序列化路由配置
 * Requirements: 2.1, 2.5, 2.6, 2.7, 6.1, 6.2, 6.4, 6.5
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RoutingConfig,
  ProviderConfig,
  TaskRoute,
  ValidationError,
  SupportedLanguage,
} from '@murder-mystery/shared';

const DEFAULT_CONFIG_PATH = 'config/llm-routing.json';
const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en-US', 'zh-CN'];

export class ConfigLoader {
  /**
   * 从文件路径加载并校验配置。
   * 若文件不存在，返回 null（由 Router 回退到环境变量）。
   * 若文件格式无效，抛出含具体校验错误的异常。
   */
  static load(filePath?: string): RoutingConfig | null {
    const resolvedPath = resolve(filePath ?? DEFAULT_CONFIG_PATH);

    if (!existsSync(resolvedPath)) {
      return null;
    }

    const raw = readFileSync(resolvedPath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON in config file: ' + resolvedPath);
    }

    const errors = ConfigLoader.validate(parsed);
    if (errors.length > 0) {
      const details = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Config validation failed: ${details}`);
    }

    const config = ConfigLoader.parse(raw);
    return ConfigLoader.applyEnvOverrides(config);
  }

  /**
   * 校验配置对象，返回校验错误列表。
   * 检查：必填字段、routing 引用的 provider 是否存在、语言代码合法性。
   */
  static validate(config: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config === null || typeof config !== 'object') {
      errors.push({
        field: 'config',
        message: 'Config must be a non-null object',
        constraint: 'required',
      });
      return errors;
    }

    const obj = config as Record<string, unknown>;

    // Check providers array
    if (!Array.isArray(obj.providers)) {
      errors.push({
        field: 'providers',
        message: 'providers is required and must be an array',
        constraint: 'required',
      });
    } else {
      const providerNames = new Set<string>();
      for (let i = 0; i < obj.providers.length; i++) {
        const p = obj.providers[i] as Record<string, unknown>;
        if (!p || typeof p !== 'object') {
          errors.push({
            field: `providers[${i}]`,
            message: 'Each provider must be an object',
            constraint: 'type',
          });
          continue;
        }
        for (const field of [
          'providerName',
          'apiKey',
          'endpoint',
          'defaultModel',
        ] as const) {
          if (typeof p[field] !== 'string' || (p[field] as string).trim() === '') {
            errors.push({
              field: `providers[${i}].${field}`,
              message: `${field} is required and must be a non-empty string`,
              constraint: 'required',
            });
          }
        }
        if (typeof p.providerName === 'string') {
          providerNames.add(p.providerName);
        }
      }

      // Check routing references (only if providers is valid)
      if (obj.routing && typeof obj.routing === 'object' && !Array.isArray(obj.routing)) {
        const routing = obj.routing as Record<string, unknown>;
        for (const [taskType, route] of Object.entries(routing)) {
          if (!route || typeof route !== 'object') continue;
          const r = route as Record<string, unknown>;
          if (typeof r.provider === 'string' && !providerNames.has(r.provider)) {
            errors.push({
              field: `routing.${taskType}.provider`,
              message: `Provider "${r.provider}" is not defined in providers`,
              constraint: 'reference',
            });
          }
          if (Array.isArray(r.fallback)) {
            for (const fb of r.fallback) {
              if (typeof fb === 'string' && !providerNames.has(fb)) {
                errors.push({
                  field: `routing.${taskType}.fallback`,
                  message: `Fallback provider "${fb}" is not defined in providers`,
                  constraint: 'reference',
                });
              }
            }
          }
        }
      }
    }

    // Check routing object
    if (!obj.routing || typeof obj.routing !== 'object' || Array.isArray(obj.routing)) {
      errors.push({
        field: 'routing',
        message: 'routing is required and must be an object',
        constraint: 'required',
      });
    } else {
      const routing = obj.routing as Record<string, unknown>;
      if (!('default' in routing)) {
        errors.push({
          field: 'routing.default',
          message: 'routing must contain a "default" key',
          constraint: 'required',
        });
      }
      for (const [taskType, route] of Object.entries(routing)) {
        if (!route || typeof route !== 'object') {
          errors.push({
            field: `routing.${taskType}`,
            message: 'Each route must be an object',
            constraint: 'type',
          });
          continue;
        }
        const r = route as Record<string, unknown>;
        if (typeof r.provider !== 'string' || r.provider.trim() === '') {
          errors.push({
            field: `routing.${taskType}.provider`,
            message: 'provider is required and must be a non-empty string',
            constraint: 'required',
          });
        }
      }
    }

    // Check defaultLanguage (optional, but if present must be valid)
    if (obj.defaultLanguage !== undefined) {
      if (!SUPPORTED_LANGUAGES.includes(obj.defaultLanguage as SupportedLanguage)) {
        errors.push({
          field: 'defaultLanguage',
          message: `defaultLanguage must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
          constraint: 'enum',
        });
      }
    }

    return errors;
  }

  /**
   * 将 RoutingConfig 序列化为 JSON 字符串（2-space indent）。
   */
  static serialize(config: RoutingConfig): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * 从 JSON 字符串解析为 RoutingConfig，只保留已知字段（忽略未知字段）。
   */
  static parse(json: string): RoutingConfig {
    const raw = JSON.parse(json);

    const providers: ProviderConfig[] = Array.isArray(raw.providers)
      ? raw.providers.map((p: Record<string, unknown>) => ({
          providerName: p.providerName,
          apiKey: p.apiKey,
          endpoint: p.endpoint,
          defaultModel: p.defaultModel,
        }))
      : [];

    const routing: Record<string, TaskRoute> = {};
    if (raw.routing && typeof raw.routing === 'object') {
      for (const [key, value] of Object.entries(
        raw.routing as Record<string, Record<string, unknown>>,
      )) {
        const route: TaskRoute = { provider: value.provider as string };
        if (value.model !== undefined) route.model = value.model as string;
        if (value.temperature !== undefined) route.temperature = value.temperature as number;
        if (value.maxTokens !== undefined) route.maxTokens = value.maxTokens as number;
        if (Array.isArray(value.fallback)) route.fallback = value.fallback as string[];
        routing[key] = route;
      }
    }

    const config: RoutingConfig = { providers, routing };
    if (raw.defaultLanguage !== undefined) {
      config.defaultLanguage = raw.defaultLanguage as SupportedLanguage;
    }

    return config;
  }

  /**
   * 应用环境变量覆盖 provider 的 apiKey。
   * 格式：LLM_PROVIDER_{PROVIDER_NAME_UPPERCASE}_API_KEY
   */
  static applyEnvOverrides(config: RoutingConfig): RoutingConfig {
    const providers = config.providers.map((p) => {
      const envKey = `LLM_PROVIDER_${p.providerName.toUpperCase()}_API_KEY`;
      const envValue = process.env[envKey];
      if (envValue) {
        return { ...p, apiKey: envValue };
      }
      return { ...p };
    });

    return { ...config, providers };
  }
}
