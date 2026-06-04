# REST API Overview

CardioGuard có **140 REST endpoints** + 1 WebSocket endpoint, chia làm 14 routers.

## Prefix

Tất cả endpoints đều dưới prefix `/api` (trừ WebSocket ở `/api/ws/realtime`).

```
/api/auth/*          → Authentication
/api/users/*         → User management
/api/patients/*      → Patient listing
/api/sensor-data/*   → Sensor data + IoT
/api/iot/*           → IoT device management
/api/alerts/*        → Alert management
/api/appointments/*  → Appointments (CRUD)
/api/medical-records/* → Medical records (CRUD)
/api/prescriptions/* → Prescriptions (CRUD)
/api/devices/*       → Devices (CRUD)
/api/notifications/* → Notifications (CRUD)
/api/reports/*       → Reports (CRUD)
/api/chat-messages/* → Chat messages (CRUD)
/api/cameras/*       → Cameras (CRUD)
/api/chat/*          → AI Chat
/api/cms/*           → CMS (admin)
/api/email/*         → Email management (admin)
/api/admin/*         → Admin: doctors, users, assignments
/api/files/*         → File upload/download
/api/features/*      → Dashboard, AI placeholder
```

## Auth Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/register/request-otp` | None | Gửi OTP đăng ký qua email |
| POST | `/api/auth/register` | None | Xác thực OTP + tạo tài khoản |
| POST | `/api/auth/login` | None | Đăng nhập, trả JWT |
| POST | `/api/auth/google-login` | None | Google OAuth login |
| POST | `/api/auth/logout` | Optional | Revoke JWT |
| POST | `/api/auth/forgot-password/request-otp` | None | Gửi OTP quên mật khẩu |
| POST | `/api/auth/forgot-password/verify-otp` | None | Xác thực OTP + đặt lại mật khẩu |
| POST | `/api/auth/change-password` | Bearer | Đổi mật khẩu |
| GET | `/api/auth/me` | Bearer | Thông tin user hiện tại |

## User & Patient Endpoints

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| PUT | `/api/users/me` | Any | Cập nhật profile |
| PUT | `/api/users/me/password` | Any | Đổi mật khẩu |
| GET | `/api/patients/me` | patient | Profile bệnh nhân |
| PUT | `/api/patients/me` | patient | Cập nhật profile bệnh nhân |
| GET | `/api/patients/me/doctors` | patient | Danh sách bác sĩ được phân công |
| GET | `/api/patients` | doctor/admin | Danh sách bệnh nhân |

## IoT & Sensor Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/sensor-data` | Bearer | Gửi sensor data thủ công |
| POST | `/api/iot/telemetry` | Device Token | Gửi telemetry từ ESP32 |
| GET | `/api/iot/devices/{uid}/status` | Bearer | Trạng thái thiết bị |
| POST | `/api/iot/devices/{uid}/rotate-token` | admin/doctor | Rotate device token |
| GET | `/api/sensor-data` | Bearer | Lịch sử sensor data |
| GET | `/api/sensors/history` | Bearer | Paginated sensor history |

## Alert Endpoints

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/alerts` | Any | Danh sách cảnh báo (role-scoped) |
| GET | `/api/alerts/stats/last-7-days` | Any | Thống kê 7 ngày |
| PATCH | `/api/alerts/{id}/resolve` | Any | Đánh dấu đã xử lý |
| POST | `/api/alerts` | patient | Tạo SOS alert |

## AI Chat Endpoints

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| POST | `/api/chat/send` | Any | Gửi tin nhắn AI |
| GET | `/api/chat/sessions` | Any | Danh sách sessions |
| GET | `/api/chat/history/{session_id}` | Any | Lịch sử tin nhắn |
| POST | `/api/chat/analyze-patient` | doctor/admin | AI phân tích bệnh nhân |
| GET | `/api/chat/recommendations` | Any | AI recommendations |

## CRUD Endpoints (8 tables × 5 endpoints + 2 aliases + 1 summary)

Mỗi table có: `GET /` (list), `POST /` (create), `GET /{id}`, `PATCH/{id}`, `DELETE /{id}`

| Table | Path | Aliases |
|-------|------|---------|
| appointments | `/api/appointments` | — |
| medical_records | `/api/medical-records` | — |
| prescriptions | `/api/prescriptions` | — |
| devices | `/api/devices` | `/api/iot-devices` |
| notifications | `/api/notifications` | — |
| chat_messages | `/api/chat-messages` | `/api/chat` |
| cameras | `/api/cameras` | — |
| reports | `/api/reports` | — |

Ngoài ra: `GET /api/reports/summary` — thống kê báo cáo.

## Admin Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/users` | Danh sách users |
| POST | `/api/admin/users` | Tạo user |
| PUT | `/api/admin/users/{id}` | Cập nhật user |
| DELETE | `/api/admin/users/{id}` | Soft-delete user |
| GET | `/api/admin/doctors` | Danh sách bác sĩ |
| POST | `/api/admin/doctors` | Tạo bác sĩ |
| PUT | `/api/admin/doctors/{id}` | Cập nhật bác sĩ |
| DELETE | `/api/admin/doctors/{id}` | Soft-delete bác sĩ |
| PATCH | `/api/admin/doctors/{id}/verify` | Xác thực bác sĩ |
| PATCH | `/api/admin/doctors/{id}/reject` | Từ chối bác sĩ |
| PATCH | `/api/admin/doctors/{id}/request-update` | Yêu cầu cập nhật |
| GET | `/api/admin/assignments` | Phân công doctor-patient |
| POST | `/api/admin/assignments` | Tạo phân công |
| DELETE | `/api/admin/assignments/{doctor_id}/{patient_id}` | Xóa phân công |

## CMS Endpoints (admin)

Quản lý nội dung: domain links, email templates, data tables, CSV import/export.

Xem chi tiết tại [cms-email.md](cms-email.md).

## Email Endpoints (admin)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/email/send` | Gửi email (template/raw) |
| GET | `/api/email/templates` | Danh sách templates |
| POST | `/api/email/preview` | Preview template |
| GET | `/api/email/logs` | Log gửi email |
| POST | `/api/email/logs/{id}/retry` | Gửi lại email failed |

## File Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/files/upload` | Upload file (avatar, giấy tờ) |
| GET | `/api/files/download/{path}` | Download file |

## Error Codes

| Status | Ý nghĩa |
|--------|---------|
| 200 | Thành công |
| 400 | Bad request / validation error |
| 401 | Unauthorized (thiếu hoặc sai token) |
| 403 | Forbidden (không đủ quyền) |
| 404 | Not found |
| 422 | Validation error (request body sai) |
| 429 | Rate limited |
| 500 | Internal server error |
