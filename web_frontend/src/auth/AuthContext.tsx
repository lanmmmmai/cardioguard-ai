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
const storage = window.sessionStorage;
const TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

const encryptData = (data: any): string => {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
};

const decryptData = (ciphertext: string): any => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(ciphertext))));
  } catch {
    return null;
  }
};

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
      return stored ? normalizeUser(decryptData(stored)) : null;
    } catch {
      storage.removeItem(USER_KEY);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const logout = () => {
    console.info('Auth logout: user=%s', user?.email);
    if (accessToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch((e) => console.error('API logout error:', e));
    }
    storage.removeItem(USER_KEY);
    storage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    setAuthError(null);
  };

  const login = (token: string, rawUser: AuthUser) => {
    const normalizedUser = normalizeUser(rawUser);
    if (!normalizedUser) {
      logout();
      throw new Error('Tài khoản chưa được phân quyền');
    }

    console.info('Auth login: email=%s role=%s', normalizedUser.email, normalizedUser.role);
    storage.setItem(USER_KEY, encryptData(normalizedUser));
    storage.setItem(TOKEN_KEY, token);
    storage.setItem('last_role', normalizedUser.role);
    setAccessToken(token);
    setUser(normalizedUser);
    setAuthError(null);
    return normalizedUser;
  };

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

    storage.setItem(USER_KEY, encryptData(normalizedUser));
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
        console.info('Session restored: user=%s role=%s', user?.email, user?.role);
      } catch (err: any) {
        console.warn('Session restore failed:', err.message);
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
  }), [accessToken, user, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
