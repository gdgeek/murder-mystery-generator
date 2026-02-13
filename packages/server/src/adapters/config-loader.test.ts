import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigLoader } from './config-loader';
import { RoutingConfig } from '@murder-mystery/shared';

const TEST_DIR = join(__dirname, '__test_config__');
const TEST_CONFIG_PATH = join(TEST_DIR, 'test-config.json');

function validConfig(): RoutingConfig {
  return {
    providers: [
      {
        providerName: 'openai',
        apiKey: 'sk-test-key',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4',
      },
      {
        providerName: 'anthropic',
        apiKey: 'sk-ant-key',
        endpoint: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-3-sonnet',
      },
    ],
    routing: {
      default: { provider: 'openai', fallback: ['anthropic'] },
      planning: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.8,
        maxTokens: 4096,
        fallback: ['anthropic'],
      },
    },
    defaultLanguage: 'zh-CN',
  };
}

describe('ConfigLoader', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    // Clean up env vars
    delete process.env.LLM_PROVIDER_OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER_ANTHROPIC_API_KEY;
  });

  // ─── load() ───

  describe('load', () => {
    it('returns null when file does not exist', () => {
      const result = ConfigLoader.load('/nonexistent/path/config.json');
      expect(result).toBeNull();
    });

    it('loads and returns valid config from file', () => {
      const config = validConfig();
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
      const result = ConfigLoader.load(TEST_CONFIG_PATH);
      expect(result).not.toBeNull();
      expect(result!.providers).toHaveLength(2);
      expect(result!.routing.default.provider).toBe('openai');
      expect(result!.defaultLanguage).toBe('zh-CN');
    });

    it('throws on invalid JSON', () => {
      writeFileSync(TEST_CONFIG_PATH, '{ not valid json }');
      expect(() => ConfigLoader.load(TEST_CONFIG_PATH)).toThrow('Invalid JSON');
    });

    it('throws on valid JSON but invalid config', () => {
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ foo: 'bar' }));
      expect(() => ConfigLoader.load(TEST_CONFIG_PATH)).toThrow('Config validation failed');
    });

    it('applies env overrides when loading', () => {
      const config = validConfig();
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
      process.env.LLM_PROVIDER_OPENAI_API_KEY = 'env-override-key';
      const result = ConfigLoader.load(TEST_CONFIG_PATH);
      expect(result!.providers[0].apiKey).toBe('env-override-key');
      expect(result!.providers[1].apiKey).toBe('sk-ant-key');
    });
  });

  // ─── validate() ───

  describe('validate', () => {
    it('returns no errors for valid config', () => {
      const errors = ConfigLoader.validate(validConfig());
      expect(errors).toHaveLength(0);
    });

    it('returns error when config is null', () => {
      const errors = ConfigLoader.validate(null);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('config');
    });

    it('returns error when providers is missing', () => {
      const errors = ConfigLoader.validate({
        routing: { default: { provider: 'x' } },
      });
      expect(errors.some((e) => e.field === 'providers')).toBe(true);
    });

    it('returns error when routing is missing', () => {
      const errors = ConfigLoader.validate({
        providers: [
          {
            providerName: 'x',
            apiKey: 'k',
            endpoint: 'e',
            defaultModel: 'm',
          },
        ],
      });
      expect(errors.some((e) => e.field === 'routing')).toBe(true);
    });

    it('returns error when routing has no default key', () => {
      const config = validConfig();
      delete (config.routing as Record<string, unknown>)['default'];
      const errors = ConfigLoader.validate(config);
      expect(errors.some((e) => e.field === 'routing.default')).toBe(true);
    });

    it('returns error for provider missing required fields', () => {
      const config = validConfig();
      (config.providers[0] as Record<string, unknown>).apiKey = '';
      const errors = ConfigLoader.validate(config);
      expect(errors.some((e) => e.field.includes('apiKey'))).toBe(true);
    });

    it('returns error when routing references non-existent provider', () => {
      const config = validConfig();
      config.routing.planning.provider = 'nonexistent';
      const errors = ConfigLoader.validate(config);
      expect(
        errors.some(
          (e) =>
            e.field === 'routing.planning.provider' &&
            e.constraint === 'reference',
        ),
      ).toBe(true);
    });

    it('returns error when fallback references non-existent provider', () => {
      const config = validConfig();
      config.routing.default.fallback = ['ghost'];
      const errors = ConfigLoader.validate(config);
      expect(
        errors.some(
          (e) =>
            e.field === 'routing.default.fallback' &&
            e.constraint === 'reference',
        ),
      ).toBe(true);
    });

    it('returns error for invalid defaultLanguage', () => {
      const config = { ...validConfig(), defaultLanguage: 'fr' };
      const errors = ConfigLoader.validate(config);
      expect(errors.some((e) => e.field === 'defaultLanguage')).toBe(true);
    });

    it('accepts config without defaultLanguage', () => {
      const config = validConfig();
      delete config.defaultLanguage;
      const errors = ConfigLoader.validate(config);
      expect(errors).toHaveLength(0);
    });

    it('returns error when route provider is empty string', () => {
      const config = validConfig();
      config.routing.default.provider = '';
      const errors = ConfigLoader.validate(config);
      expect(
        errors.some(
          (e) =>
            e.field === 'routing.default.provider' &&
            e.constraint === 'required',
        ),
      ).toBe(true);
    });
  });

  // ─── serialize() & parse() ───

  describe('serialize and parse', () => {
    it('round-trips a valid config', () => {
      const config = validConfig();
      const json = ConfigLoader.serialize(config);
      const parsed = ConfigLoader.parse(json);
      expect(parsed).toEqual(config);
    });

    it('serialize produces 2-space indented JSON', () => {
      const config = validConfig();
      const json = ConfigLoader.serialize(config);
      expect(json).toContain('  "providers"');
    });

    it('parse ignores unknown fields', () => {
      const config = validConfig();
      const json = JSON.stringify({
        ...config,
        unknownField: 'should be ignored',
        providers: config.providers.map((p) => ({
          ...p,
          extraField: 123,
        })),
        routing: Object.fromEntries(
          Object.entries(config.routing).map(([k, v]) => [
            k,
            { ...v, unknownRouteField: true },
          ]),
        ),
      });
      const parsed = ConfigLoader.parse(json);
      expect(parsed).toEqual(config);
      expect((parsed as Record<string, unknown>).unknownField).toBeUndefined();
    });

    it('parse preserves optional route fields', () => {
      const config = validConfig();
      const json = ConfigLoader.serialize(config);
      const parsed = ConfigLoader.parse(json);
      expect(parsed.routing.planning.temperature).toBe(0.8);
      expect(parsed.routing.planning.maxTokens).toBe(4096);
      expect(parsed.routing.planning.model).toBe('gpt-4');
      expect(parsed.routing.planning.fallback).toEqual(['anthropic']);
    });

    it('parse omits undefined optional fields', () => {
      const config: RoutingConfig = {
        providers: [
          {
            providerName: 'test',
            apiKey: 'key',
            endpoint: 'http://test',
            defaultModel: 'model',
          },
        ],
        routing: {
          default: { provider: 'test' },
        },
      };
      const json = ConfigLoader.serialize(config);
      const parsed = ConfigLoader.parse(json);
      expect(parsed.routing.default.model).toBeUndefined();
      expect(parsed.routing.default.temperature).toBeUndefined();
      expect(parsed.routing.default.maxTokens).toBeUndefined();
      expect(parsed.routing.default.fallback).toBeUndefined();
      expect(parsed.defaultLanguage).toBeUndefined();
    });
  });

  // ─── applyEnvOverrides() ───

  describe('applyEnvOverrides', () => {
    it('overrides apiKey from env var', () => {
      process.env.LLM_PROVIDER_OPENAI_API_KEY = 'from-env';
      const config = validConfig();
      const result = ConfigLoader.applyEnvOverrides(config);
      expect(result.providers[0].apiKey).toBe('from-env');
      expect(result.providers[1].apiKey).toBe('sk-ant-key');
    });

    it('overrides multiple providers', () => {
      process.env.LLM_PROVIDER_OPENAI_API_KEY = 'env-openai';
      process.env.LLM_PROVIDER_ANTHROPIC_API_KEY = 'env-anthropic';
      const config = validConfig();
      const result = ConfigLoader.applyEnvOverrides(config);
      expect(result.providers[0].apiKey).toBe('env-openai');
      expect(result.providers[1].apiKey).toBe('env-anthropic');
    });

    it('does not mutate original config', () => {
      process.env.LLM_PROVIDER_OPENAI_API_KEY = 'from-env';
      const config = validConfig();
      const original = config.providers[0].apiKey;
      ConfigLoader.applyEnvOverrides(config);
      expect(config.providers[0].apiKey).toBe(original);
    });

    it('keeps original apiKey when env var is not set', () => {
      const config = validConfig();
      const result = ConfigLoader.applyEnvOverrides(config);
      expect(result.providers[0].apiKey).toBe('sk-test-key');
    });

    it('preserves non-provider fields', () => {
      const config = validConfig();
      const result = ConfigLoader.applyEnvOverrides(config);
      expect(result.routing).toEqual(config.routing);
      expect(result.defaultLanguage).toBe(config.defaultLanguage);
    });
  });
});
