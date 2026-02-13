/**
 * 剧本列表组件
 * 以 Bootstrap 卡片列表展示剧本，支持分页加载
 */

import { ApiClient, ApiError } from '../api-client';
import { showToast } from './toast';

/** 剧本列表项（仅展示所需字段） */
interface ScriptListItem {
  id: string;
  title: string;
  version: string;
  status: string;
  createdAt: string;
}

/** 分页列表响应 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ScriptListOptions {
  container: HTMLElement;
  apiClient: ApiClient;
  pageSize?: number;
}

const STATUS_LABELS: Record<string, string> = {
  generating: '生成中',
  ready: '已完成',
  optimizing: '优化中',
};

const STATUS_BADGE: Record<string, string> = {
  generating: 'bg-warning text-dark',
  ready: 'bg-success',
  optimizing: 'bg-info text-dark',
};

/** 计算分页偏移量 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export class ScriptList {
  private container: HTMLElement;
  private apiClient: ApiClient;
  private pageSize: number;
  private currentPage = 1;
  private total = 0;

  constructor(options: ScriptListOptions) {
    this.container = options.container;
    this.apiClient = options.apiClient;
    this.pageSize = options.pageSize ?? 10;
  }

  async render(): Promise<void> {
    await this.loadPage(this.currentPage);
  }

  destroy(): void {
    this.container.innerHTML = '';
  }

  private async loadPage(page: number): Promise<void> {
    const offset = calculateOffset(page, this.pageSize);

    this.renderLoading();

    let data: PaginatedResponse<ScriptListItem>;
    try {
      data = await this.apiClient.get<PaginatedResponse<ScriptListItem>>(
        `/api/scripts?limit=${this.pageSize}&offset=${offset}`
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '加载剧本列表失败';
      showToast(msg, 'danger');
      this.renderEmpty();
      return;
    }

    this.total = data.total;
    this.currentPage = page;

    if (data.items.length === 0) {
      this.renderEmpty();
      return;
    }

    this.renderCards(data.items);
  }

  private renderLoading(): void {
    this.container.innerHTML = `
      <div class="d-flex justify-content-center my-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">加载中...</span>
        </div>
      </div>`;
  }

  private renderEmpty(): void {
    this.container.innerHTML = `
      <div class="text-center text-muted my-5">
        <p>暂无剧本</p>
      </div>`;
  }

  private renderCards(items: ScriptListItem[]): void {
    const totalPages = Math.ceil(this.total / this.pageSize);

    const cardsHtml = items
      .map((item) => {
        const statusLabel = STATUS_LABELS[item.status] || item.status;
        const badgeClass = STATUS_BADGE[item.status] || 'bg-secondary';
        const createdAt = formatDate(item.createdAt);

        return `
        <div class="card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <h5 class="card-title mb-1">${escapeHtml(item.title)}</h5>
              <span class="badge ${badgeClass}">${statusLabel}</span>
            </div>
            <p class="card-text text-muted mb-0">
              <small>版本: ${escapeHtml(item.version)} · 创建时间: ${createdAt}</small>
            </p>
          </div>
        </div>`;
      })
      .join('');

    const paginationHtml = totalPages > 1 ? this.buildPagination(totalPages) : '';

    this.container.innerHTML = cardsHtml + paginationHtml;

    // Bind pagination click handlers
    this.container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const page = parseInt(target.dataset.page!, 10);
        if (page >= 1 && page <= totalPages) {
          this.loadPage(page);
        }
      });
    });
  }

  private buildPagination(totalPages: number): string {
    const items: string[] = [];

    // Previous button
    const prevDisabled = this.currentPage <= 1 ? 'disabled' : '';
    items.push(
      `<li class="page-item ${prevDisabled}">
        <a class="page-link" href="#" data-page="${this.currentPage - 1}" aria-label="上一页">&laquo;</a>
      </li>`
    );

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const active = i === this.currentPage ? 'active' : '';
      items.push(
        `<li class="page-item ${active}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`
      );
    }

    // Next button
    const nextDisabled = this.currentPage >= totalPages ? 'disabled' : '';
    items.push(
      `<li class="page-item ${nextDisabled}">
        <a class="page-link" href="#" data-page="${this.currentPage + 1}" aria-label="下一页">&raquo;</a>
      </li>`
    );

    return `
      <nav aria-label="剧本列表分页">
        <ul class="pagination justify-content-center mt-3">
          ${items.join('')}
        </ul>
      </nav>`;
  }
}

/** Format ISO date string to readable Chinese format */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

/** Escape HTML to prevent XSS */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
