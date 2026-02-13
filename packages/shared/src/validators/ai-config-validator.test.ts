import { describe, it, expect } from 'vitest';
import { validateEphemeralAiConfig } from './ai-config-validator';
import type { EphemeralAiConfig } from '../types/ai-config';

function validConfig(overrides: Partial<EphemeralAiConfig> = {}): EphemeralAiConfig {
  return {
    provider: 'openai',
    apiKey: 'sk-test-key-123',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
    ...overrides,
  };
}

describe('validateEphemeralAiConfig', () => {
  it('returns null for a valid config', () => {
    expect(validateEphemeralAiConfig(validConfig())).toBeNull();
  });

  it('returns apiKey error when apiKey is empty', () => {
    const result = validateEphemeralAiConfig(validConfig({ apiKey: '' }));
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBeDefined();
  });

  it('returns endpoint error when endpoint is not a valid URL', () => {
    const result = validateEphemeralAiConfig(validConfig({ endpoint: 'not-a-url' }));
    expect(result).not.toBeNull();
    expect(result!.endpoint).toBeDefined();
  });

  it('returns endpoint error for empty endpoint', () => {
    const result = validateEphemeralAiConfig(validConfig({ endpoint: '' }));
    expect(result).not.toBeNull();
    expect(result!.endpoint).toBeDefined();
  });

  it('returns model error when model is empty', () => {
    const result = validateEphemeralAiConfig(validConfig({ model: '' }));
    expect(result).not.toBeNull();
    expect(result!.model).toBeDefined();
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const result = validateEphemeralAiConfig(validConfig({
      apiKey: '',
      endpoint: 'bad',
      model: '',
    }));
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBeDefined();
    expect(result!.endpoint).toBeDefined();
    expect(result!.model).toBeDefined();
  });

  it('accepts http endpoints', () => {
    expect(validateEphemeralAiConfig(validConfig({
      endpoint: 'http://localhost:8080/v1',
    }))).toBeNull();
  });

  it('accepts https endpoints', () => {
    expect(validateEphemeralAiConfig(validConfig({
      endpoint: 'https://api.example.com/v1',
    }))).toBeNull();
  });

  it('rejects endpoint with no protocol', () => {
    const result = validateEphemeralAiConfig(validConfig({ endpoint: 'api.example.com' }));
    expect(result).not.toBeNull();
    expect(result!.endpoint).toBeDefined();
  });

  it('does not validate provider (any string accepted)', () => {
    expect(validateEphemeralAiConfig(validConfig({ provider: '' }))).toBeNull();
    expect(validateEphemeralAiConfig(validConfig({ provider: 'custom' }))).toBeNull();
  });

  it('accepts non-empty apiKey of any content', () => {
    expect(validateEphemeralAiConfig(validConfig({ apiKey: 'x' }))).toBeNull();
  });

  it('accepts non-empty model of any content', () => {
    expect(validateEphemeralAiConfig(validConfig({ model: 'my-model' }))).toBeNull();
  });
});
