-- Migration 008: Tạo các chỉ mục chiến lược nhằm tối ưu hóa hiệu năng truy vấn cho cơ sở dữ liệu Supabase PostgreSQL

-- 1. Bảng sensor_data dữ liệu IoT từ cảm biến y tế
-- Tối ưu hóa tốc độ truy vấn biểu đồ dữ liệu thời gian thực cho từng bệnh nhân, sắp xếp theo thời gian tạo giảm dần
CREATE INDEX IF NOT EXISTS idx_sensor_data_patient_created_at ON sensor_data (patient_id, created_at DESC);

-- 2. Bảng appointments lịch hẹn khám bệnh
-- Tạo chỉ mục cho cột patient_id để tìm nhanh lịch hẹn theo bệnh nhân
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
-- Tạo chỉ mục cho cột doctor_id để tìm nhanh lịch hẹn theo bác sĩ
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments (doctor_id);

-- 3. Bảng medical_records hồ sơ bệnh án điện tử
-- Tạo chỉ mục cho cột patient_id để tra cứu hồ sơ bệnh án theo bệnh nhân
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records (patient_id);
-- Tạo chỉ mục cho cột doctor_id để tra cứu hồ sơ bệnh án theo bác sĩ điều trị
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id ON medical_records (doctor_id);

-- 4. Bảng prescriptions đơn thuốc
-- Tạo chỉ mục cho cột patient_id để tìm đơn thuốc theo bệnh nhân
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions (patient_id);
-- Tạo chỉ mục cho cột doctor_id để tìm đơn thuốc theo bác sĩ kê đơn
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions (doctor_id);

-- 5. Bảng devices thiết bị đeo thông minh
-- Tạo chỉ mục cho cột patient_id để truy vấn thiết bị theo bệnh nhân sở hữu
CREATE INDEX IF NOT EXISTS idx_devices_patient_id ON devices (patient_id);

-- 6. Bảng reports báo cáo lâm sàng và điện tâm đồ
-- Tạo chỉ mục cho cột user_id để tra cứu báo cáo theo người dùng
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports (user_id);

-- 7. Bảng chat_messages nhật ký tin nhắn hội thoại
-- Tạo chỉ mục cho cột session_id để truy vấn nhanh tin nhắn theo phiên hội thoại
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);

-- 8. Bảng audit_logs nhật ký hoạt động hệ thống
-- Tạo chỉ mục cho cột user_id để tra cứu nhật ký theo người dùng
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);

-- 9. Bảng cameras camera giám sát ICU
-- Tạo chỉ mục cho cột assigned_patient_id để truy vấn camera theo bệnh nhân được chỉ định
CREATE INDEX IF NOT EXISTS idx_cameras_assigned_patient_id ON cameras (assigned_patient_id);
