-- Thêm cột must_change_password vào bảng users để yêu cầu người dùng đổi mật khẩu khi đăng nhập lần đầu, mặc định là FALSE
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
