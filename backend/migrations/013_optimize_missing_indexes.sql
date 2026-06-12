-- ============================================================
-- Migration 013: Tối ưu hiệu năng - Bổ sung các index còn thiếu
-- ============================================================
-- Mục đích: Bổ sung các index quan trọng bị thiếu nhằm tăng tốc
-- các truy vấn thường gặp, đặc biệt khi ứng dụng chạy online
-- trên Supabase.
-- ============================================================

-- 1. Index cho bảng doctor_patient (dùng trong EXISTS subquery ở hầu hết API)
--    Các truy vấn kiểm tra quyền truy cập bác sĩ-bệnh nhân cần index này
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doctor_patient_doctor_id
    ON doctor_patient(doctor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doctor_patient_patient_id
    ON doctor_patient(patient_id);

-- 2. Index cho bảng users(email) - tăng tốc đăng nhập và tìm kiếm email
DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
    ON users(email);

-- 3. Index cho bảng users(role, status) - tăng tốc lọc danh sách người dùng theo vai trò
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status
    ON users(role, status);

-- 4. Index cho bảng alerts(patient_id) - tăng tốc truy vấn cảnh báo theo bệnh nhân
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_patient_id
    ON alerts(patient_id);

-- 5. Index composite cho chatbot_messages - tối ưu truy vấn lịch sử chat
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chatbot_messages_session_time
    ON chatbot_messages(session_id, created_at DESC);

-- 6. Index cho sensor_data(created_at DESC) - tăng tốc truy vấn dữ liệu cảm biến theo thời gian
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_created_at
    ON sensor_data(created_at DESC);

-- 7. Index composite cho reports khi truy vấn tổng hợp theo user và loại
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_user_type
    ON reports(user_id, report_type);

-- 8. Index cho ai_recommendations để tăng tốc truy vấn khuyến nghị chưa giải quyết
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_recommendations_unresolved
    ON ai_recommendations(patient_id, is_resolved)
    WHERE is_resolved = FALSE;
