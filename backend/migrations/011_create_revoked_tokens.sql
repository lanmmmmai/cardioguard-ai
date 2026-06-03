-- Tạo bảng revoked_tokens để lưu trữ các token đã bị thu hồi nhằm ngăn chặn sử dụng lại
CREATE TABLE IF NOT EXISTS revoked_tokens (
    -- Mã định danh duy nhất của JWT, JTI, dùng làm khóa chính
    jti VARCHAR(36) PRIMARY KEY,
    -- Thời điểm hết hạn của token bị thu hồi, dùng để dọn dẹp các bản ghi cũ
    expires_at TIMESTAMPTZ NOT NULL
);

-- Tạo chỉ mục trên cột expires_at để dễ dàng xóa các token thu hồi đã hết hạn
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
