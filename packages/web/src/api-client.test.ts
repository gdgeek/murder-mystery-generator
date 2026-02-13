import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, ApiError } from './api-client';

describe('ApiError', () => {
  it('should store statusCode, message, and details', () => {
    const err = new ApiError('Not Found', 404, { field: 'id' });
    expect(err.message).toBe('Not Found');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ field: 'id' });
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should work without details', () => {
    const err = new ApiError('Server Error', 500);
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
  });
});

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildUrl', () => {
    it('should join baseUrl and path', () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });
      expect(client.buildUrl('/api/configs')).toBe('http://localhost:3000/api/configs');
    });

    it('should handle baseUrl with trailing slash', () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:3000/' });
      expect(client.buildUrl('/api/configs')).toBe('http://localhost:3000/api/configs');
    });

    it('should handle path without leading slash', () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });
      expect(client.buildUrl('api/configs')).toBe('http://localhost:3000/api/configs');
    });

    it('should handle baseUrl with trailing slash and path without leading slash', () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:3000/' });
      expect(client.buildUrl('api/configs')).toBe('http://localhost:3000/api/configs');
    });
  });

  describe('get', () => {
    it('should make a GET request and return parsed JSON', async () => {
      const data = { id: '1', name: 'test' };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      });

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });
      const result = await client.get('/api/configs');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/configs',
        { method: 'GET' }
      );
      expect(result).toEqual(data);
    });

    it('should throw ApiError on non-2xx response with JSON body', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: '资源不存在', details: { id: '123' } }),
      });

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

      await expect(client.get('/api/configs/123')).rejects.toThrow(ApiError);
      try {
        await client.get('/api/configs/123');
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('资源不存在');
        expect(err.details).toEqual({ id: '123' });
      }
    });

    it('should throw ApiError with default message when response body is not JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      });

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

      await expect(client.get('/api/fail')).rejects.toThrow(ApiError);
      try {
        await client.get('/api/fail');
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(500);
        expect(err.message).toBe('HTTP 500');
      }
    });

    it('should throw ApiError with statusCode 0 on network error', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

      await expect(client.get('/api/configs')).rejects.toThrow(ApiError);
      try {
        await client.get('/api/configs');
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(0);
        expect(err.message).toBe('网络连接失败，请检查网络');
      }
    });
  });

  describe('post', () => {
    it('should make a POST request with JSON body and return parsed JSON', async () => {
      const responseData = { id: 'new-1' };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });
      const body = { playerCount: 4, theme: '古堡' };
      const result = await client.post('/api/configs', body);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/configs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      expect(result).toEqual(responseData);
    });

    it('should throw ApiError on 400 validation error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: '校验失败', details: { field: 'playerCount' } }),
      });

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

      await expect(client.post('/api/configs', {})).rejects.toThrow(ApiError);
      try {
        await client.post('/api/configs', {});
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('校验失败');
      }
    });

    it('should throw ApiError on network error during POST', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new ApiClient({ baseUrl: 'http://localhost:3000' });

      await expect(client.post('/api/configs', {})).rejects.toThrow(ApiError);
      try {
        await client.post('/api/configs', {});
      } catch (e) {
        const err = e as ApiError;
        expect(err.statusCode).toBe(0);
      }
    });
  });
});
