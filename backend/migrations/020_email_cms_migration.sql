-- CardioGuard AI — Email CMS Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cms_email_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_type TEXT NOT NULL UNIQUE,
    cms_email_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    group_key TEXT NOT NULL DEFAULT 'custom',
    target_role TEXT NOT NULL DEFAULT 'all',
    description TEXT NOT NULL DEFAULT '',
    required_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    optional_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_email_functions_group_role
ON cms_email_functions(group_key, target_role, is_active DESC);

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id UUID REFERENCES cms_email_functions(id) ON DELETE SET NULL,
    cms_email_id TEXT NOT NULL,
    email_type TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'all',
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL DEFAULT '',
    text_content TEXT DEFAULT '',
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    sample_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    type TEXT NOT NULL DEFAULT 'otp_register',
    deleted_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_cms_email_id ON email_templates(cms_email_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_email_type_active ON email_templates(email_type, is_active DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_function_id ON email_templates(function_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_target_role ON email_templates(target_role);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_functions_updated_at ON cms_email_functions;
CREATE TRIGGER trg_email_functions_updated_at
    BEFORE UPDATE ON cms_email_functions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    receiver_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_receiver ON email_logs(receiver_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id ON email_logs(template_id);

INSERT INTO cms_email_functions (
    email_type, cms_email_id, name, group_key, target_role, description,
    required_variables, optional_variables, is_system, is_active
) VALUES
('otp_register', 'EMAIL_OTP_REGISTER', 'OTP Đăng ký', 'auth', 'patient', 'Gửi OTP khi đăng ký tài khoản bệnh nhân.', '["full_name","otp"]'::jsonb, '["hospital_name","current_date"]'::jsonb, TRUE, TRUE),
('otp_login', 'EMAIL_OTP_LOGIN', 'OTP Đăng nhập', 'auth', 'all', 'Gửi OTP khi đăng nhập.', '["full_name","otp"]'::jsonb, '["hospital_name","current_date"]'::jsonb, TRUE, TRUE),
('welcome', 'EMAIL_WELCOME', 'Welcome Email', 'auth', 'all', 'Chào mừng tài khoản mới.', '["full_name","role_label"]'::jsonb, '["login_url","login_button_text"]'::jsonb, TRUE, TRUE),
('reset_password', 'EMAIL_RESET_PASSWORD', 'Đặt lại mật khẩu', 'auth', 'all', 'Gửi mật khẩu tạm thời hoặc link đặt lại.', '["full_name","otp"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('emergency_alert', 'EMAIL_EMERGENCY_ALERT', 'Cảnh báo khẩn cấp', 'health', 'doctor', 'Cảnh báo chỉ số bất thường khẩn cấp.', '["full_name","alert_message"]'::jsonb, '["heart_rate","spo2"]'::jsonb, TRUE, TRUE),
('appointment_reminder', 'EMAIL_APPOINTMENT_REMINDER', 'Nhắc lịch hẹn', 'appointment', 'all', 'Nhắc lịch tái khám.', '["full_name","appointment_date"]'::jsonb, '["doctor_name"]'::jsonb, TRUE, TRUE),
('doctor_assignment', 'EMAIL_DOCTOR_ASSIGNMENT', 'Phân công bác sĩ', 'appointment', 'all', 'Thông báo bác sĩ phụ trách.', '["full_name","doctor_name"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('health_alert', 'EMAIL_HEALTH_ALERT', 'Cảnh báo sức khỏe', 'health', 'patient', 'Cảnh báo sức khỏe theo dõi định kỳ.', '["full_name","alert_message"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('monthly_report', 'EMAIL_MONTHLY_REPORT', 'Báo cáo tháng', 'report', 'all', 'Báo cáo sức khỏe tháng.', '["full_name","current_date"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('doctor_pending_verification', 'EMAIL_DOCTOR_PENDING_VERIFICATION', 'Bác sĩ chờ duyệt', 'account', 'doctor', 'Thông báo hồ sơ đang chờ xác thực.', '["full_name"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('doctor_verified', 'EMAIL_DOCTOR_VERIFIED', 'Bác sĩ đã xác thực', 'account', 'doctor', 'Thông báo hồ sơ bác sĩ đã được xác thực.', '["full_name"]'::jsonb, '["login_url","login_button_text"]'::jsonb, TRUE, TRUE),
('doctor_rejected', 'EMAIL_DOCTOR_REJECTED', 'Bác sĩ bị từ chối', 'account', 'doctor', 'Thông báo hồ sơ bị từ chối.', '["full_name","verification_note"]'::jsonb, '[]'::jsonb, TRUE, TRUE),
('doctor_need_update', 'EMAIL_DOCTOR_NEED_UPDATE', 'Bác sĩ cần bổ sung hồ sơ', 'doctor_account', 'doctor', 'Yêu cầu bổ sung hồ sơ bác sĩ.', '["full_name","verification_note"]'::jsonb, '["update_profile_url","support_email"]'::jsonb, TRUE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (
    function_id, target_role, cms_email_id, email_type, name, subject, html_content, text_content, variables, type, is_active
) VALUES
(
    (SELECT id FROM cms_email_functions WHERE email_type = 'otp_register' LIMIT 1),
    'patient',
    'EMAIL_OTP_REGISTER',
    'otp_register',
    'OTP Đăng ký',
    'CardioGuard AI - Mã OTP đăng ký của bạn',
    '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px"><h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2><p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p><p style="color:#374151">Mã OTP đăng ký tài khoản của bạn là:</p><div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#e11d48">{{otp}}</div><p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/><p style="color:#9ca3af;font-size:12px">CardioGuard AI — {{hospital_name}}</p></div>',
    'Xin chào {{full_name}}, mã OTP đăng ký của bạn là {{otp}}.',
    '["full_name","otp","hospital_name","current_date"]'::jsonb,
    'otp_register',
    TRUE
),
(
    (SELECT id FROM cms_email_functions WHERE email_type = 'doctor_profile_require_update' LIMIT 1),
    'doctor',
    'EMAIL_DOCTOR_NEED_UPDATE',
    'doctor_profile_require_update',
    'Bác sĩ cần bổ sung hồ sơ',
    'CardioGuard AI - Yêu cầu bổ sung hồ sơ bác sĩ',
    '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px"><h2 style="color:#d97706;margin-bottom:8px">CardioGuard AI</h2><p style="color:#374151">Xin chào Bác sĩ <strong>{{full_name}}</strong>,</p><p style="color:#374151">Hồ sơ bác sĩ cần bổ sung thông tin.</p><p style="color:#374151;padding:12px;background-color:#fffbeb;border-left:4px solid #f59e0b;margin:16px 0"><strong>Nội dung cần bổ sung:</strong> {{verification_note}}</p></div>',
    'Xin chào {{full_name}}, vui lòng cập nhật hồ sơ: {{verification_note}}.',
    '["full_name","verification_note","update_profile_url","support_email"]'::jsonb,
    'doctor_profile_require_update',
    TRUE
)
ON CONFLICT DO NOTHING;
