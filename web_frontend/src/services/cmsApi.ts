/**
 * Tệp: CardioGuard AI – Trình khách API REST CMS
 * Mục đích: Cung cấp giao diện có kiểu cho các hoạt động CRUD với các điểm cuối
 *           module CMS backend, cùng với xuất/nhập CSV.
 * Luồng xử lý: Mỗi phương thức xây dựng cuộc gọi fetch thích hợp với tiêu đề xác thực
 *           và nội dung JSON/FormData, sau đó phân tích hoặc ném ra với lỗi có thể đọc được.
 *           readError() trích xuất thông báo chi tiết từ server khi thất bại.
 * Quan hệ:
 *   - sử dụng: ../config (API_URL)
 *   - được tiêu thụ bởi: trang CMS admin (lưới dữ liệu, biểu mẫu)
 */

import { API_URL } from '../config';
import { logger } from '../utils/logger';

/** Siêu dữ liệu cho một cột đơn trong view danh sách CMS */
export interface CmsColumn {
  name: string;
  type: string;
  nullable: boolean;
  readonly: boolean;
}

/** Phản hồi danh sách có phân trang từ một module CMS */
export interface CmsListResponse {
  items: Array<Record<string, any>>;
  total: number;
  limit: number;
  offset: number;
  columns: CmsColumn[];
}

/** Tham số truy vấn cho điểm cuối danh sách CMS */
export interface CmsQuery {
  limit: number;
  offset: number;
  q?: string;
  filter?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

/** Xây dựng đối tượng tiêu đề Authorization */
const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/** Xây dựng tiêu đề với Content-Type JSON + Authorization */
const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  ...authHeaders(token),
});

/** Phân tích thông báo lỗi có thể đọc được từ phản hồi lỗi API */
const readError = async (response: Response) => {
  try {
    let data;

    try {
      data = await response.json();
    } catch (e) {
      throw new Error("Lỗi định dạng phản hồi từ server");
    }
    if (Array.isArray(data.detail)) return data.detail.map((item: any) => item.msg || item).join(', ');
    return data.detail || 'Yêu cầu CMS thất bại';
  } catch {
    return 'Yêu cầu CMS thất bại';
  }
};

/** Trình khách API REST CMS với các chức năng list, get, create, update, remove, import/export */
export const cmsApi = {
  async list(module: string, query: CmsQuery, token: string): Promise<CmsListResponse> {
    logger.debug('[cmsApi.list] module=%s limit=%d offset=%d', module, query.limit, query.offset);
    const params = new URLSearchParams();
    params.set('limit', String(query.limit));
    params.set('offset', String(query.offset));
    if (query.q) params.set('q', query.q);
    if (query.filter) params.set('filter', query.filter);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_dir) params.set('sort_dir', query.sort_dir);
    const listUrl = `${API_URL}/cms/${module}?${params.toString()}`;
    logger.info('[cmsApi.list] GET %s', listUrl);
    try {
      const response = await fetch(listUrl, {
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.list] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.list] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async get(module: string, id: string, token: string) {
    logger.debug('[cmsApi.get] module=%s id=%s', module, id);
    const getUrl = `${API_URL}/cms/${module}/${id}`;
    logger.info('[cmsApi.get] GET %s', getUrl);
    try {
      const response = await fetch(getUrl, {
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.get] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.get] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async create(module: string, payload: Record<string, any>, token: string) {
    logger.debug('[cmsApi.create] module=%s', module);
    const createUrl = `${API_URL}/cms/${module}`;
    logger.info('[cmsApi.create] POST %s', createUrl);
    try {
      const response = await fetch(createUrl, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.create] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.create] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async update(module: string, id: string, payload: Record<string, any>, token: string) {
    logger.debug('[cmsApi.update] module=%s id=%s', module, id);
    const updateUrl = `${API_URL}/cms/${module}/${id}`;
    logger.info('[cmsApi.update] PUT %s', updateUrl);
    try {
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.update] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.update] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async remove(module: string, id: string, token: string) {
    logger.debug('[cmsApi.remove] module=%s id=%s', module, id);
    const removeUrl = `${API_URL}/cms/${module}/${id}`;
    logger.info('[cmsApi.remove] DELETE %s', removeUrl);
    try {
      const response = await fetch(removeUrl, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.remove] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.remove] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async importCsv(module: string, file: File, token: string) {
    logger.debug('[cmsApi.importCsv] module=%s fileName=%s size=%d', module, file.name, file.size);
    const importUrl = `${API_URL}/cms/${module}/import-csv`;
    logger.info('[cmsApi.importCsv] POST %s', importUrl);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(importUrl, {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.importCsv] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.importCsv] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async exportCsv(module: string, token: string, query?: Pick<CmsQuery, 'q' | 'filter'>) {
    logger.debug('[cmsApi.exportCsv] module=%s hasQuery=%s', module, !!query);
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.filter) params.set('filter', query.filter);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const exportUrl = `${API_URL}/cms/${module}/export-csv${suffix}`;
    logger.info('[cmsApi.exportCsv] GET %s', exportUrl);
    try {
      const response = await fetch(exportUrl, {
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.exportCsv] %d OK', response.status);
      return response.blob();
    } catch (err) {
      logger.error('[cmsApi.exportCsv] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async uploadDomainLinkImage(file: File, token: string) {
    logger.debug('[cmsApi.uploadDomainLinkImage] fileName=%s size=%d', file.name, file.size);
    const uploadUrl = `${API_URL}/cms/domain-links/upload-image`;
    logger.info('[cmsApi.uploadDomainLinkImage] POST %s', uploadUrl);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });
      if (!response.ok) throw new Error(await readError(response));
      logger.info('[cmsApi.uploadDomainLinkImage] %d OK', response.status);
      return response.json();
    } catch (err) {
      logger.error('[cmsApi.uploadDomainLinkImage] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
};
