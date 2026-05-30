-- =============================================================================
-- CardioGuard AI — Email CMS Migration
-- Chạy script này trong Supabase SQL Editor
-- =============================================================================

-- -------------------------------------------------------
-- Bảng 1: email_templates — Lưu mẫu email
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    subject     TEXT        NOT NULL,
    html_content TEXT       NOT NULL DEFAULT '',
    text_content TEXT       DEFAULT '',
    type        TEXT        NOT NULL DEFAULT 'custom',
    -- Loại template: otp_register | otp_login | welcome | password_reset |
    --                alert_critical | appointment_reminder | doctor_assigned |
    --                health_warning | monthly_report | custom
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- Bảng 2: email_logs — Lịch sử gửi email
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID        REFERENCES email_templates(id) ON DELETE SET NULL,
    receiver_email  TEXT        NOT NULL,
    subject         TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending',
    -- Status: pending | sent | failed | scheduled
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    created_by      TEXT,       -- email của admin đã gửi
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_email_logs_status       ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_receiver     ON email_logs(receiver_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at   ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id  ON email_logs(template_id);

-- -------------------------------------------------------
-- Seed: 3 mẫu template mặc định để test
-- -------------------------------------------------------
INSERT INTO email_templates (name, subject, html_content, type, is_active) VALUES
(
    'OTP Đăng Ký',
    'CardioGuard AI - Mã OTP đăng ký của bạn',
    '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151">Mã OTP đăng ký tài khoản của bạn là:</p>
  <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#e11d48">{{otp}}</div>
  <p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {{hospital_name}}</p>
</div>',
    'otp_register',
    TRUE
),
(
    'Đặt Lại Mật Khẩu',
    'CardioGuard AI - Mật khẩu mới của bạn',
    '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151">Mật khẩu tạm thời của bạn là:</p>
  <div style="font-size:24px;font-weight:700;text-align:center;padding:24px 0;color:#e11d48;letter-spacing:4px">{{otp}}</div>
  <p style="color:#6b7280;font-size:13px">Vui lòng đăng nhập và đổi mật khẩu ngay sau khi đăng nhập thành công.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">{{current_date}} — CardioGuard AI</p>
</div>',
    'password_reset',
    TRUE
),
(
    'Cảnh Báo Sức Khỏe Khẩn Cấp',
    'CardioGuard AI - CẢNH BÁO: Chỉ số bất thường',
    '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:2px solid #e11d48;border-radius:12px">
  <h2 style="color:#e11d48;margin-bottom:8px">⚠️ CẢNH BÁO SỨC KHỎE</h2>
  <p style="color:#374151">Bệnh nhân <strong>{{full_name}}</strong> có chỉ số bất thường:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Nhịp tim</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#e11d48">{{heart_rate}} bpm</td></tr>
    <tr><td style="padding:8px;color:#6b7280">SpO2</td><td style="padding:8px;font-weight:bold;color:#e11d48">{{spo2}}%</td></tr>
  </table>
  <p style="color:#374151;padding:12px;background:#fef2f2;border-radius:8px;font-size:14px"><strong>Thông báo:</strong> {{alert_message}}</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:16px">Bác sĩ: {{doctor_name}} — {{current_date}}</p>
</div>',
    'alert_critical',
    TRUE
)
ON CONFLICT DO NOTHING;
