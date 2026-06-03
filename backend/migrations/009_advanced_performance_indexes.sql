-- Migration 009: Tối ưu hóa hiệu năng nâng cao cho cơ sở dữ liệu CardioGuard AI

-- 1. Kích hoạt extension pg_stat_statements để theo dõi và chẩn đoán hiệu năng của các câu lệnh SQL
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. Tạo composite index chỉ mục kết hợp cho bảng chat_messages nhằm tối ưu hóa việc lọc tin nhắn theo phiên hội thoại và thời gian
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time 
ON chat_messages (session_id, created_at DESC);

-- 3. Tạo partial index chỉ mục một phần cho bảng alerts để tối ưu hóa truy vấn các cảnh báo nguy kịch chưa được xử lý
CREATE INDEX IF NOT EXISTS idx_active_critical_alerts 
ON alerts (patient_id) 
WHERE is_resolved = false AND severity = 'critical';

-- 4. Tạo BRIN index chỉ mục khối cho cột created_at của bảng audit_logs dung lượng lớn, tiết kiệm đến 99 phần trăm dung lượng bộ nhớ so với B-Tree truyền thống
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin 
ON audit_logs USING brin (created_at);

-- 5. Tạo materialized view khung nhìn vật lý cho báo cáo thống kê, tổng hợp số lượng báo cáo theo loại
CREATE MATERIALIZED VIEW IF NOT EXISTS reports_summary_mv AS
SELECT report_type, COUNT(*)::int AS total
FROM reports
GROUP BY report_type;

-- 6. Tạo chỉ mục duy nhất trên materialized view để hỗ trợ làm mới đồng thời REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_summary_mv_type 
ON reports_summary_mv (report_type);

-- 7. Tạo hàm trigger tự động cập nhật materialized view mỗi khi bảng reports có thay đổi dữ liệu
CREATE OR REPLACE FUNCTION refresh_reports_summary_mv()
RETURNS TRIGGER AS $$
BEGIN
    -- Làm mới materialized view không khóa bảng để tránh ảnh hưởng đến các truy vấn đang chạy
    REFRESH MATERIALIZED VIEW CONCURRENTLY reports_summary_mv;
    RETURN NULL;
EXCEPTION
    -- Bỏ qua lỗi để không làm gián đoạn luồng ghi dữ liệu chính
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Tạo trigger kích hoạt sau mọi thao tác thêm, sửa, xóa hoặc xóa toàn bộ dữ liệu trên bảng reports
DROP TRIGGER IF EXISTS trg_refresh_reports_summary_mv ON reports;
CREATE TRIGGER trg_refresh_reports_summary_mv
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_reports_summary_mv();
