export type UserRole = 'admin' | 'doctor' | 'patient';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  created_at?: string | null;
  status?: string | null;
  must_change_password?: boolean;
}

export const VALID_ROLES: UserRole[] = ['admin', 'doctor', 'patient'];

export const normalizeRole = (role?: string | null): UserRole | null => {
  const normalized = role?.trim().toLowerCase();
  return VALID_ROLES.includes(normalized as UserRole) ? (normalized as UserRole) : null;
};

export const defaultRouteByRole: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  patient: '/patient/home',
};

export const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  patient: 'Patient',
};
