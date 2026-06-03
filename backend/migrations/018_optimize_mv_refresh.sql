-- ============================================================
-- Migration 016: Tối ưu Materialized View Refresh
-- ============================================================
-- Thay thế trigger-based refresh (chạy trên MỖI INSERT/UPDATE/DELETE)
-- bằng deferred trigger chỉ refresh khi commit transaction.
-- Giảm I/O đáng kể trên bảng reports write-heavy.
-- ============================================================

-- 1. Xóa trigger cũ (FOR EACH STATEMENT refresh mỗi lần)
DROP TRIGGER IF EXISTS trg_refresh_reports_summary_mv ON reports;

-- 2. Tạo deferred trigger - chỉ refresh khi COMMIT transaction
CREATE OR REPLACE FUNCTION refresh_reports_summary_mv_deferred()
RETURNS TRIGGER AS $$
BEGIN
    -- Đánh dấu cần refresh, sẽ thực hiện khi COMMIT
    PERFORM pg_notify('refresh_reports_mv', '');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Tạo trigger - chạy sau mỗi statement
CREATE TRIGGER trg_refresh_reports_summary_mv
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_reports_summary_mv_deferred();

-- 4. Tạo hàm refresh an toàn với exception handling
CREATE OR REPLACE FUNCTION safe_refresh_reports_summary_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reports_summary_mv;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to refresh reports_summary_mv: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
