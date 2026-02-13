/**
 * 配置视图
 * 组合 ConfigForm + GenerationTracker
 * 配置创建成功后显示生成按钮，点击后启动 GenerationTracker
 * Requirements: 2.5, 5.1
 */

import { ConfigForm } from '../components/config-form';
import { GenerationTracker } from '../components/generation-tracker';
import type { ApiClient } from '../api-client';

export function renderConfig(container: HTMLElement, apiClient: ApiClient): void {
  container.innerHTML = '';

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

  const form = new ConfigForm({
    container: formContainer,
    apiClient,
    onConfigCreated: (configId: string) => {
      showGenerateButton(configId);
    },
  });

  form.render();

  function showGenerateButton(configId: string): void {
    actionArea.style.display = '';
    actionArea.innerHTML = `
      <div class="my-4 p-3 border rounded bg-light d-flex align-items-center justify-content-between">
        <span>配置创建成功（ID: <code>${configId}</code>）</span>
        <button class="btn btn-success" id="btn-start-generate">开始生成</button>
      </div>`;

    const btn = actionArea.querySelector<HTMLButtonElement>('#btn-start-generate')!;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = '生成中...';

      // Clean up previous tracker if any
      tracker?.destroy();
      tracker = new GenerationTracker({
        container: trackerContainer,
        apiClient,
      });
      tracker.startGeneration(configId);
    });
  }
}
