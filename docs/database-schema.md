# Database Schema

CardioGuard sử dụng **PostgreSQL 15+** trên Supabase với **27 tables** + 1 materialized view.

## Entity Relationship

```
users ──1:1── patients
users ──1:1── patient_profiles
users ──1:1── doctor_profiles
users ──1:N── sensor_data
users ──1:N── alerts
users ──1:N── chat_sessions
users ──1:N── ai_recommendations
users ──1:N── audit_logs
users ──1:N── revoked_tokens
users ──1:N── devices

users ──N:M── users (qua doctor_patient)
users ──1:N── appointments (patient)
users ──1:N── appointments (doctor)
users ──1:N── medical_records
users ──1:N── prescriptions
users ──1:N── reports

chat_sessions ──1:N── chat_messages
chat_sessions ──1:N── chatbot_messages

cms_email_functions ──1:N── email_templates
email_templates ──1:N── email_logs
```

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE | Login identifier |
| password_hash | TEXT | bcrypt |
| full_name | TEXT | |
| role | TEXT | `patient`, `doctor`, `admin` |
| phone | TEXT | |
| specialty | TEXT | Doctor only |
| department | TEXT | Doctor only |
| status | TEXT | `active`, `inactive`, `deleted` |
| must_change_password | BOOLEAN | |
| is_verified | BOOLEAN | |
| profile_completed | BOOLEAN | |
| avatar_url | TEXT | |
| google_id | TEXT | Google OAuth |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-update trigger |

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users | |
| full_name | TEXT | |
| age | INTEGER | |
| gender | TEXT | |
| phone | TEXT | |
| address | TEXT | |
| medical_history | TEXT | |

### `patient_profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users UNIQUE | |
| full_name | TEXT | |
| phone | TEXT | |
| gender | TEXT | |
| date_of_birth | DATE | |
| address | TEXT | |
| blood_type | TEXT | |
| medical_history | TEXT | |
| allergies | TEXT | |
| emergency_contact_name | TEXT | |
| emergency_contact_phone | TEXT | |
| avatar_url | TEXT | |
| profile_completed | BOOLEAN | |

### `doctor_profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK→users UNIQUE | |
| full_name | TEXT | |
| phone | TEXT | |
| gender | TEXT | |
| date_of_birth | DATE | |
| address | TEXT | |
| specialty | TEXT | |
| position | TEXT | |
| workplace | TEXT | |
| experience_years | INTEGER | |
| license_number | TEXT | |
| license_certificate_url | TEXT | |
| cccd_front_url | TEXT | |
| cccd_back_url | TEXT | |
| avatar_url | TEXT | |
| is_verified | BOOLEAN | |
| verified_by | UUID FK→users | |
| status | TEXT | `pending_profile`, `pending_verification`, `active`, `rejected`, `need_update` |

### `doctor_patient`
Junction table.

| Column | Type |
|--------|------|
| doctor_id | UUID FK→users |
| patient_id | UUID FK→users |
| created_at | TIMESTAMPTZ |

### `sensor_data`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| patient_id | UUID FK→users | |
| heart_rate | INTEGER | bpm |
| spo2 | INTEGER | % |
| systolic_bp | INTEGER | mmHg |
| diastolic_bp | INTEGER | mmHg |
| ecg_value | FLOAT | mV |
| body_temperature | FLOAT | |
| motion_value | FLOAT | |
| created_at | TIMESTAMPTZ | Indexed (patient_id, created_at DESC) |

### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| patient_id | UUID FK→users | |
| alert_type | TEXT | `SOS`, `HIGH_HEART_RATE`, `LOW_SPO2`, ... |
| message | TEXT | |
| severity | TEXT | `info`, `warning`, `critical` |
| is_resolved | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### `devices`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| patient_id | UUID FK→users | |
| name | TEXT | |
| device_type | TEXT | |
| device_mac | TEXT UNIQUE | Normalized lowercase |
| device_token_hash | TEXT | bcrypt hash |
| status | TEXT | `online`, `offline`, `revoked` |
| battery | INTEGER | 0-100 |
| firmware_version | TEXT | |
| metadata | JSONB | |
| last_seen_at | TIMESTAMPTZ | |

### `appointments`
| Column | Type |
|--------|------|
| id | UUID PK |
| patient_id | UUID FK→users |
| doctor_id | UUID FK→users |
| title | TEXT |
| status | TEXT |
| channel | TEXT |
| scheduled_at | TIMESTAMPTZ |
| notes | TEXT |

### `chat_sessions`
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK→users |
| role | TEXT |
| title | TEXT |
| created_at | TIMESTAMPTZ |

### `chatbot_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| session_id | UUID FK→chat_sessions | |
| sender | TEXT | `user` hoặc `ai` |
| message | TEXT | |
| context | JSONB | |
| created_at | TIMESTAMPTZ | |

### `ai_recommendations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| patient_id | UUID FK→users | |
| severity | TEXT | `info`, `warning`, `critical` |
| recommendation | TEXT | |
| generated_by | TEXT | `system_ai` |
| is_resolved | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### `auth_otp_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| purpose | TEXT | `register` / `forgot_password` |
| email | TEXT | |
| otp_hash | TEXT | HMAC-SHA256 |
| attempts | INTEGER | Max 5 |
| max_attempts | INTEGER | |
| expires_at | TIMESTAMPTZ | 10 phút |
| consumed_at | TIMESTAMPTZ | Nullable |

### `revoked_tokens`
| Column | Type |
|--------|------|
| jti | TEXT PK |
| expires_at | TIMESTAMPTZ |

### `domain_links`
CMS quản lý SEO meta tags.

| Column | Type |
|--------|------|
| id | UUID PK |
| url | TEXT |
| domain | TEXT |
| title | TEXT |
| description | TEXT |
| image_url | TEXT |
| path | TEXT UNIQUE |
| is_active | BOOLEAN |
| deleted_at | TIMESTAMPTZ (soft delete) |

### `email_templates`
| Column | Type |
|--------|------|
| id | UUID PK |
| function_id | UUID FK→cms_email_functions |
| name | TEXT |
| subject | TEXT |
| html_content | TEXT |
| variables | JSONB |
| is_active | BOOLEAN |

### `email_logs`
| Column | Type |
|--------|------|
| id | UUID PK |
| template_id | UUID FK→email_templates |
| receiver_email | TEXT |
| subject | TEXT |
| status | TEXT |
| error_message | TEXT |
| sent_at | TIMESTAMPTZ |

### `audit_logs`
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK→users |
| action | TEXT |
| entity_type | TEXT |
| entity_id | TEXT |
| ip_address | TEXT |
| details | JSONB |
| created_at | TIMESTAMPTZ |

## Materialized View

### `reports_summary_mv`
`REFRESH MATERIALIZED VIEW CONCURRENTLY` qua trigger `pg_notify`.

| Column | Type |
|--------|------|
| report_type | TEXT |
| total | INTEGER |

## Migrations

20 migration files trong `backend/migrations/`, chạy bằng `scripts/run_all_migrations.py`.

| File | Nội dung |
|------|----------|
| 001 | patients.user_id FK |
| 003 | Doctor fields cho users |
| 004 | must_change_password |
| 005 | auth_otp_tokens |
| 006 | Device auth columns |
| 007 | Fix ai_recommendations FK |
| 008 | Performance indexes |
| 009 | Advanced indexes |
| 010 | Split chat tables |
| 011 | revoked_tokens |
| 012 | domain_links |
| 013 | Missing indexes |
| 014 | SEO links update |
| 015 | domain_links preview schema |
| 016 | Security, roles, profiles |
| 017 | User timestamps |
| 018 | MV refresh optimization |
| 019 | Chatbot migration |
| 020 | Email CMS migration |
