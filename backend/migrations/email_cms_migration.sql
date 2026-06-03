-- =============================================================================
-- CardioGuard AI — Migration cho Email CMS
-- Chạy tập lệnh này trong Supabase SQL Editor để tạo cấu trúc email
-- =============================================================================

-- -------------------------------------------------------
-- Bảng 1: email_templates — Lưu trữ các mẫu email dùng cho gửi thông báo
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Tên định danh của mẫu email
    name        TEXT        NOT NULL,
    -- Tiêu đề email
    subject     TEXT        NOT NULL,
    -- Nội dung HTML của email
    html_content TEXT       NOT NULL DEFAULT '',
    -- Nội dung văn bản thuần túy của email dùng cho email client không hỗ trợ HTML
    text_content TEXT       DEFAULT '',
    -- Loại mẫu email: custom tùy chỉnh hoặc các loại có sẵn
    type        TEXT        NOT NULL DEFAULT 'custom',
    -- Trạng thái kích hoạt của mẫu email, mặc định là TRUE đang hoạt động
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Thời điểm tạo mẫu email, mặc định là thời gian hiện tại
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Thời điểm cập nhật gần nhất, mặc định là thời gian hiện tại
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hàm trigger tự động cập nhật cột updated_at cho mọi bảng có cột updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Gán thời gian hiện tại cho cột updated_at trước khi lưu
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger kích hoạt trước khi cập nhật bảng email_templates để tự động cập nhật thời gian sửa đổi
CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- Bảng 2: email_logs — Lưu trữ lịch sử gửi email
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Khóa ngoại tham chiếu đến bảng email_templates, đặt NULL khi template bị xóa
    template_id     UUID        REFERENCES email_templates(id) ON DELETE SET NULL,
    -- Địa chỉ email người nhận
    receiver_email  TEXT        NOT NULL,
    -- Tiêu đề email đã gửi
    subject         TEXT        NOT NULL,
    -- Trạng thái gửi email: pending đang chờ, sent đã gửi, failed thất bại, scheduled đã lên lịch
    status          TEXT        NOT NULL DEFAULT 'pending',
    -- Thông báo lỗi nếu quá trình gửi thất bại
    error_message   TEXT,
    -- Thời điểm email được gửi thành công
    sent_at         TIMESTAMPTZ,
    -- Email của người quản trị đã thực hiện gửi
    created_by      TEXT,
    -- Thời điểm tạo bản ghi, mặc định là thời gian hiện tại
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo các chỉ mục để tìm kiếm và lọc nhanh dữ liệu trong bảng email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_status       ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_receiver     ON email_logs(receiver_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at   ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id  ON email_logs(template_id);

-- -------------------------------------------------------
-- Chèn dữ liệu mẫu: 3 mẫu template mặc định để kiểm thử chức năng email
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
