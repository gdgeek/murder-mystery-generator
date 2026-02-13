/**
 * 生成跟踪组件
 * 发起剧本生成任务并轮询跟踪状态
 */

import { ApiClient, ApiError } from '../api-client';
import { showToast } from './toast';
import type { EphemeralAiConfig } from '@murder-mystery/shared';

/** 生成任务状态响应 */
export interface GenerateJobResponse {
  jobId: string;
  configId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  scriptId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationTrackerOptions {
  container: HTMLElement;
  apiClient: ApiClient;
}

const POLL_INTERVAL_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 3;

const STATUS_TEXT: Record<string, string> = {
  pending: '任务排队中…',
  generating: '剧本生成中，请耐心等待…',
};

export class GenerationTracker {
  private container: HTMLElement;
  private apiClient: ApiClient;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private currentJobId: string | null = null;

  constructor(options: GenerationTrackerOptions) {
    this.container = options.container;
    this.apiClient = options.apiClient;
  }

  async startGeneration(configId: string, ephemeralAiConfig?: EphemeralAiConfig): Promise<void> {
    this.stopPolling();
    this.renderSpinner('正在发起生成任务…');

    const body: Record<string, unknown> = { configId };
    if (ephemeralAiConfig) {
      body.ephemeralAiConfig = ephemeralAiConfig;
    }

    let job: GenerateJobResponse;
    try {
      job = await this.apiClient.post<GenerateJobResponse>('/api/scripts/generate', body);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '发起生成任务失败';
      this.renderError(msg);
      return;
    }

    this.currentJobId = job.jobId;
    this.consecutiveFailures = 0;
    this.startPolling();
  }

  destroy(): void {
    this.stopPolling();
  }

  // --- Polling ---

  private startPolling(): void {
    this.renderSpinner(STATUS_TEXT['pending']);
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.currentJobId) return;

    let job: GenerateJobResponse;
    try {
      job = await this.apiClient.get<GenerateJobResponse>(`/api/scripts/jobs/${this.currentJobId}`);
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.stopPolling();
        this.renderNetworkError();
      }
      return;
    }

    // Successful response resets failure counter
    this.consecutiveFailures = 0;

    if (job.status === 'completed') {
      this.stopPolling();
      this.renderCompleted(job.scriptId);
      showToast('剧本生成成功！', 'success');
    } else if (job.status === 'failed') {
      this.stopPolling();
      this.renderError(job.error || '生成失败，请重试');
    } else {
      this.renderSpinner(STATUS_TEXT[job.status] || STATUS_TEXT['pending']);
    }
  }

  // --- Rendering ---

  private renderSpinner(text: string): void {
    this.container.innerHTML = `
      <div class="d-flex align-items-center gap-2 my-3">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">加载中...</span>
        </div>
        <span>${text}</span>
      </div>`;
  }

  private renderCompleted(scriptId?: string): void {
    const link = scriptId
      ? `<a href="#/scripts/${scriptId}" class="btn btn-sm btn-outline-primary ms-2">查看剧本</a>`
      : '';
    this.container.innerHTML = `
      <div class="alert alert-success my-3" role="alert">
        <i class="bi bi-check-circle-fill me-1"></i>剧本生成完成！${link}
      </div>`;
  }

  private renderError(message: string): void {
    this.container.innerHTML = `
      <div class="alert alert-danger my-3" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>${message}
      </div>`;
  }

  private renderNetworkError(): void {
    this.container.innerHTML = `
      <div class="alert alert-warning my-3" role="alert">
        <i class="bi bi-wifi-off me-1"></i>网络连接异常，轮询已停止。
        <button class="btn btn-sm btn-outline-warning ms-2" id="retry-poll-btn">重试</button>
      </div>`;

    const retryBtn = this.container.querySelector('#retry-poll-btn');
    retryBtn?.addEventListener('click', () => {
      this.consecutiveFailures = 0;
      this.startPolling();
    });
  }
}
