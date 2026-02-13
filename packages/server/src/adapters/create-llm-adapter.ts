/**
 * Factory function for creating an ILLMAdapter instance.
 * Uses ConfigLoader + LLMRouter when a config file exists,
 * falls back to LLMRouter.fromEnv() for backward compatibility.
 * Requirements: 2.4, 5.1, 5.3, 5.4
 */

import { ConfigLoader } from './config-loader';
import { LLMRouter } from './llm-router';
import type { ILLMAdapter } from './llm-adapter.interface';

export function createLLMAdapter(): ILLMAdapter {
  const config = ConfigLoader.load();
  if (config) {
    return new LLMRouter(config);
  }
  return LLMRouter.fromEnv();
}
