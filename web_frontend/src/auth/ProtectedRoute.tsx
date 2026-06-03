/**
 * Tệp: CardioGuard AI – Bảo vệ tuyến đường dựa trên vai trò
 * Mục đích: Giới hạn quyền truy cập trang cho người dùng đã xác thực với vai trò cụ thể.
 *           Chuyển hướng người dùng chưa xác thực đến /login, thực thi yêu cầu
 *           đổi mật khẩu và chuyển hướng vai trò không được phép đến trang mặc định của họ.
 * Luồng xử lý: 1. Nếu đang tải, hiển thị chỉ báo "đang kiểm tra phiên".
 *              2. Nếu chưa xác thực → chuyển hướng đến /login.
 *              3. Nếu must_change_password → chuyển hướng đến /change-password.
 *              4. Nếu vai trò không nằm trong allowedRoles → chuyển hướng đến tuyến đường mặc định của vai trò.
 *              5. Nếu không, render children.
 * Quan hệ:
 *   - sử dụng: ./roles (UserRole, defaultRouteByRole), ./AuthContext (useAuth)
 *   - được tiêu thụ bởi: định nghĩa tuyến đường App.tsx
 */

import React from 'react';
import { UserRole, defaultRouteByRole } from './roles';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  children: React.ReactNode;
}

/**
 * Thành phần ProtectedRoute – Bọc một trang và kiểm soát quyền truy cập dựa trên
 * trạng thái xác thực và các vai trò được phép.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, currentPath, navigate, children }) => {
  const { isAuthenticated, loading, role, logout, requiresPasswordChange } = useAuth();

  React.useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !role) {
      navigate('/login', true);
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
    navigate('/login', true);
    return null;
  }

  return <>{children}</>;
};
