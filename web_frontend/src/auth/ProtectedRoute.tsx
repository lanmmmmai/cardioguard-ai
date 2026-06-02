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
  const { isAuthenticated, loading, role, logout, requiresPasswordChange, user } = useAuth();

  React.useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !role || !user) {
      let targetLogin = '/login';
      const lastRole = sessionStorage.getItem('last_role');
      if (currentPath.startsWith('/admin')) {
        targetLogin = '/login-admin';
      } else if (currentPath.startsWith('/doctor')) {
        targetLogin = '/login-doctor';
      } else if (currentPath.startsWith('/patient')) {
        targetLogin = '/login';
      } else if (lastRole === 'admin') {
        targetLogin = '/login-admin';
      } else if (lastRole === 'doctor') {
        targetLogin = '/login-doctor';
      }
      navigate(targetLogin, true);
      return;
    }

    if (requiresPasswordChange && currentPath !== '/change-password') {
      navigate('/change-password', true);
      return;
    }

    // Role-specific guards
    if (role === 'patient') {
      if (!user.profile_completed && currentPath !== '/patient/complete-profile') {
        navigate('/patient/complete-profile', true);
        return;
      }
      if (user.profile_completed && currentPath === '/patient/complete-profile') {
        navigate('/patient/dashboard', true);
        return;
      }
    }

    if (role === 'doctor') {
      if (!user.profile_completed) {
        if (currentPath !== '/doctor/complete-profile') {
          navigate('/doctor/complete-profile', true);
          return;
        }
      } else {
        const status = (user.status || '').toLowerCase().trim();
        if (!user.is_verified) {
          if (status === 'pending_verification' && currentPath !== '/doctor/pending-verification') {
            navigate('/doctor/pending-verification', true);
            return;
          }
          if (status === 'rejected' && currentPath !== '/doctor/verification-rejected') {
            navigate('/doctor/verification-rejected', true);
            return;
          }
          if (status === 'need_update' && currentPath !== '/doctor/complete-profile') {
            navigate('/doctor/complete-profile', true);
            return;
          }
          // fallback if is_verified=false and status is not set to need_update or rejected
          if (status !== 'pending_verification' && status !== 'rejected' && status !== 'need_update' && currentPath !== '/doctor/pending-verification') {
            navigate('/doctor/pending-verification', true);
            return;
          }
        } else {
          if (['/doctor/pending-verification', '/doctor/verification-rejected', '/doctor/complete-profile'].includes(currentPath)) {
            navigate('/doctor/dashboard', true);
            return;
          }
        }
      }
    }

    // Standard role authorization check
    // If the path is a special onboarding route, allow it for that role
    const isOnboardingRoute = 
      (role === 'patient' && currentPath === '/patient/complete-profile') ||
      (role === 'doctor' && ['/doctor/complete-profile', '/doctor/pending-verification', '/doctor/verification-rejected'].includes(currentPath));

    if (!isOnboardingRoute && !allowedRoles.includes(role)) {
      navigate(defaultRouteByRole[role], true);
    }
  }, [allowedRoles, currentPath, isAuthenticated, loading, navigate, role, requiresPasswordChange, user]);

  if (loading) {
    return <div className="route-loading">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!isAuthenticated || !role || !user) {
    return null;
  }

  const isOnboardingRoute = 
    (role === 'patient' && currentPath === '/patient/complete-profile') ||
    (role === 'doctor' && ['/doctor/complete-profile', '/doctor/pending-verification', '/doctor/verification-rejected'].includes(currentPath));

  if (!isOnboardingRoute && !allowedRoles.includes(role)) {
    return null;
  }

  if (!defaultRouteByRole[role]) {
    logout();
    let targetLogin = '/login';
    const lastRole = sessionStorage.getItem('last_role') || role;
    if (currentPath.startsWith('/admin')) {
      targetLogin = '/login-admin';
    } else if (currentPath.startsWith('/doctor')) {
      targetLogin = '/login-doctor';
    } else if (lastRole === 'admin') {
      targetLogin = '/login-admin';
    } else if (lastRole === 'doctor') {
      targetLogin = '/login-doctor';
    }
    navigate(targetLogin, true);
    return null;
  }

  return <>{children}</>;
};
