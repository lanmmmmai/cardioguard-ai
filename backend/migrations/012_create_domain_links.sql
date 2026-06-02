-- =============================================================================
-- CardioGuard AI — Create domain_links table migration
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_links (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    url         TEXT        NOT NULL,
    domain      TEXT        NOT NULL DEFAULT '',
    title       TEXT        NOT NULL DEFAULT '',
    description TEXT        NOT NULL DEFAULT '',
    image_url   TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_domain_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_domain_links_updated_at
    BEFORE UPDATE ON domain_links
    FOR EACH ROW EXECUTE FUNCTION update_domain_links_updated_at();

-- Seed sample domain link (giatky.site)
INSERT INTO domain_links (url, domain, title, description, image_url)
VALUES (
    'https://giatky.site/login',
    'giatky.site',
    'CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực',
    'CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.',
    'https://giatky.site/images/preview.jpg'
)
ON CONFLICT DO NOTHING;
