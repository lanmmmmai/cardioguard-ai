ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_mac TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_token_hash TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS token_last_rotated_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS firmware_version TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_device_mac
ON devices (lower(replace(replace(device_mac, ':', ''), '-', '')));

