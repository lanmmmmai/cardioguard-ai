-- Tạo bảng auth_otp_tokens để lưu trữ mã OTP dùng cho xác thực người dùng đăng ký và quên mật khẩu
CREATE TABLE IF NOT EXISTS auth_otp_tokens (
    id           UUID        PRIMARY KEY,
    -- Mục đích sử dụng OTP: register đăng ký hoặc forgot_password quên mật khẩu
    purpose      TEXT        NOT NULL CHECK (purpose IN ('register', 'forgot_password')),
    -- Địa chỉ email của người dùng yêu cầu OTP
    email        TEXT        NOT NULL,
    -- Mã băm của OTP để bảo mật, không lưu OTP dạng văn bản thuần túy
    otp_hash     TEXT        NOT NULL,
    -- Dữ liệu mở rộng dạng JSONB chứa thông tin bổ sung, mặc định là đối tượng rỗng
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- Số lần thử nghiệm đã thực hiện
    attempts     INTEGER     NOT NULL DEFAULT 0,
    -- Số lần thử tối đa cho phép, mặc định là 5 lần
    max_attempts INTEGER     NOT NULL DEFAULT 5,
    -- Thời điểm hết hạn của OTP, sau thời gian này OTP không còn hiệu lực
    expires_at   TIMESTAMPTZ NOT NULL,
    -- Thời điểm OTP đã được sử dụng, NULL nếu chưa được dùng
    consumed_at  TIMESTAMPTZ,
    -- Thời điểm tạo bản ghi OTP, mặc định là thời gian hiện tại
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục cho phép tra cứu nhanh OTP theo mục đích, email, trạng thái sử dụng và thời gian tạo
CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_lookup
    ON auth_otp_tokens (purpose, email, consumed_at, created_at DESC);

-- Tạo chỉ mục trên cột expires_at để dễ dàng xóa các OTP đã hết hạn
CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_expires_at
    ON auth_otp_tokens (expires_at);
