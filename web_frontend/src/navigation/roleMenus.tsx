/**
 * Tệp: CardioGuard AI – Menu điều hướng sidebar dựa trên vai trò
 * Mục đích: Định nghĩa danh sách mục menu sidebar cho mỗi vai trò người dùng
 *           với biểu tượng Lucide, nhãn tiếng Việt và phân nhóm logic.
 * Luồng xử lý: Mỗi vai trò (admin, doctor, patient) nhận một mảng tĩnh
 *           các đối tượng RoleMenuItem có định nghĩa nhóm (group). RoleLayout
 *           sử dụng nhóm này để hiển thị tiêu đề phân cấp trên sidebar và Mobile Drawer.
 * Quan hệ:
 *   - Được sử dụng bởi: RoleLayout (hiển thị menu cho vai trò hiện tại)
 *   - Import biểu tượng lucide-react cho mỗi mục menu
 */

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
  MessageCircle,
  Pill,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../auth/roles';

/** Một mục menu điều hướng đơn lẻ với nhãn, đường dẫn, biểu tượng và nhóm logic */
export interface RoleMenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group?: string;
}

/** Cây menu sidebar được lập chỉ mục theo vai trò người dùng */
export const roleMenus: Record<UserRole, RoleMenuItem[]> = {
  admin: [
    // 1. Tổng quan
    { label: 'Dashboard', path: '/admin/dashboard', icon: BarChart3, group: 'group_overview' },
    
    // 2. Quản lý người dùng
    { label: 'Quản lý tài khoản', path: '/admin/users', icon: UserCog, group: 'group_users' },
    { label: 'Quản lý bác sĩ', path: '/admin/doctors', icon: Stethoscope, group: 'group_users' },
    { label: 'Xác thực bác sĩ', path: '/admin/doctor-verification', icon: ShieldCheck, group: 'group_users' },
    { label: 'Quản lý bệnh nhân', path: '/admin/patients', icon: Users, group: 'group_users' },
    
    // 3. Giám sát & Phần cứng
    { label: 'Thiết bị & Cảm biến', path: '/admin/devices', icon: Cpu, group: 'group_devices' },
    { label: 'Quản lý Camera', path: '/admin/cameras', icon: Camera, group: 'group_devices' },
    { label: 'Cảnh báo hệ thống', path: '/admin/alerts', icon: AlertTriangle, group: 'group_devices' },
    
    // 4. Y tế & Báo cáo
    { label: 'Bệnh án điện tử', path: '/admin/medical-records', icon: FileText, group: 'group_medical' },
    { label: 'Báo cáo y tế', path: '/admin/reports', icon: FileText, group: 'group_medical' },
    
    // 5. Hệ thống & Cấu hình
    { label: 'CMS dữ liệu', path: '/admin/cms', icon: Database, group: 'group_system' },
    { label: 'Nhật ký hệ thống', path: '/admin/system-logs', icon: Activity, group: 'group_system' },
    { label: 'Cài đặt hệ thống', path: '/admin/settings', icon: Settings, group: 'group_system' },
  ],
  doctor: [
    // 1. Tổng quan & Trợ lý AI
    { label: 'Dashboard', path: '/doctor/dashboard', icon: BarChart3, group: 'group_overview_ai' },
    { label: 'AI Command Center', path: '/doctor/ai-assistant', icon: Bot, group: 'group_overview_ai' },
    { label: 'Chatbot AI', path: '/doctor/chatbot', icon: Bot, group: 'group_overview_ai' },
    
    // 2. Quản lý & Lâm sàng
    { label: 'Quản lý bệnh nhân', path: '/doctor/patients', icon: Users, group: 'group_clinical_mgmt' },
    { label: 'Bệnh án điện tử', path: '/doctor/medical-records', icon: FileText, group: 'group_clinical_mgmt' },
    { label: 'Lịch hẹn khám', path: '/doctor/appointments', icon: CalendarDays, group: 'group_clinical_mgmt' },
    { label: 'Kê đơn thuốc', path: '/doctor/prescriptions', icon: Pill, group: 'group_clinical_mgmt' },
    
    // 3. Giám sát & Báo cáo
    { label: 'Cảnh báo khẩn cấp', path: '/doctor/alerts', icon: ShieldAlert, group: 'group_monitoring_reports' },
    { label: 'Báo cáo y tế', path: '/doctor/reports', icon: FileText, group: 'group_monitoring_reports' },
    
    // 4. Giao tiếp
    { label: 'Nhắn tin', path: '/doctor/chat', icon: MessageCircle, group: 'group_communication' },
  ],
  patient: [
    // 1. Tổng quan & Trợ lý
    { label: 'Dashboard', path: '/patient/home', icon: Home, group: 'group_overview_ai' },
    { label: 'Trợ lý AI', path: '/patient/chatbot', icon: Bot, group: 'group_overview_ai' },
    
    // 2. Sức khỏe & Y tế
    { label: 'Chỉ số sức khỏe', path: '/patient/metrics', icon: HeartPulse, group: 'group_health_medical' },
    { label: 'Bệnh án điện tử', path: '/patient/medical-records', icon: FileText, group: 'group_health_medical' },
    { label: 'Lịch hẹn của tôi', path: '/patient/appointments', icon: CalendarDays, group: 'group_health_medical' },
    
    // 3. Giao tiếp & Thông báo
    { label: 'Chat với bác sĩ', path: '/patient/chat', icon: MessageCircle, group: 'group_comm_notifs' },
    { label: 'Thông báo', path: '/patient/notifications', icon: Bell, group: 'group_comm_notifs' },
    
    // 4. Tài khoản cá nhân
    { label: 'Hồ sơ cá nhân', path: '/patient/profile', icon: User, group: 'group_account' },
    { label: 'Cài đặt', path: '/patient/settings', icon: Settings, group: 'group_account' },
  ],
};
