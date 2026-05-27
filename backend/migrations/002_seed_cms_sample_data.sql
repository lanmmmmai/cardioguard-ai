CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO patients(id, full_name, age, gender, phone, address, medical_history)
SELECT
  gen_random_uuid(),
  'CMS Patient ' || index,
  25 + (index % 45),
  CASE WHEN index % 2 = 0 THEN 'Nam' ELSE 'Nữ' END,
  '090000' || lpad(index::text, 4, '0'),
  'Khu dân cư CardioGuard, Phòng ' || index,
  'Seed sample data for CMS testing'
FROM generate_series(1, 20) AS index
WHERE NOT EXISTS (
  SELECT 1 FROM patients WHERE full_name LIKE 'CMS Patient %'
);

INSERT INTO cameras(id, camera_name, location, stream_url, status, assigned_patient_id)
SELECT
  gen_random_uuid(),
  'ICU Camera ' || index,
  'ICU Bed ' || lpad(index::text, 2, '0'),
  'rtsp://example.local/cardioguard/camera-' || index,
  CASE WHEN index % 3 = 0 THEN 'maintenance' ELSE 'online' END,
  patient.id
FROM generate_series(1, 10) AS index
JOIN LATERAL (
  SELECT id FROM patients ORDER BY created_at DESC, id LIMIT 1 OFFSET (index - 1)
) patient ON true
WHERE NOT EXISTS (
  SELECT 1 FROM cameras WHERE camera_name LIKE 'ICU Camera %'
);

INSERT INTO devices(id, patient_id, device_name, device_type, serial_number, status, battery_level, last_seen)
SELECT
  gen_random_uuid(),
  patient.id,
  'Wearable CG-' || lpad(index::text, 2, '0'),
  CASE WHEN index % 2 = 0 THEN 'wearable' ELSE 'gateway' END,
  'CG-SN-' || lpad(index::text, 5, '0'),
  CASE WHEN index % 4 = 0 THEN 'offline' ELSE 'online' END,
  55 + (index % 40),
  NOW() - (index || ' minutes')::interval
FROM generate_series(1, 10) AS index
JOIN LATERAL (
  SELECT id FROM patients ORDER BY created_at DESC, id LIMIT 1 OFFSET (index - 1)
) patient ON true
WHERE NOT EXISTS (
  SELECT 1 FROM devices WHERE serial_number LIKE 'CG-SN-%'
);

INSERT INTO sensor_data(id, patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at)
SELECT
  gen_random_uuid(),
  patient.id,
  62 + (index % 58),
  92 + (index % 8),
  105 + (index % 40),
  65 + (index % 25),
  round((0.4 + (index % 12) * 0.08)::numeric, 2)::double precision,
  NOW() - (index || ' minutes')::interval
FROM generate_series(1, GREATEST(0, 50 - (SELECT COUNT(*)::int FROM sensor_data))) AS index
JOIN LATERAL (
  SELECT id FROM patients ORDER BY created_at DESC, id LIMIT 1 OFFSET ((index - 1) % 20)
) patient ON true
WHERE (SELECT COUNT(*) FROM sensor_data) < 50;
