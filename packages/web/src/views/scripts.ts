/**
 * 剧本列表视图
 * 挂载 ScriptList 组件
 * Requirements: 6.1, 6.2
 */

import { ScriptList } from '../components/script-list';
import type { ApiClient } from '../api-client';

export function renderScripts(container: HTMLElement, apiClient: ApiClient): void {
  container.innerHTML = '<h2 class="mb-4">剧本列表</h2>';

  const listContainer = document.createElement('div');
  container.appendChild(listContainer);

  const scriptList = new ScriptList({
    container: listContainer,
    apiClient,
  });

  scriptList.render();
}
