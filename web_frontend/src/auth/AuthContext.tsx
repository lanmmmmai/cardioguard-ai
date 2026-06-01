import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { AuthUser, UserRole, normalizeRole } from './roles';

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
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = storage.getItem('user');
      return stored ? normalizeUser(JSON.parse(stored)) : null;
    } catch {
      storage.removeItem('user');
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const logout = () => {
    storage.removeItem('user');
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

    storage.setItem('user', JSON.stringify(normalizedUser));
    setAccessToken(token);
    setUser(normalizedUser);
    setAuthError(null);
    return normalizedUser;
  };

  const refreshUser = async () => {
    if (!accessToken) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Phiên đăng nhập đã hết hạn' : 'Không lấy được thông tin tài khoản');
    }

    const data = await response.json();
    const normalizedUser = normalizeUser(data.user || data);
    if (!normalizedUser) {
      throw new Error('Tài khoản chưa được phân quyền');
    }

    storage.setItem('user', JSON.stringify(normalizedUser));
    setAccessToken(accessToken);
    setUser(normalizedUser);
    return normalizedUser;
  };

  useEffect(() => {
    const restoreSession = async () => {
      if (!accessToken) {
        storage.removeItem('user');
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
  }, [accessToken]);

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
