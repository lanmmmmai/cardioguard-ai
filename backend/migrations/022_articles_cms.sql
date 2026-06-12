-- =============================================================================
-- CardioGuard AI — CMS Articles Migration
-- =============================================================================

-- 1. Create articles table
CREATE TABLE IF NOT EXISTS articles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    content    TEXT NOT NULL,
    summary    TEXT,
    author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    category   TEXT DEFAULT 'general',
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_articles_is_active ON articles(is_active);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
