-- Migration 022: Thêm DB-level constraints, cột đo từ xa IoT và tối ưu hóa Indexes.

-- Dọn dẹp dữ liệu lỗi cũ vi phạm ràng buộc trước khi thêm check constraints
DELETE FROM sensor_data WHERE heart_rate < 0.0 OR heart_rate > 300.0 OR spo2 < 0.0 OR spo2 > 100.0;

-- 1. Thêm các cột bổ sung cho sensor_data phục vụ đo từ xa IoT
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS body_temperature DECIMAL(4,1);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS motion_value DECIMAL(8,2);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id);

-- 2. Thêm các ràng buộc (Constraints) bảo vệ toàn vẹn dữ liệu ở tầng Database
ALTER TABLE sensor_data ADD CONSTRAINT chk_heart_rate CHECK (heart_rate >= 0.0 AND heart_rate <= 300.0);
ALTER TABLE sensor_data ADD CONSTRAINT chk_spo2 CHECK (spo2 >= 0.0 AND spo2 <= 100.0);
ALTER TABLE sensor_data ADD CONSTRAINT chk_bp CHECK (systolic_bp >= diastolic_bp OR systolic_bp IS NULL OR diastolic_bp IS NULL);

-- 3. Tạo các chỉ mục (Indexes) tối ưu hiệu năng truy vấn
-- Tối ưu truy vấn dữ liệu sensor thời gian thực cho bệnh nhân
CREATE INDEX IF NOT EXISTS idx_sensor_data_patient_time 
ON sensor_data(patient_id, created_at DESC);

-- Tối ưu truy vấn danh sách cảnh báo theo độ nghiêm trọng của bệnh nhân
CREATE INDEX IF NOT EXISTS idx_alerts_patient_severity 
ON alerts(patient_id, severity, created_at DESC);

-- Tối ưu tìm kiếm nhanh thiết bị đang trực tuyến
CREATE INDEX IF NOT EXISTS idx_devices_online 
ON devices(patient_id) WHERE status = 'online';

-- Tối ưu hóa truy vấn dọn dẹp mã OTP đã hết hạn và chưa được sử dụng
CREATE INDEX IF NOT EXISTS idx_otp_expires 
ON auth_otp_tokens(expires_at) WHERE consumed_at IS NULL;
