-- Migration 008: Tạo Indexes chiến lược tối ưu hóa hiệu năng truy vấn cho Supabase PostgreSQL DB

-- 1. Bảng sensor_data (Dữ liệu IoT cảm biến y tế)
-- Tối ưu hóa tối đa tốc độ truy vấn biểu đồ thời gian thực của bệnh nhân
CREATE INDEX IF NOT EXISTS idx_sensor_data_patient_created_at ON sensor_data (patient_id, created_at DESC);

-- 2. Bảng appointments (Lịch hẹn lâm sàng)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments (doctor_id);

-- 3. Bảng medical_records (Bệnh án điện tử)
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id ON medical_records (doctor_id);

-- 4. Bảng prescriptions (Đơn thuốc)
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions (doctor_id);

-- 5. Bảng devices (Thiết bị wearable)
CREATE INDEX IF NOT EXISTS idx_devices_patient_id ON devices (patient_id);

-- 6. Bảng reports (Báo cáo lâm sàng/ECG)
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports (user_id);

-- 7. Bảng chat_messages (Nhật ký tin nhắn)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);

-- 8. Bảng audit_logs (Nhật ký hệ thống)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);

-- 9. Bảng cameras (Camera giám sát ICU)
CREATE INDEX IF NOT EXISTS idx_cameras_assigned_patient_id ON cameras (assigned_patient_id);
