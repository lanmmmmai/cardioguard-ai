/**
 * Tệp: CardioGuard AI – Định nghĩa kiểu vai trò và các tiện ích
 * Mục đích: Định nghĩa ba vai trò người dùng được hỗ trợ (admin, doctor, patient),
 *           hình dạng AuthUser và các hàm trợ giúp để chuẩn hóa vai trò
 *           và định tuyến dựa trên vai trò.
 * Luồng xử lý: normalizeRole() làm sạch chuỗi thô thành UserRole hợp lệ hoặc null.
 *              defaultRouteByRole ánh xạ mỗi vai trò đến trang đích của nó.
 *              roleLabel cung cấp nhãn hiển thị cho mỗi vai trò.
 * Quan hệ:
 *   - Được sử dụng bởi: AuthContext, ProtectedRoute, RoleLayout, routeMeta, roleMenus
 */

export type UserRole = 'admin' | 'doctor' | 'patient';

/** Hồ sơ người dùng đã xác thực được trả về từ backend xác thực */
export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  created_at?: string | null;
  status?: string | null;
  must_change_password?: boolean;
  profile_completed?: boolean;
  is_verified?: boolean;
  avatar_url?: string | null;
}

export const VALID_ROLES: UserRole[] = ['admin', 'doctor', 'patient'];

/**
 * Chuẩn hóa chuỗi vai trò thô thành UserRole hợp lệ.
 * Cắt khoảng trắng, chuyển thành chữ thường và xác thực dựa trên VALID_ROLES.
 * Trả về null cho đầu vào không được công nhận hoặc rỗng.
 */
export const normalizeRole = (role?: string | null): UserRole | null => {
  const normalized = role?.trim().toLowerCase();
  return VALID_ROLES.includes(normalized as UserRole) ? (normalized as UserRole) : null;
};

/** Đường dẫn mặc định cho mỗi vai trò sau khi đăng nhập */
export const defaultRouteByRole: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  patient: '/patient/dashboard',
};

/** Nhãn hiển thị cho mỗi vai trò (tiếng Việt) */
export const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  patient: 'Patient',
};
