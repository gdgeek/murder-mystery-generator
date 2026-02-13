/**
 * **Feature: ephemeral-ai-config, Property 1: 临时 AI 配置校验正确性**
 *
 * 对于任意 EphemeralAiConfig 对象，校验函数返回错误当且仅当以下条件之一成立：
 * apiKey 为空字符串、endpoint 不是有效 URL 格式、model 为空字符串。
 * 校验通过当且仅当所有三个条件均不成立。
 *
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateEphemeralAiConfig } from './ai-config-validator';
import type { EphemeralAiConfig } from '../types/ai-config';

/** Generate a non-empty string (at least 1 char) */
const nonEmptyString = fc.string({ minLength: 1 });

/** Generate a valid URL (http or https with a host) */
const validUrlArb = fc.tuple(
  fc.constantFrom('http', 'https'),
  fc.webUrl(),
).map(([, url]) => url);

/** Generate an invalid URL (no protocol, random text, empty) */
const invalidUrlArb = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1 }).filter(s => {
    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
    return !urlPattern.test(s);
  }),
);

/** Generate an arbitrary EphemeralAiConfig */
const ephemeralAiConfigArb = fc.record({
  provider: fc.string(),
  apiKey: fc.string(),
  endpoint: fc.string(),
  model: fc.string(),
});

/** Mirror the validator's URL check for oracle comparison */
function isValidUrl(value: string): boolean {
  const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
  return urlPattern.test(value);
}

describe('Property 1: 临时 AI 配置校验正确性', () => {
  it('validation fails iff apiKey is empty, endpoint is invalid URL, or model is empty', () => {
    fc.assert(
      fc.property(ephemeralAiConfigArb, (config: EphemeralAiConfig) => {
        const result = validateEphemeralAiConfig(config);

        const apiKeyEmpty = config.apiKey === '';
        const endpointInvalid = !isValidUrl(config.endpoint);
        const modelEmpty = config.model === '';

        const shouldFail = apiKeyEmpty || endpointInvalid || modelEmpty;

        if (shouldFail) {
          // Validator must return errors (non-null)
          expect(result).not.toBeNull();

          // Each specific error field must be present iff its condition holds
          if (apiKeyEmpty) {
            expect(result!.apiKey).toBeDefined();
          } else {
            expect(result!.apiKey).toBeUndefined();
          }

          if (endpointInvalid) {
            expect(result!.endpoint).toBeDefined();
          } else {
            expect(result!.endpoint).toBeUndefined();
          }

          if (modelEmpty) {
            expect(result!.model).toBeDefined();
          } else {
            expect(result!.model).toBeUndefined();
          }
        } else {
          // All conditions pass → validator must return null
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('valid configs always pass validation', () => {
    const validConfigArb = fc.record({
      provider: fc.string(),
      apiKey: nonEmptyString,
      endpoint: validUrlArb,
      model: nonEmptyString,
    });

    fc.assert(
      fc.property(validConfigArb, (config: EphemeralAiConfig) => {
        const result = validateEphemeralAiConfig(config);
        expect(result).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('configs with empty apiKey always have apiKey error', () => {
    const configWithEmptyApiKey = fc.record({
      provider: fc.string(),
      apiKey: fc.constant(''),
      endpoint: validUrlArb,
      model: nonEmptyString,
    });

    fc.assert(
      fc.property(configWithEmptyApiKey, (config: EphemeralAiConfig) => {
        const result = validateEphemeralAiConfig(config);
        expect(result).not.toBeNull();
        expect(result!.apiKey).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('configs with invalid endpoint always have endpoint error', () => {
    const configWithBadEndpoint = fc.record({
      provider: fc.string(),
      apiKey: nonEmptyString,
      endpoint: invalidUrlArb,
      model: nonEmptyString,
    });

    fc.assert(
      fc.property(configWithBadEndpoint, (config: EphemeralAiConfig) => {
        const result = validateEphemeralAiConfig(config);
        expect(result).not.toBeNull();
        expect(result!.endpoint).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it('configs with empty model always have model error', () => {
    const configWithEmptyModel = fc.record({
      provider: fc.string(),
      apiKey: nonEmptyString,
      endpoint: validUrlArb,
      model: fc.constant(''),
    });

    fc.assert(
      fc.property(configWithEmptyModel, (config: EphemeralAiConfig) => {
        const result = validateEphemeralAiConfig(config);
        expect(result).not.toBeNull();
        expect(result!.model).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });
});
