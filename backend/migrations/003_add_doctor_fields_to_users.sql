-- Thêm cột số điện thoại vào bảng users để lưu thông tin liên lạc của bác sĩ
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
-- Thêm cột chuyên khoa vào bảng users để lưu thông tin chuyên môn của bác sĩ
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;
-- Thêm cột khoa phòng ban vào bảng users để xác định vị trí công tác của bác sĩ
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
-- Thêm cột trạng thái hoạt động vào bảng users, mặc định là active đang hoạt động
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
