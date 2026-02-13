/**
 * LLM Adapter Interface
 * Requirements: 9.1, 9.2
 */

import { LLMRequest, LLMResponse } from '@murder-mystery/shared';

export interface ILLMAdapter {
  send(request: LLMRequest): Promise<LLMResponse>;
  getProviderName(): string;
  getDefaultModel(): string;
}
