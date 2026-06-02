import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  Database,
  FileText,
  HeartPulse,
  Home,
  Mail,
  MessageCircle,
  Pill,
  Settings,
  ShieldAlert,
  User,
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
    { label: 'CMS dữ liệu',    path: '/admin/cms',    icon: Database },
    { label: 'Email CMS',       path: '/admin/email',  icon: Mail },
  ],
  doctor: [
    { label: 'Dashboard', path: '/doctor/dashboard', icon: BarChart3 },
    { label: 'AI Command Center', path: '/doctor/ai-assistant', icon: Bot },
    { label: 'Quản lý bệnh nhân', path: '/doctor/patients', icon: Users },
    { label: 'Cảnh báo khẩn cấp', path: '/doctor/alerts', icon: ShieldAlert },
    { label: 'Lịch hẹn khám', path: '/doctor/appointments', icon: CalendarDays },
    { label: 'Kê đơn thuốc', path: '/doctor/prescriptions', icon: Pill },
    { label: 'Báo cáo y tế', path: '/doctor/reports', icon: FileText },
    { label: 'Nhắn tin', path: '/doctor/chat', icon: MessageCircle },
    { label: 'Chatbot AI', path: '/doctor/chatbot', icon: Bot },
  ],
  patient: [
    { label: 'Dashboard', path: '/patient/home', icon: Home },
    { label: 'Trợ lý AI', path: '/patient/chatbot', icon: Bot },
    { label: 'Chỉ số sức khỏe', path: '/patient/metrics', icon: HeartPulse },
    { label: 'Lịch hẹn của tôi', path: '/patient/appointments', icon: CalendarDays },
    { label: 'Chat với bác sĩ', path: '/patient/chat', icon: MessageCircle },
    { label: 'Thông báo', path: '/patient/notifications', icon: Bell },
    { label: 'Hồ sơ cá nhân', path: '/patient/profile', icon: User },
    { label: 'Cài đặt', path: '/patient/settings', icon: Settings },
  ],
};
