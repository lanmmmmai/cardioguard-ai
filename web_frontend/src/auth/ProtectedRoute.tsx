import React from 'react';
import { UserRole, defaultRouteByRole } from './roles';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, currentPath, navigate, children }) => {
  const { isAuthenticated, loading, role, logout, requiresPasswordChange } = useAuth();

  React.useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !role) {
      let targetLogin = '/login';
      if (currentPath.startsWith('/admin')) {
        targetLogin = '/login-admin';
      } else if (currentPath.startsWith('/doctor')) {
        targetLogin = '/login-doctor';
      } else if (currentPath.startsWith('/patient')) {
        targetLogin = '/login';
      }
      navigate(targetLogin, true);
      return;
    }

    if (requiresPasswordChange && currentPath !== '/change-password') {
      navigate('/change-password', true);
      return;
    }

    if (!allowedRoles.includes(role)) {
      navigate(defaultRouteByRole[role], true);
    }
  }, [allowedRoles, currentPath, isAuthenticated, loading, navigate, role, requiresPasswordChange]);

  if (loading) {
    return <div className="route-loading">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!isAuthenticated || !role) {
    return null;
  }

  if (!allowedRoles.includes(role)) {
    return null;
  }

  if (!defaultRouteByRole[role]) {
    logout();
    let targetLogin = '/login';
    if (currentPath.startsWith('/admin')) {
      targetLogin = '/login-admin';
    } else if (currentPath.startsWith('/doctor')) {
      targetLogin = '/login-doctor';
    }
    navigate(targetLogin, true);
    return null;
  }

  return <>{children}</>;
};
