-- Migration 010: Tách bảng chatbot_messages khỏi chat_messages của mobile CRUD

CREATE TABLE IF NOT EXISTS chatbot_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender      TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    context     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id
ON chatbot_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created_at
ON chatbot_messages(created_at);

DO $$
DECLARE
    has_chat_messages_table BOOLEAN;
    has_session_id_col BOOLEAN;
    has_sender_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chat_messages'
    ) INTO has_chat_messages_table;

    IF has_chat_messages_table THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'session_id'
        ) INTO has_session_id_col;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'sender'
        ) INTO has_sender_col;

        -- Chỉ migrate khi chat_messages là schema chatbot cũ.
        IF has_session_id_col AND has_sender_col THEN
            INSERT INTO chatbot_messages (id, session_id, sender, message, context, created_at)
            SELECT
                cm.id,
                cm.session_id,
                cm.sender,
                cm.message,
                cm.context,
                cm.created_at
            FROM chat_messages cm
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;
