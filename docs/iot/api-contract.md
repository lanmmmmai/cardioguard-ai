# CardioGuard AIoT API Contract

Tài liệu này mô tả contract hiện tại cho luồng AIoT backend.

## 1) Ingest telemetry

Endpoint:

```http
POST /iot/telemetry
Content-Type: application/json
X-Device-Uid: CG-ESP32S3-0001
X-Device-Mac: A8:42:E3:11:22:33
X-Device-Token: cgdt_xxx
```

Request body:

```json
{
  "timestamp": "2026-05-31T10:30:15Z",
  "sequence": 12842,
  "mode": "random_demo",
  "readings": {
    "heart_rate": 82,
    "spo2": 97,
    "systolic_bp": null,
    "diastolic_bp": null,
    "ecg_value": 0.18,
    "body_temperature": null,
    "motion_value": null
  },
  "signal": {
    "ppg_quality": "good",
    "ecg_quality": "good",
    "leads_off": false,
    "motion_detected": false
  },
  "device": {
    "battery": 86,
    "rssi": -58,
    "firmware_version": "0.2.0-random",
    "uptime_ms": 320000
  }
}
```

Response 200:

```json
{
  "message": "Telemetry accepted",
  "patient_id": "patient-user-uuid",
  "device_uid": "CG-ESP32S3-0001",
  "device_mac": "A8:42:E3:11:22:33",
  "is_abnormal": false,
  "alerts": [],
  "server_time": "2026-05-31T10:30:15.220Z"
}
```

Status codes:

- `200`: nhận telemetry thành công
- `400`: MAC không hợp lệ
- `401`: token thiết bị sai
- `403`: thiết bị bị chặn (`revoked/inactive/blocked`)
- `404`: chưa pair với bệnh nhân
- `503`: chưa cấu hình shared token trong môi trường fallback

Quy tắc:

- Backend map thiết bị sang bệnh nhân bằng MAC.
- Không tin `patient_id` từ firmware.
- Nếu thiếu BP (`null`), backend không tạo alert huyết áp.

## 2) Device status

Endpoint:

```http
GET /iot/devices/{device_uid}/status
Authorization: Bearer <jwt>
```

Quyền truy cập:

- `admin`: xem được tất cả
- `doctor`: chỉ xem bệnh nhân được phân công
- `patient`: chỉ xem thiết bị của chính mình

Response 200:

```json
{
  "device_uid": "CG-ESP32S3-0001",
  "device_id": "device-uuid",
  "patient_id": "patient-user-uuid",
  "device_mac": "A8:42:E3:11:22:33",
  "status": "online",
  "battery": 86,
  "last_seen_at": "2026-05-31T10:30:15.220Z",
  "device_type": "esp32_s3_supermini",
  "firmware_version": "0.2.0-random",
  "updated_at": "2026-05-31T10:30:15.220Z"
}
```

## 3) Rotate device token

Endpoint:

```http
POST /iot/devices/{device_uid}/rotate-token
Authorization: Bearer <jwt>
```

Response 200:

```json
{
  "device_uid": "CG-ESP32S3-0001",
  "device_id": "device-uuid",
  "device_token": "cgdt_xxx_show_once_only",
  "token_last_rotated_at": "2026-05-31T10:32:00Z"
}
```

Ghi chú:

- Nếu DB chưa migrate `device_token_hash`, endpoint trả `409`.
- Token mới chỉ hiển thị một lần, phải nạp lại vào firmware.
