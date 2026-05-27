import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  Camera,
  Database,
  Cpu,
  FileText,
  HeartPulse,
  Home,
  LifeBuoy,
  MessageCircle,
  Pill,
  Settings,
  ShieldAlert,
  Stethoscope,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../auth/roles';

export interface RoleMenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const roleMenus: Record<UserRole, RoleMenuItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: BarChart3 },
    { label: 'CMS dữ liệu', path: '/admin/cms', icon: Database },
    { label: 'Quản lý tài khoản', path: '/admin/users', icon: UserCog },
    { label: 'Quản lý bác sĩ', path: '/admin/doctors', icon: Stethoscope },
    { label: 'Quản lý bệnh nhân', path: '/admin/patients', icon: Users },
    { label: 'Quản lý thiết bị IoT', path: '/admin/devices', icon: Cpu },
    { label: 'Quản lý camera', path: '/admin/cameras', icon: Camera },
    { label: 'Nhật ký cảnh báo', path: '/admin/alerts', icon: ShieldAlert },
    { label: 'Báo cáo thống kê', path: '/admin/reports', icon: BarChart3 },
    { label: 'Nhật ký hệ thống', path: '/admin/system-logs', icon: FileText },
    { label: 'Cài đặt', path: '/admin/settings', icon: Settings },
    { label: 'Hồ sơ cá nhân', path: '/admin/profile', icon: User },
  ],
  doctor: [
    { label: 'Dashboard bác sĩ', path: '/doctor/dashboard', icon: Activity },
    { label: 'Danh sách bệnh nhân', path: '/doctor/patients', icon: Users },
    { label: 'Lịch hẹn khám', path: '/doctor/appointments', icon: CalendarDays },
    { label: 'Bệnh án điện tử', path: '/doctor/medical-records', icon: FileText },
    { label: 'Theo dõi realtime', path: '/doctor/realtime-monitoring', icon: HeartPulse },
    { label: 'Cảnh báo sức khỏe', path: '/doctor/alerts', icon: AlertTriangle },
    { label: 'Đơn thuốc', path: '/doctor/prescriptions', icon: Pill },
    { label: 'Chat tư vấn', path: '/doctor/chat', icon: MessageCircle },
    { label: 'AI phân tích sức khỏe', path: '/doctor/ai-analysis', icon: Bot },
    { label: 'Báo cáo bệnh nhân', path: '/doctor/reports', icon: BarChart3 },
    { label: 'Hồ sơ cá nhân', path: '/doctor/profile', icon: User },
  ],
  patient: [
    { label: 'Trang chủ bệnh nhân', path: '/patient/home', icon: Home },
    { label: 'Chỉ số sức khỏe', path: '/patient/health', icon: HeartPulse },
    { label: 'Lịch sử sức khỏe', path: '/patient/history', icon: FileText },
    { label: 'Lịch hẹn của tôi', path: '/patient/appointments', icon: CalendarDays },
    { label: 'Đơn thuốc của tôi', path: '/patient/prescriptions', icon: Pill },
    { label: 'SOS khẩn cấp', path: '/patient/sos', icon: LifeBuoy },
    { label: 'Chat với bác sĩ', path: '/patient/chat', icon: MessageCircle },
    { label: 'Thông báo', path: '/patient/notifications', icon: Bell },
    { label: 'Hồ sơ cá nhân', path: '/patient/profile', icon: User },
    { label: 'Cài đặt', path: '/patient/settings', icon: Settings },
  ],
};
