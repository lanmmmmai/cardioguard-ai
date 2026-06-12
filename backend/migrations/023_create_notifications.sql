-- =============================================================================
-- CardioGuard AI — Activity and Medical Notifications Migration
--
-- Purpose:
--   Adds the persistent in-app notification schema and user preferences without
--   deleting existing notification history.
--
-- Workflow:
--   1. Ensure pgcrypto is available for gen_random_uuid().
--   2. Add notification preferences to users.
--   3. Create notifications when absent and add missing columns when present.
--   4. Add indexes, foreign keys, and updated_at trigger idempotently.
--
-- Relationships:
--   - users: notification receiver and actor references.
--   - patients: optional clinical context for health notifications.
--   - websocket notification service: reads these records for realtime payloads.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB
DEFAULT '{"health": true, "appointment": true, "record": true, "chat": true, "system": true, "security": true}'::jsonb;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    patient_id UUID,
    actor_id UUID,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source_table TEXT,
    source_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN severity SET DEFAULT 'info';
ALTER TABLE notifications ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE notifications ALTER COLUMN is_read SET DEFAULT FALSE;
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_user_id_fkey'
    ) THEN
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_patient_id_fkey'
    ) THEN
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_patient_id_fkey
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_actor_id_fkey'
    ) THEN
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id)
WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_patient_created
ON notifications(patient_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();
