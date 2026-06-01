-- Migration 009: Tối ưu hóa hiệu năng nâng cao cho cơ sở dữ liệu CardioGuard AI

-- 1. Kích hoạt extension pg_stat_statements phục vụ chẩn đoán hiệu năng câu lệnh
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. Thiết lập Composite Index cho bảng chat_messages (tối ưu hóa lọc luồng tin nhắn và thời gian)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time 
ON chat_messages (session_id, created_at DESC);

-- 3. Thiết lập Partial Index (Index một phần) cho bảng alerts (tối ưu hóa lọc các cảnh báo nguy kịch chưa xử lý)
CREATE INDEX IF NOT EXISTS idx_active_critical_alerts 
ON alerts (patient_id) 
WHERE is_resolved = false AND severity = 'critical';

-- 4. Thiết lập BRIN Index cho cột created_at của bảng nhật ký audit_logs khổng lồ (tiết kiệm 99% RAM so với B-Tree)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin 
ON audit_logs USING brin (created_at);

-- 5. Thiết lập Materialized View cho báo cáo thống kê reports
CREATE MATERIALIZED VIEW IF NOT EXISTS reports_summary_mv AS
SELECT report_type, COUNT(*)::int AS total
FROM reports
GROUP BY report_type;

-- 6. Tạo Unique Index trên Materialized View (Bắt buộc để hỗ trợ REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_summary_mv_type 
ON reports_summary_mv (report_type);

-- 7. Viết hàm Trigger tự động cập nhật Materialized View khi bảng reports thay đổi dữ liệu
CREATE OR REPLACE FUNCTION refresh_reports_summary_mv()
RETURNS TRIGGER AS $$
BEGIN
    -- Làm mới Materialized View phi tuần tự để tránh khóa bảng
    REFRESH MATERIALIZED VIEW CONCURRENTLY reports_summary_mv;
    RETURN NULL;
EXCEPTION
    -- Tránh làm treo luồng ghi nếu có lỗi xảy ra
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Tạo Trigger kích hoạt sau khi bảng reports có bất kỳ thay đổi INSERT/UPDATE/DELETE/TRUNCATE nào
DROP TRIGGER IF EXISTS trg_refresh_reports_summary_mv ON reports;
CREATE TRIGGER trg_refresh_reports_summary_mv
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_reports_summary_mv();
