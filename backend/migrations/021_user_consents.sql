-- =============================================================================
-- CardioGuard AI — User Consents History Migration
-- =============================================================================

-- 1. Alter users table to add consent columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version TEXT;

-- 2. Create user_consents history table
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL, -- 'privacy', 'terms'
    consent_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
