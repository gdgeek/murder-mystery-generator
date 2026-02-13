/**
 * **Feature: ephemeral-ai-config, Property 4: Provider 默认值完整性**
 *
 * 对于任意已知 provider 名称（openai、anthropic、doubao），PROVIDER_DEFAULTS 映射返回的对象
 * 包含非空的 endpoint 和非空的 model。对于 custom provider，endpoint 和 model 为空字符串。
 *
 * **Validates: Requirements 2.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PROVIDER_DEFAULTS } from './ai-config';

/** Known providers with non-empty defaults */
const KNOWN_PROVIDERS = ['openai', 'anthropic', 'doubao'] as const;

describe('Property 4: Provider 默认值完整性', () => {
  it('known providers always have non-empty endpoint and model', () => {
    const knownProviderArb = fc.constantFrom(...KNOWN_PROVIDERS);

    fc.assert(
      fc.property(knownProviderArb, (provider) => {
        const defaults = PROVIDER_DEFAULTS[provider];

        expect(defaults).toBeDefined();
        expect(typeof defaults.endpoint).toBe('string');
        expect(defaults.endpoint.length).toBeGreaterThan(0);
        expect(typeof defaults.model).toBe('string');
        expect(defaults.model.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('known provider endpoints are valid URLs', () => {
    const knownProviderArb = fc.constantFrom(...KNOWN_PROVIDERS);
    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

    fc.assert(
      fc.property(knownProviderArb, (provider) => {
        const defaults = PROVIDER_DEFAULTS[provider];
        expect(urlPattern.test(defaults.endpoint)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('custom provider has empty endpoint and model', () => {
    fc.assert(
      fc.property(fc.constant('custom'), (provider) => {
        const defaults = PROVIDER_DEFAULTS[provider];

        expect(defaults).toBeDefined();
        expect(defaults.endpoint).toBe('');
        expect(defaults.model).toBe('');
      }),
      { numRuns: 100 },
    );
  });

  it('all providers in PROVIDER_DEFAULTS have endpoint and model fields', () => {
    const allProviderArb = fc.constantFrom(...Object.keys(PROVIDER_DEFAULTS));

    fc.assert(
      fc.property(allProviderArb, (provider) => {
        const defaults = PROVIDER_DEFAULTS[provider];

        expect(defaults).toBeDefined();
        expect(typeof defaults.endpoint).toBe('string');
        expect(typeof defaults.model).toBe('string');
      }),
      { numRuns: 100 },
    );
  });
});
