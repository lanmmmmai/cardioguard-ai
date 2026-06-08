-- =============================================================================
-- CardioGuard AI — Canonicalize public legal domain links
--
-- Purpose:
--   Use English URL paths as canonical links for the public footer pages and
--   soft-delete the previously seeded Vietnamese slug records from domain_links.
-- =============================================================================

WITH canonical_public_links(path, url, domain, title, description, image_url) AS (
    VALUES
        (
            '/about',
            'https://giatky.site/about',
            'giatky.site',
            'CardioGuard AI - Giới thiệu',
            'Tìm hiểu về nền tảng CardioGuard AI, hệ thống giám sát tim mạch, SpO2, huyết áp và cảnh báo lâm sàng thời gian thực.',
            'https://giatky.site/og-about.png'
        ),
        (
            '/privacy',
            'https://giatky.site/privacy',
            'giatky.site',
            'CardioGuard AI - Chính sách bảo mật',
            'Chính sách bảo mật dữ liệu cá nhân và dữ liệu sức khỏe của bệnh nhân, bác sĩ và quản trị viên trên CardioGuard AI.',
            'https://giatky.site/og-privacy.png'
        ),
        (
            '/terms',
            'https://giatky.site/terms',
            'giatky.site',
            'CardioGuard AI - Điều khoản dịch vụ',
            'Điều khoản sử dụng nền tảng CardioGuard AI, bao gồm trách nhiệm tài khoản, cảnh báo y tế tham khảo và quy định truy cập.',
            'https://giatky.site/og-terms.png'
        ),
        (
            '/data-deletion',
            'https://giatky.site/data-deletion',
            'giatky.site',
            'CardioGuard AI - Yêu cầu xóa dữ liệu',
            'Hướng dẫn gửi yêu cầu xóa tài khoản, dữ liệu cá nhân và dữ liệu liên quan theo quy trình bảo mật của CardioGuard AI.',
            'https://giatky.site/og-data-deletion.png'
        )
)
INSERT INTO domain_links (path, url, domain, title, description, image_url, is_active, cache_version)
SELECT path, url, domain, title, description, image_url, TRUE, 1
FROM canonical_public_links
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

UPDATE domain_links
SET
    is_active = FALSE,
    deleted_at = COALESCE(deleted_at, NOW()),
    cache_version = COALESCE(cache_version, 1) + 1,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND LOWER(path) IN (
      '/gioi-thieu',
      '/chinh-sach-bao-mat',
      '/dieu-khoan-dich-vu',
      '/yeu-cau-xoa-du-lieu'
  );
