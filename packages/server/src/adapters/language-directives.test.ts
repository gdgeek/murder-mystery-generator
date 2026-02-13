import { describe, it, expect } from 'vitest';
import { LANGUAGE_DIRECTIVES, getLanguageDirective } from './language-directives';

describe('LANGUAGE_DIRECTIVES', () => {
  it('contains directives for en-US and zh-CN', () => {
    expect(LANGUAGE_DIRECTIVES['en-US']).toBe('Please respond in English.');
    expect(LANGUAGE_DIRECTIVES['zh-CN']).toBe('请使用中文回答。');
  });

  it('has exactly two entries', () => {
    expect(Object.keys(LANGUAGE_DIRECTIVES)).toHaveLength(2);
  });
});

describe('getLanguageDirective', () => {
  it('returns English directive for en-US', () => {
    expect(getLanguageDirective('en-US', 'zh-CN')).toBe('Please respond in English.');
  });

  it('returns Chinese directive for zh-CN', () => {
    expect(getLanguageDirective('zh-CN', 'en-US')).toBe('请使用中文回答。');
  });

  it('falls back to defaultLanguage for unsupported language', () => {
    expect(getLanguageDirective('fr-FR', 'en-US')).toBe('Please respond in English.');
  });

  it('falls back to defaultLanguage zh-CN for invalid language', () => {
    expect(getLanguageDirective('invalid', 'zh-CN')).toBe('请使用中文回答。');
  });

  it('falls back to defaultLanguage for empty string', () => {
    expect(getLanguageDirective('', 'en-US')).toBe('Please respond in English.');
  });
});
