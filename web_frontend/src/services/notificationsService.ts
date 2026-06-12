/**
 * Tệp: CardioGuard AI – Trình khách API thông báo
 * Mục đích: Cung cấp giao diện có kiểu cho các hoạt động lấy danh sách thông báo,
 *           đếm số lượng chưa đọc, đánh dấu đã đọc và quản lý tuỳ chọn nhận thông báo.
 * Luồng xử lý: Gửi các yêu cầu HTTP PATCH/GET tới các điểm cuối tương ứng của
 *           router `/api/notifications` sử dụng buildApiUrl và token JWT của người dùng.
 * Quan hệ:
 *   - Sử dụng: ../config (buildApiUrl)
 *   - Được sử dụng bởi: NotificationProvider.tsx và các trang Notification Center
 */

import { buildApiUrl } from '../config';

export interface Notification {
  id: string;
  user_id: string;
  patient_id?: string | null;
  actor_id?: string | null;
  type: string;
  category: 'health' | 'appointment' | 'record' | 'chat' | 'system' | 'security';
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  source_table?: string | null;
  source_id?: string | null;
  metadata?: Record<string, any>;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

export interface NotificationPreferences {
  health: boolean;
  appointment: boolean;
  record: boolean;
  chat: boolean;
  system: boolean;
  security: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  limit: number;
  offset: number;
}

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});

const jsonHeaders = (token: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...authHeaders(token),
});

const requestJson = async <T = any>(path: string, token: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...authHeaders(token),
    },
  });

  const body = await response.text();
  if (!response.ok) {
    if (!body) {
      throw new Error(`Yêu cầu thất bại (${response.status})`);
    }
    try {
      const data = JSON.parse(body);
      if (Array.isArray(data.detail)) {
        throw new Error(data.detail.map((item: any) => item.msg || item).join(', '));
      }
      throw new Error(data.detail || data.message || data.error || `Yêu cầu thất bại (${response.status})`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(body);
      }
      throw error;
    }
  }

  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('Lỗi định dạng phản hồi từ server');
  }
};

export const notificationsService = {
  /**
   * Lấy danh sách thông báo có phân trang và bộ lọc.
   */
  async list(
    token: string,
    params: {
      limit?: number;
      offset?: number;
      is_read?: boolean;
      category?: string;
      severity?: string;
    } = {}
  ): Promise<NotificationListResponse> {
    const urlParams = new URLSearchParams();
    if (params.limit !== undefined) urlParams.set('limit', String(params.limit));
    if (params.offset !== undefined) urlParams.set('offset', String(params.offset));
    if (params.is_read !== undefined) urlParams.set('is_read', String(params.is_read));
    if (params.category) urlParams.set('category', params.category);
    if (params.severity) urlParams.set('severity', params.severity);

    const queryString = urlParams.toString();
    const path = `/notifications${queryString ? `?${queryString}` : ''}`;
    return requestJson<NotificationListResponse>(path, token);
  },

  /**
   * Đếm số lượng thông báo chưa đọc.
   */
  async getUnreadCount(token: string): Promise<number> {
    const res = await requestJson<{ count: number }>('/notifications/unread-count', token);
    return res.count;
  },

  /**
   * Đánh dấu một thông báo là đã đọc.
   */
  async markRead(notificationId: string, token: string): Promise<boolean> {
    const res = await requestJson<{ success: boolean }>(`/notifications/${notificationId}/read`, token, {
      method: 'PATCH',
    });
    return res.success;
  },

  /**
   * Đánh dấu tất cả thông báo là đã đọc.
   */
  async markAllRead(token: string): Promise<boolean> {
    const res = await requestJson<{ success: boolean }>('/notifications/read-all', token, {
      method: 'PATCH',
    });
    return res.success;
  },

  /**
   * Lấy tuỳ chọn nhận thông báo của người dùng.
   */
  async getPreferences(token: string): Promise<NotificationPreferences> {
    return requestJson<NotificationPreferences>('/notifications/preferences', token);
  },

  /**
   * Cập nhật tuỳ chọn nhận thông báo của người dùng.
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>,
    token: string
  ): Promise<NotificationPreferences> {
    const response = await fetch(buildApiUrl('/notifications/preferences'), {
      method: 'PATCH',
      headers: jsonHeaders(token),
      body: JSON.stringify(preferences),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(body || 'Không thể cập nhật tuỳ chọn nhận thông báo');
    }

    try {
      return JSON.parse(body) as NotificationPreferences;
    } catch {
      throw new Error('Lỗi định dạng phản hồi từ server');
    }
  },
};
