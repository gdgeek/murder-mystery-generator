/**
 * 轮次预览组件 - 根据时长展示轮次结构表格
 * Requirements: 4.1, 4.2, 4.3
 */

import { calculateRoundStructure } from '../round-calculator';

export interface RoundPreviewOptions {
  container: HTMLElement;
}

export class RoundPreview {
  private container: HTMLElement;

  constructor(options: RoundPreviewOptions) {
    this.container = options.container;
    this.clear();
  }

  update(durationHours: number): void {
    const structure = calculateRoundStructure(durationHours);
    if (!structure) {
      this.clear();
      return;
    }

    const rows = structure.rounds
      .map(
        (r, i) =>
          `<tr>
            <td>第 ${i + 1} 轮</td>
            <td>${r.readingMinutes} 分钟</td>
            <td>${r.investigationMinutes} 分钟</td>
            <td>${r.discussionMinutes} 分钟</td>
          </tr>`
      )
      .join('');

    this.container.innerHTML = `
      <h5 class="mb-3">轮次结构预览</h5>
      <table class="table table-striped table-bordered">
        <thead class="table-light">
          <tr>
            <th>轮次</th>
            <th>阅读时间</th>
            <th>搜证时间</th>
            <th>讨论时间</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="table-info">
            <td colspan="4">总结时间：${structure.summaryMinutes} 分钟 | 最终投票：${structure.finalVoteMinutes} 分钟 | 真相揭示：${structure.revealMinutes} 分钟</td>
          </tr>
        </tbody>
      </table>`;
  }

  clear(): void {
    this.container.innerHTML =
      '<p class="text-muted">请选择游戏时长以预览轮次结构</p>';
  }
}
