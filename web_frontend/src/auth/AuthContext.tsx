/**
 * Tệp: CardioGuard AI – Context xác thực và provider
 * Mục đích: Cung cấp trạng thái xác thực toàn cục (token, người dùng, vai trò),
 *           hành động đăng nhập/đăng xuất và tự động khôi phục phiên khi gắn
 *           thông qua /auth/me.
 * Luồng xử lý: 1. Provider đọc token và người dùng từ sessionStorage khi khởi tạo.
 *              2. Khi gắn, nếu token tồn tại, nó gọi refreshUser() để
 *                 xác thực phiên ở phía server.
 *              3. login() lưu trữ thông tin đăng nhập, logout() xóa chúng và kích hoạt
 *                 đăng xuất phía server.
 *              4. useAuth() hook hiển thị trạng thái và hành động cho bất kỳ thành phần con nào.
 * Quan hệ:
 *   - sử dụng: ../config (API_URL), ./roles (AuthUser, normalizeRole)
 *   - được tiêu thụ bởi: ProtectedRoute, RoleLayout, bất kỳ trang nào cần trạng thái xác thực
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { API_URL } from '../config';
import { AuthUser, UserRole, normalizeRole } from './roles';
import { readJsonResponse } from '../utils/response';

interface AuthContextValue {
  accessToken: string | null;
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  authError: string | null;
  requiresPasswordChange: boolean;
  login: (token: string, user: AuthUser) => AuthUser;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storageMock = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {}
};
const storage = typeof window !== 'undefined' ? window.sessionStorage : storageMock;

const TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

/** Tuần tự hóa dữ liệu người dùng tối thiểu để lưu phiên trong sessionStorage */
const serializeStoredUser = (data: unknown): string => JSON.stringify(data);

/** Giải tuần tự dữ liệu người dùng đã lưu từ sessionStorage */
const deserializeStoredUser = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Ép kiểu đối tượng người dùng API thô thành AuthUser đã chuẩn hóa.
 * Dự phòng về null nếu vai trò không hợp lệ hoặc người dùng là falsy.
 */
const normalizeUser = (user: any): AuthUser | null => {
  const role = normalizeRole(user?.role);
  if (!user || !role) return null;

  return {
    id: String(user.id),
    full_name: user.full_name || user.email || 'Người dùng',
    email: user.email,
    phone: user.phone || null,
    role,
    created_at: user.created_at || null,
    status: user.status || null,
    must_change_password: user.must_change_password || false,
    profile_completed: Boolean(user.profile_completed),
    is_verified: Boolean(user.is_verified),
    avatar_url: user.avatar_url || null,
  };
};

/**
 * AuthProvider – Bọc ứng dụng và cung cấp context xác thực cho tất cả các thành phần con.
 * Khôi phục phiên từ sessionStorage khi gắn; cung cấp đăng nhập/đăng xuất/làm mới.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return storage.getItem(TOKEN_KEY);
    } catch {
      storage.removeItem(TOKEN_KEY);
      return null;
    }
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = storage.getItem(USER_KEY);
      return stored ? normalizeUser(deserializeStoredUser(stored)) : null;
    } catch {
      storage.removeItem(USER_KEY);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /** Xóa tất cả trạng thái xác thực, thông báo cho server và chuyển hướng đến trang đăng nhập */
  const logout = () => {
    if (accessToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
    storage.removeItem(USER_KEY);
    storage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    setAuthError(null);
  };

  /** Lưu trữ thông tin đăng nhập vào sessionStorage và đặt trạng thái trong bộ nhớ */
  const login = (token: string, rawUser: AuthUser) => {
    const normalizedUser = normalizeUser(rawUser);
    if (!normalizedUser) {
      logout();
      throw new Error('Tài khoản chưa được phân quyền');
    }

    storage.setItem(USER_KEY, serializeStoredUser(normalizedUser));
    storage.setItem(TOKEN_KEY, token);
    storage.setItem('last_role', normalizedUser.role);
    setAccessToken(token);
    setUser(normalizedUser);
    setAuthError(null);
    return normalizedUser;
  };

  /** Tìm nạp hồ sơ người dùng mới nhất từ /auth/me và cập nhật trạng thái */
  const refreshUser = useCallback(async () => {
    if (!accessToken) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Phiên đăng nhập đã hết hạn' : 'Không lấy được thông tin tài khoản');
    }

    const data = await readJsonResponse<{ user?: any }>(response);
    const normalizedUser = normalizeUser(data.user || data);
    if (!normalizedUser) {
      throw new Error('Tài khoản chưa được phân quyền');
    }

    storage.setItem(USER_KEY, serializeStoredUser(normalizedUser));
    storage.setItem('last_role', normalizedUser.role);
    setUser(normalizedUser);
    return normalizedUser;
  }, [accessToken]);

  useEffect(() => {
    const restoreSession = async () => {
      if (!accessToken) {
        storage.removeItem(USER_KEY);
        storage.removeItem(TOKEN_KEY);
        setLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch (err: any) {
        logout();
        setAuthError(err.message || 'Không thể khôi phục phiên đăng nhập');
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [accessToken, refreshUser]);

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(accessToken && user),
    loading,
    authError,
    requiresPasswordChange: user?.must_change_password === true,
    login,
    logout,
    refreshUser,
  }), [accessToken, user, loading, authError, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Hook tiện lợi để truy cập context xác thực; ném lỗi nếu được sử dụng bên ngoài AuthProvider */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
