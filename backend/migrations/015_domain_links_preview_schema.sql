-- =============================================================================
-- CardioGuard AI — Domain links preview schema
-- =============================================================================

ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS path TEXT DEFAULT '';
ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS cache_version INTEGER DEFAULT 1;
ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop unique index temporarily to avoid constraint violation during path normalization
DROP INDEX IF EXISTS idx_domain_links_path_unique;

UPDATE domain_links
SET path = CASE
    WHEN path IS NOT NULL AND BTRIM(path) <> '' THEN path
    WHEN url IS NOT NULL AND POSITION('://' IN url) > 0 THEN
        '/' || REGEXP_REPLACE(SPLIT_PART(url, '://', 2), '^([^/]+)', '')
    ELSE path
END
WHERE path IS NULL OR BTRIM(path) = '';

UPDATE domain_links SET is_active = COALESCE(is_active, TRUE);
UPDATE domain_links SET cache_version = COALESCE(cache_version, 1);

CREATE OR REPLACE FUNCTION update_domain_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_domain_links_updated_at ON domain_links;

CREATE TRIGGER trg_domain_links_updated_at
    BEFORE UPDATE ON domain_links
    FOR EACH ROW EXECUTE FUNCTION update_domain_links_updated_at();

-- Normalize all paths: Ensure non-empty paths start with a single slash (resolves '//login' and others to '/login')
UPDATE domain_links
SET path = '/' || LTRIM(path, '/')
WHERE path IS NOT NULL AND BTRIM(path) <> '';

-- Soft-delete older duplicate active domain links to prevent UniqueViolationError on unique index creation
UPDATE domain_links
SET deleted_at = NOW()
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(path) ORDER BY updated_at DESC) as rn
        FROM domain_links
        WHERE deleted_at IS NULL AND BTRIM(path) <> ''
    ) t WHERE t.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_links_path_unique
    ON domain_links (LOWER(path))
    WHERE deleted_at IS NULL AND BTRIM(path) <> '';

CREATE INDEX IF NOT EXISTS idx_domain_links_is_active ON domain_links (is_active);
CREATE INDEX IF NOT EXISTS idx_domain_links_deleted_at ON domain_links (deleted_at);
