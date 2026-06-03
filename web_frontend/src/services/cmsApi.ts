import { API_URL } from '../config';

export interface CmsColumn {
  name: string;
  type: string;
  nullable: boolean;
  readonly: boolean;
}

export interface CmsListResponse {
  items: Array<Record<string, any>>;
  total: number;
  limit: number;
  offset: number;
  columns: CmsColumn[];
}

export interface CmsQuery {
  limit: number;
  offset: number;
  q?: string;
  filter?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  ...authHeaders(token),
});

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

export const cmsApi = {
  async list(module: string, query: CmsQuery, token: string): Promise<CmsListResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(query.limit));
    params.set('offset', String(query.offset));
    if (query.q) params.set('q', query.q);
    if (query.filter) params.set('filter', query.filter);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_dir) params.set('sort_dir', query.sort_dir);
    const response = await fetch(`${API_URL}/cms/${module}?${params.toString()}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
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
