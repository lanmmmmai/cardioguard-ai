import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cmsApi } from './cmsApi';

describe('cmsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('list() gửi GET request với query params đầy đủ và trả về dữ liệu', async () => {
    const mockResponse = {
      items: [{ id: '1', name: 'Article 1' }],
      total: 1,
      limit: 10,
      offset: 0,
      columns: []
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmsApi.list(
      'articles',
      { limit: 10, offset: 0, q: 'health', sort_by: 'created_at', sort_dir: 'desc' },
      'test-token'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/articles?');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=0');
    expect(calledUrl).toContain('q=health');
    expect(calledUrl).toContain('sort_by=created_at');
    expect(calledUrl).toContain('sort_dir=desc');
    expect(calledOptions.headers).toHaveProperty('Authorization', 'Bearer test-token');
    expect(result).toEqual(mockResponse);
  });

  it('get() gửi GET request lấy chi tiết một bản ghi', async () => {
    const mockDetail = { id: '123', name: 'Article 123' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetail,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmsApi.get('articles', '123', 'test-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/articles/123');
    expect(result).toEqual(mockDetail);
  });

  it('create() gửi POST request tạo bản ghi mới', async () => {
    const mockCreated = { id: 'new-id', name: 'New Article' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockCreated,
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = { name: 'New Article', status: 'published' };
    const result = await cmsApi.create('articles', payload, 'test-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, calledOptions] = fetchMock.mock.calls[0];
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers).toHaveProperty('Content-Type', 'application/json');
    expect(JSON.parse(calledOptions.body)).toEqual(payload);
    expect(result).toEqual(mockCreated);
  });

  it('update() gửi PUT request để cập nhật bản ghi', async () => {
    const mockUpdated = { id: '123', name: 'Updated Name' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUpdated,
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = { name: 'Updated Name' };
    const result = await cmsApi.update('articles', '123', payload, 'test-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/articles/123');
    expect(calledOptions.method).toBe('PUT');
    expect(JSON.parse(calledOptions.body)).toEqual(payload);
    expect(result).toEqual(mockUpdated);
  });

  it('remove() gửi DELETE request để xóa một bản ghi', async () => {
    const mockDeleted = { success: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDeleted,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmsApi.remove('articles', '123', 'test-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/articles/123');
    expect(calledOptions.method).toBe('DELETE');
    expect(result).toEqual(mockDeleted);
  });

  it('importCsv() gửi file dưới dạng FormData thông qua POST request', async () => {
    const mockImportResult = { imported: 5 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockImportResult,
    });
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['name,age\nJohn,30'], 'test.csv', { type: 'text/csv' });
    const result = await cmsApi.importCsv('patients', file, 'test-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/patients/import-csv');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.body).toBeInstanceOf(FormData);
    expect(result).toEqual(mockImportResult);
  });

  it('exportCsv() trả về một Blob dữ liệu CSV từ GET request', async () => {
    const mockBlob = new Blob(['name,age\nJohn,30'], { type: 'text/csv' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => mockBlob,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmsApi.exportCsv('patients', 'test-token', { q: 'John' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('/cms/patients/export-csv?q=John');
    expect(result).toEqual(mockBlob);
  });

  it('ném ra ngoại lệ với thông báo lỗi chi tiết khi API lỗi (status >= 400)', async () => {
    const errorResponse = { detail: 'Tài liệu không hợp lệ' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(cmsApi.get('articles', '123', 'test-token')).rejects.toThrow('Tài liệu không hợp lệ');
  });
});
