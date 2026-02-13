/**
 * 配置视图
 * 组合 AiConfigForm + ConfigForm + GenerationTracker
 * 页面加载时检测 AI 状态，未配置时显示 AI 配置表单
 * 配置创建成功后显示生成按钮，点击后启动 GenerationTracker
 * Requirements: 2.1, 2.4, 2.5, 3.1, 5.1
 */

import { ConfigForm } from '../components/config-form';
import { AiConfigForm } from '../components/ai-config-form';
import { GenerationTracker } from '../components/generation-tracker';
import { showToast } from '../components/toast';
import type { ApiClient } from '../api-client';
import type { AiStatusResult, AiVerifyResult, EphemeralAiConfig } from '@murder-mystery/shared';

export function renderConfig(container: HTMLElement, apiClient: ApiClient): void {
  container.innerHTML = '';

  // AI config form container (shown only when unconfigured)
  const aiFormContainer = document.createElement('div');
  aiFormContainer.id = 'ai-config-form-container';
  container.appendChild(aiFormContainer);

  // Form container
  const formContainer = document.createElement('div');
  container.appendChild(formContainer);

  // Generate action area (hidden initially)
  const actionArea = document.createElement('div');
  actionArea.id = 'config-action-area';
  actionArea.style.display = 'none';
  container.appendChild(actionArea);

  // Tracker container
  const trackerContainer = document.createElement('div');
  trackerContainer.id = 'generation-tracker-container';
  container.appendChild(trackerContainer);

  let tracker: GenerationTracker | null = null;
  let aiConfigForm: AiConfigForm | null = null;
  let aiUnconfigured = false;
  let currentEphemeralConfig: EphemeralAiConfig | null = null;

  const form = new ConfigForm({
    container: formContainer,
    apiClient,
    onConfigCreated: (configId: string) => {
      showGenerateButton(configId);
    },
  });

  form.render();

  // Check AI status on page load
  checkAiStatus();

  async function checkAiStatus(): Promise<void> {
    try {
      const status = await apiClient.get<AiStatusResult>('/api/ai-status');
      if (status.status === 'unconfigured') {
        aiUnconfigured = true;
        aiConfigForm = new AiConfigForm({
          container: aiFormContainer,
          apiClient,
          onConfigReady: (config) => {
            currentEphemeralConfig = config;
          },
        });
        aiConfigForm.render();
      }
    } catch {
      // If status check fails, assume configured and proceed normally
    }
  }

  function showGenerateButton(configId: string): void {
    actionArea.style.display = '';
    actionArea.innerHTML = `
      <div class="my-4 p-3 border rounded bg-light d-flex align-items-center justify-content-between">
        <span>配置创建成功（ID: <code>${configId}</code>）</span>
        <button class="btn btn-success" id="btn-start-generate">开始生成</button>
      </div>`;

    const btn = actionArea.querySelector<HTMLButtonElement>('#btn-start-generate')!;
    btn.addEventListener('click', () => {
      handleStartGeneration(configId, btn);
    });
  }

  async function handleStartGeneration(configId: string, btn: HTMLButtonElement): Promise<void> {
    // If AI is unconfigured, validate and verify the ephemeral config first
    if (aiUnconfigured && aiConfigForm) {
      if (!aiConfigForm.validate()) {
        return;
      }

      const config = aiConfigForm.getConfig();
      if (!config) return;

      // Verify connectivity before proceeding
      btn.disabled = true;
      btn.textContent = '验证 AI 配置中...';

      try {
        const verifyResult = await apiClient.post<AiVerifyResult>('/api/ai-status/verify', { ephemeralAiConfig: config });
        if (!verifyResult.valid) {
          showToast(verifyResult.error || 'AI 配置验证失败', 'danger');
          btn.disabled = false;
          btn.textContent = '开始生成';
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'AI 配置验证失败';
        showToast(message, 'danger');
        btn.disabled = false;
        btn.textContent = '开始生成';
        return;
      }

      currentEphemeralConfig = config;
    }

    btn.disabled = true;
    btn.textContent = '生成中...';

    // Clean up previous tracker if any
    tracker?.destroy();
    tracker = new GenerationTracker({
      container: trackerContainer,
      apiClient,
    });
    tracker.startGeneration(configId, aiUnconfigured ? currentEphemeralConfig ?? undefined : undefined);
  }
}
