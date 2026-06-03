export type EmailFunctionGroupKey = 'auth' | 'account' | 'doctor_account' | 'appointment' | 'health' | 'report' | 'custom';
export type EmailTargetRole = 'patient' | 'doctor' | 'admin' | 'all';

export interface EmailFunctionOption {
  email_type: string;
  cms_email_id: string;
  name: string;
  group_key: EmailFunctionGroupKey;
  target_role: EmailTargetRole;
  description: string;
  required_variables: string[];
  optional_variables: string[];
  is_system: boolean;
  is_active: boolean;
}

export const SYSTEM_EMAIL_FUNCTIONS: EmailFunctionOption[] = [
  { email_type: 'otp_register', cms_email_id: 'EMAIL_OTP_REGISTER', name: 'OTP Đăng ký', group_key: 'auth', target_role: 'patient', description: 'Gửi OTP khi đăng ký tài khoản bệnh nhân.', required_variables: ['full_name', 'otp'], optional_variables: ['hospital_name', 'current_date'], is_system: true, is_active: true },
  { email_type: 'otp_login', cms_email_id: 'EMAIL_OTP_LOGIN', name: 'OTP Đăng nhập', group_key: 'auth', target_role: 'all', description: 'Gửi OTP khi đăng nhập.', required_variables: ['full_name', 'otp'], optional_variables: ['hospital_name', 'current_date'], is_system: true, is_active: true },
  { email_type: 'welcome', cms_email_id: 'EMAIL_WELCOME', name: 'Welcome Email', group_key: 'auth', target_role: 'all', description: 'Chào mừng tài khoản mới.', required_variables: ['full_name', 'role_label'], optional_variables: ['login_url', 'login_button_text'], is_system: true, is_active: true },
  { email_type: 'reset_password', cms_email_id: 'EMAIL_RESET_PASSWORD', name: 'Đặt lại mật khẩu', group_key: 'auth', target_role: 'all', description: 'Gửi mật khẩu tạm thời hoặc link đặt lại.', required_variables: ['full_name', 'otp'], optional_variables: [], is_system: true, is_active: true },
  { email_type: 'emergency_alert', cms_email_id: 'EMAIL_EMERGENCY_ALERT', name: 'Cảnh báo khẩn cấp', group_key: 'health', target_role: 'doctor', description: 'Cảnh báo chỉ số bất thường khẩn cấp.', required_variables: ['full_name', 'alert_message'], optional_variables: ['heart_rate', 'spo2'], is_system: true, is_active: true },
  { email_type: 'appointment_reminder', cms_email_id: 'EMAIL_APPOINTMENT_REMINDER', name: 'Nhắc lịch hẹn', group_key: 'appointment', target_role: 'all', description: 'Nhắc lịch tái khám.', required_variables: ['full_name', 'appointment_date'], optional_variables: ['doctor_name'], is_system: true, is_active: true },
  { email_type: 'doctor_assignment', cms_email_id: 'EMAIL_DOCTOR_ASSIGNMENT', name: 'Phân công bác sĩ', group_key: 'appointment', target_role: 'all', description: 'Thông báo bác sĩ phụ trách.', required_variables: ['full_name', 'doctor_name'], optional_variables: [], is_system: true, is_active: true },
  { email_type: 'health_alert', cms_email_id: 'EMAIL_HEALTH_ALERT', name: 'Cảnh báo sức khỏe', group_key: 'health', target_role: 'patient', description: 'Cảnh báo sức khỏe theo dõi định kỳ.', required_variables: ['full_name', 'alert_message'], optional_variables: [], is_system: true, is_active: true },
  { email_type: 'monthly_report', cms_email_id: 'EMAIL_MONTHLY_REPORT', name: 'Báo cáo tháng', group_key: 'report', target_role: 'all', description: 'Báo cáo sức khỏe tháng.', required_variables: ['full_name', 'current_date'], optional_variables: [], is_system: true, is_active: true },
];

export const CUSTOM_TEMPLATE_HINTS = [
  'Bác sĩ cần bổ sung hồ sơ',
  'Bác sĩ đã được xác thực',
  'Bác sĩ bị từ chối xác thực',
  'Tài khoản bệnh nhân bị khóa',
  'Tài khoản được kích hoạt lại',
];

export const EMAIL_TEMPLATE_LABEL_MAP: Record<string, string> = {
  otp_register: 'OTP Đăng ký',
  otp_login: 'OTP Đăng nhập',
  welcome: 'Welcome Email',
  reset_password: 'Đặt lại mật khẩu',
  emergency_alert: 'Cảnh báo khẩn cấp',
  appointment_reminder: 'Nhắc lịch hẹn',
  doctor_assignment: 'Phân công bác sĩ',
  health_alert: 'Cảnh báo sức khỏe',
  monthly_report: 'Báo cáo tháng',
  doctor_pending_verification: 'Bác sĩ chờ duyệt',
  doctor_verified: 'Bác sĩ đã xác thực',
  doctor_rejected: 'Bác sĩ bị từ chối',
  doctor_need_update: 'Bác sĩ cần bổ sung',
  doctor_verified_success: 'Bác sĩ đã được xác thực',
  doctor_verified_rejected: 'Bác sĩ bị từ chối xác thực',
  doctor_profile_require_update: 'Bác sĩ cần bổ sung hồ sơ',
};

export const EMAIL_GROUP_LABEL_MAP: Record<EmailFunctionGroupKey, string> = {
  auth: 'Nhóm hệ thống: Đăng nhập / đăng ký',
  account: 'Nhóm hệ thống: Tài khoản',
  doctor_account: 'Nhóm tùy chỉnh: Bác sĩ',
  appointment: 'Nhóm hệ thống: Lịch hẹn',
  health: 'Nhóm hệ thống: Sức khỏe',
  report: 'Nhóm hệ thống: Báo cáo',
  custom: 'Nhóm tùy chỉnh',
};

export const EMAIL_TARGET_ROLE_LABEL_MAP: Record<EmailTargetRole, string> = {
  patient: 'Bệnh nhân',
  doctor: 'Bác sĩ',
  admin: 'Admin',
  all: 'Tất cả',
};

export const normalizeCmsEmailId = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const normalizeEmailType = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const suggestCmsEmailId = (emailType: string) => {
  const found = SYSTEM_EMAIL_FUNCTIONS.find((item) => item.email_type === emailType);
  return found?.cms_email_id || '';
};

export const parseVariablesList = (value: string) =>
  value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

export const buildGroupedEmailFunctionOptions = (customFunctions: EmailFunctionOption[] = []) => {
  const groups: Record<string, EmailFunctionOption[]> = {
    auth: [],
    account: [],
    doctor_account: [],
    appointment: [],
    health: [],
    report: [],
    custom: [],
  };

  [...SYSTEM_EMAIL_FUNCTIONS, ...customFunctions].forEach((item) => {
    const key = item.group_key || 'custom';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return groups;
};
