-- Thêm cột user_id vào bảng patients để liên kết mỗi bệnh nhân với tài khoản người dùng tương ứng
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Tạo chỉ mục trên cột user_id để tăng tốc độ truy vấn dữ liệu bệnh nhân theo người dùng
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
