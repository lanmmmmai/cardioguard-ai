CREATE TABLE IF NOT EXISTS auth_otp_tokens (
    id           UUID        PRIMARY KEY,
    purpose      TEXT        NOT NULL CHECK (purpose IN ('register', 'forgot_password')),
    email        TEXT        NOT NULL,
    otp_hash     TEXT        NOT NULL,
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    attempts     INTEGER     NOT NULL DEFAULT 0,
    max_attempts INTEGER     NOT NULL DEFAULT 5,
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_lookup
    ON auth_otp_tokens (purpose, email, consumed_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_expires_at
    ON auth_otp_tokens (expires_at);
