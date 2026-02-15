import { SupportedLanguage } from '@gdgeek/murder-mystery-shared';

/** 语言指令映射表 */
export const LANGUAGE_DIRECTIVES: Record<SupportedLanguage, string> = {
  'en-US': 'Please respond in English.',
  'zh-CN': '请使用中文回答。',
};

/**
 * 获取语言指令。若语言不支持，返回默认语言的指令。
 */
export function getLanguageDirective(
  language: string,
  defaultLanguage: SupportedLanguage,
): string {
  if (language in LANGUAGE_DIRECTIVES) {
    return LANGUAGE_DIRECTIVES[language as SupportedLanguage];
  }
  return LANGUAGE_DIRECTIVES[defaultLanguage];
}
