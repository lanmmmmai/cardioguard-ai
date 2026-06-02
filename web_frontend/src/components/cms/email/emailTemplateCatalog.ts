export const EMAIL_TEMPLATE_OPTIONS = [
  { value: 'otp_register', label: 'OTP Đăng ký', cmsEmailId: 'EMAIL_OTP_REGISTER' },
  { value: 'otp_login', label: 'OTP Đăng nhập', cmsEmailId: 'EMAIL_OTP_LOGIN' },
  { value: 'welcome', label: 'Welcome Email', cmsEmailId: 'EMAIL_WELCOME' },
  { value: 'reset_password', label: 'Đặt lại mật khẩu', cmsEmailId: 'EMAIL_RESET_PASSWORD' },
  { value: 'emergency_alert', label: 'Cảnh báo khẩn cấp', cmsEmailId: 'EMAIL_EMERGENCY_ALERT' },
  { value: 'appointment_reminder', label: 'Nhắc lịch hẹn', cmsEmailId: 'EMAIL_APPOINTMENT_REMINDER' },
  { value: 'doctor_assignment', label: 'Phân công bác sĩ', cmsEmailId: 'EMAIL_DOCTOR_ASSIGNMENT' },
  { value: 'health_alert', label: 'Cảnh báo sức khỏe', cmsEmailId: 'EMAIL_HEALTH_ALERT' },
  { value: 'monthly_report', label: 'Báo cáo tháng', cmsEmailId: 'EMAIL_MONTHLY_REPORT' },
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_OPTIONS)[number]['value'];

export const EMAIL_TEMPLATE_LABEL_MAP: Record<string, string> = EMAIL_TEMPLATE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const EMAIL_TEMPLATE_CMS_ID_MAP: Record<string, string> = EMAIL_TEMPLATE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.cmsEmailId;
    return acc;
  },
  {} as Record<string, string>,
);

export const normalizeCmsEmailId = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const suggestCmsEmailId = (emailType: string) => EMAIL_TEMPLATE_CMS_ID_MAP[emailType] || '';

export const parseVariablesList = (value: string) =>
  value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
