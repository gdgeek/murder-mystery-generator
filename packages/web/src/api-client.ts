/**
 * API 客户端
 * 封装 fetch API，提供统一的请求方法和错误处理
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    // Remove trailing slash from baseUrl for consistent joining
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Build the full URL from baseUrl + path */
  buildUrl(path: string): string {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = this.buildUrl(path);

    let response: Response;
    try {
      response = await globalThis.fetch(url, init);
    } catch {
      throw new ApiError('网络连接失败，请检查网络', 0);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let details: unknown;
      try {
        const body = await response.json();
        errorMessage = body.error || errorMessage;
        details = body.details;
      } catch {
        // Response body is not JSON, use default message
      }
      throw new ApiError(errorMessage, response.status, details);
    }

    return response.json() as Promise<T>;
  }
}
