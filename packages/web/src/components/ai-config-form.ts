/**
 * AI 配置表单组件
 * 当服务器未配置 AI 时，显示临时 AI 配置输入区域
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */

import { PROVIDER_DEFAULTS, validateEphemeralAiConfig } from '@gdgeek/murder-mystery-shared';
import type { EphemeralAiConfig } from '@gdgeek/murder-mystery-shared';
import type { ApiClient } from '../api-client';

export interface AiConfigFormOptions {
  container: HTMLElement;
  onConfigReady: (config: EphemeralAiConfig | null) => void;
  apiClient: ApiClient;
}

export class AiConfigForm {
  private container: HTMLElement;
  private onConfigReady: (config: EphemeralAiConfig | null) => void;
  private apiClient: ApiClient;
  private formEl: HTMLElement | null = null;

  constructor(options: AiConfigFormOptions) {
    this.container = options.container;
    this.onConfigReady = options.onConfigReady;
    this.apiClient = options.apiClient;
  }

  render(): void {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.buildFormHTML();
    this.container.appendChild(wrapper);

    this.formEl = wrapper;
    this.bindEvents();

    // Trigger default fill for initial provider selection
    this.fillDefaults('openai');
    this.notifyConfig();
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.formEl = null;
  }

  getConfig(): EphemeralAiConfig | null {
    if (!this.formEl) return null;

    const provider = this.getInputValue('ai-provider');
    const apiKey = this.getInputValue('ai-apiKey');
    const endpoint = this.getInputValue('ai-endpoint');
    const model = this.getInputValue('ai-model');

    return { provider, apiKey, endpoint, model };
  }

  validate(): boolean {
    this.clearAllErrors();
    const config = this.getConfig();
    if (!config) return false;

    const errors = validateEphemeralAiConfig(config);
    if (!errors) return true;

    if (errors.apiKey) this.showFieldError('ai-apiKey', errors.apiKey);
    if (errors.endpoint) this.showFieldError('ai-endpoint', errors.endpoint);
    if (errors.model) this.showFieldError('ai-model', errors.model);

    return false;
  }

  private buildFormHTML(): string {
    const providerOptions = Object.keys(PROVIDER_DEFAULTS)
      .map(p => {
        const label = p === 'custom' ? '自定义' : p;
        return `<option value="${p}">${label}</option>`;
      })
      .join('');

    return `
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="mb-0">AI 配置</h5>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label for="ai-provider" class="form-label">Provider</label>
              <select class="form-select" id="ai-provider">
                ${providerOptions}
              </select>
            </div>

            <div class="col-md-6">
              <label for="ai-apiKey" class="form-label">API Key</label>
              <input type="password" class="form-control" id="ai-apiKey" placeholder="输入 API Key">
              <div class="invalid-feedback"></div>
            </div>

            <div class="col-md-6">
              <label for="ai-endpoint" class="form-label">Endpoint</label>
              <input type="text" class="form-control" id="ai-endpoint" placeholder="输入 Endpoint URL">
              <div class="invalid-feedback"></div>
            </div>

            <div class="col-md-6">
              <label for="ai-model" class="form-label">Model</label>
              <input type="text" class="form-control" id="ai-model" placeholder="输入模型名称">
              <div class="invalid-feedback"></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  private bindEvents(): void {
    const providerSelect = this.formEl?.querySelector<HTMLSelectElement>('#ai-provider');
    providerSelect?.addEventListener('change', () => {
      this.fillDefaults(providerSelect.value);
      this.notifyConfig();
    });

    const fields = ['ai-apiKey', 'ai-endpoint', 'ai-model'];
    for (const fieldId of fields) {
      const el = this.formEl?.querySelector<HTMLElement>(`#${fieldId}`);
      el?.addEventListener('input', () => {
        this.clearFieldError(fieldId);
        this.notifyConfig();
      });
    }
  }

  private fillDefaults(provider: string): void {
    const defaults = PROVIDER_DEFAULTS[provider];
    if (!defaults) return;

    const endpointInput = this.formEl?.querySelector<HTMLInputElement>('#ai-endpoint');
    const modelInput = this.formEl?.querySelector<HTMLInputElement>('#ai-model');

    if (endpointInput) endpointInput.value = defaults.endpoint;
    if (modelInput) modelInput.value = defaults.model;
  }

  private notifyConfig(): void {
    const config = this.getConfig();
    this.onConfigReady(config);
  }

  private getInputValue(id: string): string {
    const el = this.formEl?.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    return el?.value?.trim() ?? '';
  }

  private showFieldError(fieldId: string, message: string): void {
    const el = this.formEl?.querySelector<HTMLElement>(`#${fieldId}`);
    if (el) {
      el.classList.add('is-invalid');
      const feedback = el.nextElementSibling;
      if (feedback?.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
      }
    }
  }

  private clearFieldError(fieldId: string): void {
    const el = this.formEl?.querySelector<HTMLElement>(`#${fieldId}`);
    if (el) {
      el.classList.remove('is-invalid');
      const feedback = el.nextElementSibling;
      if (feedback?.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    }
  }

  private clearAllErrors(): void {
    const invalidEls = this.formEl?.querySelectorAll('.is-invalid') ?? [];
    invalidEls.forEach(el => el.classList.remove('is-invalid'));
    const feedbacks = this.formEl?.querySelectorAll('.invalid-feedback') ?? [];
    feedbacks.forEach(el => { el.textContent = ''; });
  }
}
