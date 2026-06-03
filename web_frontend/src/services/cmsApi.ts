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
    console.debug('[cmsApi.list] module=%s limit=%d offset=%d', module, query.limit, query.offset);
    const params = new URLSearchParams();
    params.set('limit', String(query.limit));
    params.set('offset', String(query.offset));
    if (query.q) params.set('q', query.q);
    if (query.filter) params.set('filter', query.filter);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_dir) params.set('sort_dir', query.sort_dir);
    const listUrl = `${API_URL}/cms/${module}?${params.toString()}`;
    console.info('[cmsApi.list] GET %s', listUrl);
    try {
      const response = await fetch(listUrl, {
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await readError(response));
      console.info('[cmsApi.list] %d OK', response.status);
      return response.json();
    } catch (err) {
      console.error('[cmsApi.list] %s', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  async get(module: string, id: string, token: string) {
    const response = await fetch(`${API_URL}/cms/${module}/${id}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async create(module: string, payload: Record<string, any>, token: string) {
    const response = await fetch(`${API_URL}/cms/${module}`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async update(module: string, id: string, payload: Record<string, any>, token: string) {
    const response = await fetch(`${API_URL}/cms/${module}/${id}`, {
      method: 'PUT',
      headers: jsonHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async remove(module: string, id: string, token: string) {
    const response = await fetch(`${API_URL}/cms/${module}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async importCsv(module: string, file: File, token: string) {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${API_URL}/cms/${module}/import-csv`, {
      method: 'POST',
      headers: authHeaders(token),
      body,
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async exportCsv(module: string, token: string, query?: Pick<CmsQuery, 'q' | 'filter'>) {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.filter) params.set('filter', query.filter);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/cms/${module}/export-csv${suffix}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.blob();
  },

  async uploadDomainLinkImage(file: File, token: string) {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${API_URL}/cms/domain-links/upload-image`, {
      method: 'POST',
      headers: authHeaders(token),
      body,
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },
};
