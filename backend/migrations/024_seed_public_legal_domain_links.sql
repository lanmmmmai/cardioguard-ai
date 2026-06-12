-- =============================================================================
-- CardioGuard AI — Seed public legal domain links
--
-- Purpose:
--   Add SEO/Open Graph preview records for the public footer links used on
--   authentication screens: about, privacy policy, terms of service, and data
--   deletion request.
-- =============================================================================

WITH public_legal_links(path, url, domain, title, description, image_url) AS (
    VALUES
        (
            '/gioi-thieu',
            'https://giatky.site/gioi-thieu',
            'giatky.site',
            'CardioGuard AI - Giới thiệu',
            'Tìm hiểu về nền tảng CardioGuard AI, hệ thống giám sát tim mạch, SpO2, huyết áp và cảnh báo lâm sàng thời gian thực.',
            'https://giatky.site/og-about.png'
        ),
        (
            '/chinh-sach-bao-mat',
            'https://giatky.site/chinh-sach-bao-mat',
            'giatky.site',
            'CardioGuard AI - Chính sách bảo mật',
            'Chính sách bảo mật dữ liệu cá nhân và dữ liệu sức khỏe của bệnh nhân, bác sĩ và quản trị viên trên CardioGuard AI.',
            'https://giatky.site/og-privacy.png'
        ),
        (
            '/dieu-khoan-dich-vu',
            'https://giatky.site/dieu-khoan-dich-vu',
            'giatky.site',
            'CardioGuard AI - Điều khoản dịch vụ',
            'Điều khoản sử dụng nền tảng CardioGuard AI, bao gồm trách nhiệm tài khoản, cảnh báo y tế tham khảo và quy định truy cập.',
            'https://giatky.site/og-terms.png'
        ),
        (
            '/yeu-cau-xoa-du-lieu',
            'https://giatky.site/yeu-cau-xoa-du-lieu',
            'giatky.site',
            'CardioGuard AI - Yêu cầu xóa dữ liệu',
            'Hướng dẫn gửi yêu cầu xóa tài khoản, dữ liệu cá nhân và dữ liệu liên quan theo quy trình bảo mật của CardioGuard AI.',
            'https://giatky.site/og-data-deletion.png'
        )
)
INSERT INTO domain_links (path, url, domain, title, description, image_url, is_active, cache_version)
SELECT path, url, domain, title, description, image_url, TRUE, 1
FROM public_legal_links
ON CONFLICT ((LOWER(path))) WHERE deleted_at IS NULL AND BTRIM(path) <> ''
DO UPDATE SET
    url = EXCLUDED.url,
    domain = EXCLUDED.domain,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    is_active = TRUE,
    cache_version = COALESCE(domain_links.cache_version, 1) + 1,
    updated_at = NOW();
