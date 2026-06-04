# Testing Guide

## Test Suites

## Test Suites

### Frontend (Vitest)

**6 files — 29 tests**

```bash
cd web_frontend
npm test            # vitest run
```

| File | Tests | Mocks | Mô tả |
|------|-------|-------|-------|
| `src/auth/roles.test.ts` | 1 | ✗ | `normalizeRole()`, `defaultRouteByRole()` |
| `src/config.test.ts` | 4 | ✗ | `buildApiUrl` — absolute/relative, dedup |
| `src/services/medicalRecordsService.test.ts` | 6 | fetch | CRUD medical records, bác sĩ-bệnh nhân |
| `src/services/cmsApi.test.ts` | 8 | fetch | CMS CRUD + CSV import/export + error |
| `src/utils/logger.test.ts` | 2 | console | Dev/prod conditional logging |
| `src/utils/passwordPolicy.test.ts` | 8 | ✗ | Password strength + i18n messages |

### Backend (unittest)

**6 files — 26 unit tests + 7 integration scenarios**

```bash
cd backend
python -m pytest tests/ -v
```

| File | Tests | Mocks | Mô tả |
|------|-------|-------|-------|
| `test_core_security.py` | 4 | ✗ | Password policy, bcrypt, JWT creation |
| `test_runtime_guards.py` | 5 | DB | AI detection null safety, config guard, pass policy, rate-limit bound, audit shutdown |
| `test_crud_api_contract.py` | 1 | DB + auth | CRUD paginated envelope (items, total, limit, offset) |
| `test_otp_rules.py` | 6 | DB | OTP generate, hash, parse, create, verify (success/expired/incorrect) |
| `test_alert_rules.py` | 9 | DB + auth + WS | Alerts role-scoped (patient/doctor/admin), stats, resolve, SOS, RBAC |
| `test_auth_schema.py` | 22 | ✗ | Auth schema validation (name, OTP, password, cross-field) |
| `test_sensor_schema.py` | 10 | ✗ | Sensor data + IoT telemetry validation (BP, ranges) |
| `test_crud_schema.py` | 14 | ✗ | CRUD domain schemas (appointment, device, report, etc.) |
| `test_profile_schema.py` | 4 | ✗ | Patient/Doctor profile update schemas |
| `test_patient_schema.py` | 3 | ✗ | PatientCreate validation |
| `test_user_schema.py` | 13 | ✗ | UserMe, Password, PatientMe, Admin create/update |
| `test_admin_doctor_schema.py` | 8 | ✗ | DoctorCreate/Update/Response schemas |
| `test_profile_security.py`* | 7 | Live DB | Integration: RBAC + file upload + doctor verify |

*`test_profile_security.py` kết nối database thật (Supabase). Không chạy trong CI.

### Mobile (flutter_test)

**6 files — 16 tests**

```bash
cd mobile_app
flutter test
```

| File | Tests | Mocks | Mô tả |
|------|-------|-------|-------|
| `widget_test.dart` | 2 | ✗ | AppConfig constants |
| `app_config_test.dart` | 2 | ✗ | AppConfig.baseUrl, AppConfig.wsUrl |
| `api_client_contract_test.dart` | 2 | ✗ | ApiClient.extractListData |
| `app_flow_test.dart` | 3 testWidgets | Navigator | Force password, SOS, tablet nav |
| `appointment_provider_test.dart` | 3 | Dio adapter | fetchAppointments, book, update status |
| `alert_provider_test.dart` | 5 | Dio adapter | fetchAlerts, resolve, SOS, realtime upsert, stats |

## Test trong CI

Hiện tại CI/CD pipeline **không chạy test** nào. Chỉ có syntax check + build.

## Hạn chế

| Thiếu | Mức độ |
|-------|--------|
| Backend tests trong CI | ❌ |
| Frontend tests trong CI | ❌ |
| Flutter tests trong CI | ❌ |
| Backend linter (ruff) trong CI | ❌ |
| pytest configuration file | ❌ |
| Coverage reporting | ❌ |
| E2E tests (Playwright/Cypress) | ❌ |
| Database migration tests | ❌ |

## Tổ chức test

```
backend/tests/
├── test_core_security.py       # Unit: password, JWT, bcrypt
├── test_runtime_guards.py      # Unit: guards, config, rate-limit
├── test_crud_api_contract.py   # Unit: CRUD envelope
├── test_otp_rules.py           # Unit: OTP service
├── test_alert_rules.py         # Unit: alert API + RBAC
├── test_auth_schema.py         # Unit: auth schema validation
├── test_sensor_schema.py       # Unit: sensor schema validation
├── test_crud_schema.py         # Unit: CRUD domain schemas
├── test_profile_schema.py      # Unit: profile schemas
├── test_patient_schema.py      # Unit: patient schema
├── test_user_schema.py         # Unit: user schemas
├── test_admin_doctor_schema.py # Unit: admin doctor schemas
└── test_profile_security.py    # Integration: API + live DB

web_frontend/src/
├── auth/roles.test.ts
├── config.test.ts
├── services/
│   ├── medicalRecordsService.test.ts
│   └── cmsApi.test.ts
└── utils/
    ├── logger.test.ts
    └── passwordPolicy.test.ts

mobile_app/test/
├── widget_test.dart
├── app_config_test.dart
├── api_client_contract_test.dart
├── app_flow_test.dart
├── appointment_provider_test.dart
└── alert_provider_test.dart
```
