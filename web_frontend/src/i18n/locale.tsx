/**
 * Tệp: CardioGuard AI – Quản lý dịch thuật và ngôn ngữ (locale)
 * Mục đích: Cung cấp ngữ cảnh dịch thuật tiếng Việt (vi) và tiếng Anh (en) cho các nhãn trong ứng dụng,
 *           bao gồm siêu dữ liệu trang (PAGE_META), nhãn vai trò, nhãn menu và nhãn dùng chung.
 * Luồng xử lý: 1. Đọc và khôi phục ngôn ngữ đã lưu hoặc tự động phát hiện ngôn ngữ trình duyệt.
 *              2. Cung cấp LocaleProvider và hook useLocale để các thành phần con truy xuất hàm t(key).
 *              3. Lưu cấu hình ngôn ngữ đã thay đổi vào localStorage.
 * Quan hệ:
 *   - Được sử dụng bởi các thành phần giao diện chính như RoleLayout, App và các trang quản trị để hiển thị nhãn dịch thuật.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { UserRole } from '../auth/roles';

export type Locale = 'vi' | 'en';

const STORAGE_KEY = 'cardioguard_locale';

const PAGE_META: Record<Locale, Record<string, { title: string; subtitle: string }>> = {
  vi: {
    '/admin/email': { title: 'Email CMS', subtitle: 'Quản lý mẫu email, gửi thông báo và theo dõi lịch sử.' },
    '/admin/cms/domain-links': { title: 'CMS Domain Links', subtitle: 'Quản lý preview link cho Zalo, Messenger, Facebook và OG tags.' },
    '/admin/medical-records': { title: 'Bệnh án điện tử', subtitle: 'Giám sát toàn bộ bệnh án, trạng thái ký xác nhận và audit log.' },
    '/admin/patients': { title: 'Quản lý bệnh nhân', subtitle: 'Hồ sơ y tế, lịch sử khám và thông tin người bệnh.' },
    '/patient/chatbot': { title: 'Trợ lý AI', subtitle: 'Giải đáp, phân tích và theo dõi sức khỏe tim mạch.' },
    '/doctor/ai-assistant': { title: 'AI Command Center', subtitle: 'Trợ lý phân tích dữ liệu, tóm tắt bệnh án và phát hiện bất thường.' },
    '/doctor/chatbot': { title: 'Chatbot AI', subtitle: 'Giải đáp, phân tích và hỗ trợ tư vấn sức khỏe tim mạch.' },
    '/doctor/medical-records': { title: 'Bệnh án điện tử', subtitle: 'Tạo, sửa nháp, ký xác nhận và tạo bản bổ sung bệnh án.' },
    '/admin/doctors': { title: 'Quản lý bác sĩ', subtitle: 'Danh sách bác sĩ, phân công chuyên khoa và quyền truy cập.' },
    '/admin/users': { title: 'Quản lý tài khoản', subtitle: 'Phân quyền hệ thống, theo dõi trạng thái hoạt động và quản trị toàn bộ tài khoản người dùng CardioGuard.' },
    '/admin/system-logs': { title: 'Nhật ký hệ thống', subtitle: 'Audit log, lịch sử đăng nhập và thao tác bảo mật.' },
    '/admin/settings': { title: 'Cài đặt hệ thống', subtitle: 'Cấu hình nền tảng, API token và trạng thái kết nối.' },
    '/admin/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Thông tin tài khoản admin và đổi mật khẩu.' },
    '/doctor/prescriptions': { title: 'Đơn thuốc', subtitle: 'Kê đơn, xem lịch sử đơn thuốc và AI hỗ trợ tham khảo.' },
    '/doctor/chat': { title: 'Chat tư vấn', subtitle: 'Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân.' },
    '/doctor/messages': { title: 'Nhắn tin tư vấn', subtitle: 'Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân.' },
    '/doctor/ai-analysis': { title: 'AI phân tích sức khỏe', subtitle: 'Dự đoán nguy cơ tim mạch, phát hiện bất thường và gợi ý chẩn đoán tham khảo.' },
    '/doctor/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Thông tin bác sĩ, chuyên khoa và lịch làm việc.' },
    '/patient/home': { title: 'Trang chủ bệnh nhân', subtitle: 'Tổng quan chỉ số sức khỏe của bạn.' },
    '/patient/dashboard': { title: 'Trang chủ bệnh nhân', subtitle: 'Tổng quan chỉ số sức khỏe của bạn.' },
    '/patient/health': { title: 'Chỉ số sức khỏe', subtitle: 'Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime.' },
    '/patient/metrics': { title: 'Chỉ số sức khỏe', subtitle: 'Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime.' },
    '/patient/history': { title: 'Lịch sử sức khỏe', subtitle: 'Lưu trữ và phân tích chỉ số sức khỏe theo thời gian.' },
    '/patient/prescriptions': { title: 'Đơn thuốc của tôi', subtitle: 'Danh sách đơn thuốc hiện tại và lịch sử kê đơn.' },
    '/patient/sos': { title: 'SOS khẩn cấp', subtitle: 'Kích hoạt cảnh báo khẩn cấp gửi tới bác sĩ và hệ thống.' },
    '/patient/chat': { title: 'Chat với bác sĩ', subtitle: 'Trao đổi nhanh với bác sĩ phụ trách.' },
    '/patient/notifications': { title: 'Thông báo', subtitle: 'Lịch hẹn, cảnh báo sức khỏe và cập nhật hệ thống.' },
    '/patient/medical-records': { title: 'Bệnh án điện tử', subtitle: 'Xem các bệnh án đã được bác sĩ ký xác nhận.' },
    '/patient/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Xem/cập nhật thông tin cá nhân và ảnh đại diện.' },
    '/patient/settings': { title: 'Cài đặt', subtitle: 'Tùy chỉnh thông báo, bảo mật và giao diện.' },
    '/patient/complete-profile': { title: 'Hoàn thiện hồ sơ bệnh nhân', subtitle: 'Vui lòng cập nhật đầy đủ thông tin để kích hoạt tài khoản.' },
    '/doctor/complete-profile': { title: 'Hoàn thiện hồ sơ bác sĩ', subtitle: 'Tải lên chứng chỉ y khoa và thông tin chuyên môn.' },
    '/doctor/pending-verification': { title: 'Chờ xác thực tài khoản', subtitle: 'Hồ sơ của bạn đang được ban quản trị kiểm tra và xét duyệt.' },
    '/doctor/verification-rejected': { title: 'Hồ sơ bị từ chối xác thực', subtitle: 'Hồ sơ của bạn không đủ điều kiện phê duyệt.' },
    '/admin/doctor-verification': { title: 'Xác thực bác sĩ', subtitle: 'Xét duyệt và phê duyệt hồ sơ bác sĩ đăng ký.' },
  },
  en: {
    '/admin/email': { title: 'Email CMS', subtitle: 'Manage templates, send messages, and review delivery history.' },
    '/admin/cms/domain-links': { title: 'CMS Domain Links', subtitle: 'Manage link previews for Zalo, Messenger, Facebook, and OG tags.' },
    '/admin/medical-records': { title: 'Medical Records', subtitle: 'Monitor records, signature status, and audit logs.' },
    '/admin/patients': { title: 'Patient Management', subtitle: 'Medical profiles, visit history, and patient data.' },
    '/patient/chatbot': { title: 'AI Assistant', subtitle: 'Ask questions, analyze, and track cardiovascular health.' },
    '/doctor/ai-assistant': { title: 'AI Command Center', subtitle: 'Analyze data, summarize records, and surface anomalies.' },
    '/doctor/chatbot': { title: 'AI Chatbot', subtitle: 'Medical Q&A and cardiovascular guidance support.' },
    '/doctor/medical-records': { title: 'Medical Records', subtitle: 'Create drafts, sign records, and add amendments.' },
    '/admin/doctors': { title: 'Doctor Management', subtitle: 'Doctor list, specialties, and access control.' },
    '/admin/users': { title: 'Account Management', subtitle: 'System roles, activity status, and full user administration.' },
    '/admin/system-logs': { title: 'System Logs', subtitle: 'Audit logs, sign-in history, and security actions.' },
    '/admin/settings': { title: 'System Settings', subtitle: 'Platform configuration, API tokens, and connection status.' },
    '/admin/profile': { title: 'Profile', subtitle: 'Admin account details and password changes.' },
    '/doctor/prescriptions': { title: 'Prescriptions', subtitle: 'Prescribe, review history, and use AI as reference support.' },
    '/doctor/chat': { title: 'Consultation Chat', subtitle: 'Secure real-time consultation between doctor and patient.' },
    '/doctor/messages': { title: 'Consultation Messages', subtitle: 'Secure real-time consultation between doctor and patient.' },
    '/doctor/ai-analysis': { title: 'AI Health Analysis', subtitle: 'Estimate cardiac risk and surface reference findings.' },
    '/doctor/profile': { title: 'Profile', subtitle: 'Doctor details, specialty, and schedule.' },
    '/patient/home': { title: 'Patient Home', subtitle: 'Your live health overview.' },
    '/patient/dashboard': { title: 'Patient Home', subtitle: 'Your live health overview.' },
    '/patient/health': { title: 'Health Metrics', subtitle: 'Track heart rate, SpO2, blood pressure, and ECG in real time.' },
    '/patient/metrics': { title: 'Health Metrics', subtitle: 'Track heart rate, SpO2, blood pressure, and ECG in real time.' },
    '/patient/history': { title: 'Health History', subtitle: 'Store and analyze health metrics over time.' },
    '/patient/prescriptions': { title: 'My Prescriptions', subtitle: 'Current prescriptions and prescription history.' },
    '/patient/sos': { title: 'Emergency SOS', subtitle: 'Trigger urgent alerts for doctors and the system.' },
    '/patient/chat': { title: 'Chat with Doctor', subtitle: 'Quick communication with your doctor.' },
    '/patient/notifications': { title: 'Notifications', subtitle: 'Appointments, health alerts, and system updates.' },
    '/patient/medical-records': { title: 'Medical Records', subtitle: 'View signed medical records from your doctor.' },
    '/patient/profile': { title: 'Profile', subtitle: 'View or update personal details and avatar.' },
    '/patient/settings': { title: 'Settings', subtitle: 'Customize notifications, security, and appearance.' },
    '/patient/complete-profile': { title: 'Complete Patient Profile', subtitle: 'Please finish your profile to activate the account.' },
    '/doctor/complete-profile': { title: 'Complete Doctor Profile', subtitle: 'Upload credentials and professional information.' },
    '/doctor/pending-verification': { title: 'Awaiting Verification', subtitle: 'Your profile is under review by the admin team.' },
    '/doctor/verification-rejected': { title: 'Verification Rejected', subtitle: 'Your doctor profile did not meet the approval criteria.' },
    '/admin/doctor-verification': { title: 'Doctor Verification', subtitle: 'Review and approve doctor registration profiles.' },
  },
};

const ROLE_LABELS: Record<Locale, Record<UserRole, string>> = {
  vi: {
    admin: 'Admin',
    doctor: 'Bác sĩ',
    patient: 'Bệnh nhân',
  },
  en: {
    admin: 'Admin',
    doctor: 'Doctor',
    patient: 'Patient',
  },
};

const MENU_LABELS: Record<Locale, Record<string, string>> = {
  vi: {
    Dashboard: 'Dashboard',
    'CMS dữ liệu': 'CMS dữ liệu',
    'Bệnh án điện tử': 'Bệnh án điện tử',
    'Quản lý tài khoản': 'Quản lý tài khoản',
    'Quản lý bác sĩ': 'Quản lý bác sĩ',
    'Xác thực bác sĩ': 'Xác thực bác sĩ',
    'Quản lý bệnh nhân': 'Quản lý bệnh nhân',
    'Thiết bị & Cảm biến': 'Thiết bị & Cảm biến',
    'Quản lý Camera': 'Quản lý Camera',
    'Cảnh báo hệ thống': 'Cảnh báo hệ thống',
    'Báo cáo y tế': 'Báo cáo y tế',
    'Nhật ký hệ thống': 'Nhật ký hệ thống',
    'Cài đặt hệ thống': 'Cài đặt hệ thống',
    'AI Command Center': 'AI Command Center',
    'Lịch hẹn khám': 'Lịch hẹn khám',
    'Kê đơn thuốc': 'Kê đơn thuốc',
    'Nhắn tin': 'Nhắn tin',
    'Chatbot AI': 'Chatbot AI',
    'Cảnh báo khẩn cấp': 'Cảnh báo khẩn cấp',
    'Trợ lý AI': 'Trợ lý AI',
    'Lịch hẹn của tôi': 'Lịch hẹn của tôi',
    'Chat với bác sĩ': 'Chat với bác sĩ',
    'Thông báo': 'Thông báo',
    'Hồ sơ cá nhân': 'Hồ sơ cá nhân',
    'Cài đặt': 'Cài đặt',
    Home: 'Home',
    'My profile': 'My profile',
  },
  en: {
    Dashboard: 'Dashboard',
    'CMS dữ liệu': 'CMS Data',
    'Bệnh án điện tử': 'Medical Records',
    'Quản lý tài khoản': 'Account Management',
    'Quản lý bác sĩ': 'Doctor Management',
    'Xác thực bác sĩ': 'Doctor Verification',
    'Quản lý bệnh nhân': 'Patient Management',
    'Thiết bị & Cảm biến': 'Devices & Sensors',
    'Quản lý Camera': 'Camera Management',
    'Cảnh báo hệ thống': 'System Alerts',
    'Báo cáo y tế': 'Medical Reports',
    'Nhật ký hệ thống': 'System Logs',
    'Cài đặt hệ thống': 'System Settings',
    'AI Command Center': 'AI Command Center',
    'Lịch hẹn khám': 'Appointments',
    'Kê đơn thuốc': 'Prescriptions',
    'Nhắn tin': 'Messages',
    'Chatbot AI': 'AI Chatbot',
    'Cảnh báo khẩn cấp': 'Emergency Alerts',
    'Trợ lý AI': 'AI Assistant',
    'Lịch hẹn của tôi': 'My Appointments',
    'Chat với bác sĩ': 'Chat with Doctor',
    'Thông báo': 'Notifications',
    'Hồ sơ cá nhân': 'Profile',
    'Cài đặt': 'Settings',
    Home: 'Home',
    'My profile': 'My Profile',
  },
};

const COMMON_LABELS: Record<Locale, Record<string, string>> = {
  vi: {
    logout: 'Đăng xuất',
    all_features: 'Tất cả chức năng',
    more: 'Thêm',
    theme_light: 'Chuyển sang chế độ sáng',
    theme_dark: 'Chuyển sang chế độ tối',
    language: 'Ngôn ngữ',
    notifications: 'Thông báo',
    security: 'Bảo mật',
    appearance: 'Giao diện',
    preferences: 'Tuỳ chọn',
    save: 'Lưu thay đổi',
    reset: 'Khôi phục',
    patient_settings_title: 'Cài đặt bệnh nhân',
    patient_settings_subtitle: 'Quản lý ngôn ngữ, thông báo và các thiết lập tài khoản cá nhân.',
    account_shortcuts: 'Lối tắt tài khoản',
    notification_settings: 'Thiết lập thông báo',
    language_settings: 'Ngôn ngữ giao diện',
    change_password: 'Đổi mật khẩu',
    edit_profile: 'Chỉnh sửa hồ sơ',
    close_menu: 'Đóng menu',
    layout_admin: 'Quản trị CardioGuard',
    layout_doctor: 'Không gian bác sĩ',
    layout_patient: 'Trang bệnh nhân',
    group_overview: 'Tổng quan',
    group_users: 'Quản lý người dùng',
    group_devices: 'Giám sát & Phần cứng',
    group_medical: 'Y tế & Báo cáo',
    group_system: 'Hệ thống & Cấu hình',
    group_overview_ai: 'Tổng quan & Trợ lý AI',
    group_clinical_mgmt: 'Quản lý & Lâm sàng',
    group_monitoring_reports: 'Giám sát & Báo cáo',
    group_communication: 'Giao tiếp',
    group_health_medical: 'Sức khỏe & Y tế',
    group_comm_notifs: 'Giao tiếp & Thông báo',
    group_account: 'Tài khoản cá nhân',
  },
  en: {
    logout: 'Log out',
    all_features: 'All features',
    more: 'More',
    theme_light: 'Switch to light mode',
    theme_dark: 'Switch to dark mode',
    language: 'Language',
    notifications: 'Notifications',
    security: 'Security',
    appearance: 'Appearance',
    preferences: 'Preferences',
    save: 'Save changes',
    reset: 'Reset',
    patient_settings_title: 'Patient Settings',
    patient_settings_subtitle: 'Manage language, notifications, and personal account preferences.',
    account_shortcuts: 'Account shortcuts',
    notification_settings: 'Notification settings',
    language_settings: 'Interface language',
    change_password: 'Change password',
    edit_profile: 'Edit profile',
    close_menu: 'Close menu',
    layout_admin: 'CardioGuard Admin',
    layout_doctor: 'Doctor Workspace',
    layout_patient: 'Patient Portal',
    group_overview: 'Overview',
    group_users: 'User Management',
    group_devices: 'Monitoring & Hardware',
    group_medical: 'Medical & Reports',
    group_system: 'System & Config',
    group_overview_ai: 'Overview & AI',
    group_clinical_mgmt: 'Clinical Management',
    group_monitoring_reports: 'Monitoring & Reports',
    group_communication: 'Communication',
    group_health_medical: 'Health & Medical',
    group_comm_notifs: 'Communication & Notifications',
    group_account: 'Personal Account',
  },
};

export const translateMenuLabel = (label: string, locale: Locale) => MENU_LABELS[locale][label] || label;
export const translateRoleLabel = (role: UserRole, locale: Locale) => ROLE_LABELS[locale][role];
export const translateCommonLabel = (key: string, locale: Locale) => COMMON_LABELS[locale][key] || key;
export const getPageMeta = (path: string, locale: Locale) => PAGE_META[locale][path] || PAGE_META.vi[path] || null;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const resolveInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'vi';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'vi' || saved === 'en') return saved;
  const browserLocale = window.navigator.language?.toLowerCase() || '';
  return browserLocale.startsWith('en') ? 'en' : 'vi';
};

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (key: string) => translateCommonLabel(key, locale),
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
