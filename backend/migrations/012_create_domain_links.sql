-- =============================================================================
-- CardioGuard AI — Migration tạo bảng domain_links để lưu trữ liên kết tên miền
-- =============================================================================

-- Tạo bảng domain_links để lưu trữ các liên kết tên miền cho tính năng chia sẻ và xem trước liên kết
CREATE TABLE IF NOT EXISTS domain_links (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Đường dẫn URL đầy đủ của liên kết
    url         TEXT        NOT NULL,
    -- Tên miền được trích xuất từ URL
    domain      TEXT        NOT NULL DEFAULT '',
    -- Tiêu đề của trang liên kết
    title       TEXT        NOT NULL DEFAULT '',
    -- Mô tả nội dung của trang liên kết
    description TEXT        NOT NULL DEFAULT '',
    -- Đường dẫn đến ảnh xem trước của liên kết
    image_url   TEXT        NOT NULL DEFAULT '',
    -- Thời điểm tạo bản ghi, mặc định là thời gian hiện tại
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Thời điểm cập nhật gần nhất, mặc định là thời gian hiện tại
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hàm trigger tự động cập nhật cột updated_at mỗi khi bản ghi trong bảng domain_links được sửa đổi
CREATE OR REPLACE FUNCTION update_domain_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Gán thời gian hiện tại cho cột updated_at trước khi lưu
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger kích hoạt trước khi cập nhật bảng domain_links để tự động cập nhật thời gian sửa đổi
CREATE TRIGGER trg_domain_links_updated_at
    BEFORE UPDATE ON domain_links
    FOR EACH ROW EXECUTE FUNCTION update_domain_links_updated_at();

-- Chèn dữ liệu mẫu cho tên miền giatky.site để hiển thị thông tin xem trước liên kết
INSERT INTO domain_links (url, domain, title, description, image_url)
VALUES (
    'https://giatky.site/login',
    'giatky.site',
    'CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực',
    'CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.',
    'https://giatky.site/images/preview.jpg'
)
-- Bỏ qua nếu bản ghi đã tồn tại để tránh lỗi trùng lặp dữ liệu
ON CONFLICT DO NOTHING;
