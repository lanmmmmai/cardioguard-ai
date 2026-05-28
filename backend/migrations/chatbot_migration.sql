-- =============================================================================
-- CardioGuard AI — Chatbot CMS Migration
-- =============================================================================

-- 1. Bảng chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL, -- 'patient' or 'doctor'
    title       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- 2. Bảng chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender      TEXT        NOT NULL, -- 'user' or 'ai'
    message     TEXT        NOT NULL,
    context     JSONB,      -- Lưu context của tin nhắn (e.g. data sensor lúc gửi)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 3. Bảng ai_recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    severity        TEXT        NOT NULL DEFAULT 'info', -- info | warning | critical
    recommendation  TEXT        NOT NULL,
    generated_by    TEXT        NOT NULL DEFAULT 'system_ai',
    is_resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_patient_id ON ai_recommendations(patient_id);
