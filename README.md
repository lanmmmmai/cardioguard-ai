# CardioGuard AI

CardioGuard AI là hệ thống giám sát sức khỏe đa nền tảng cho bệnh nhân, bác sĩ và admin. Dự án gồm backend FastAPI, web dashboard React, mobile app Flutter, mô hình AI demo và pipeline AIoT cho thiết bị ESP32 gửi telemetry realtime.

Các chỉ số chính đang được hỗ trợ:

- Nhịp tim
- SpO2
- Huyết áp
- ECG
- Cảnh báo bất thường
- Trạng thái thiết bị IoT/AIoT
- WebSocket realtime theo quyền patient/doctor/admin

## Cấu Trúc Dự Án

```text
cardioguard-ai/
├── backend/                    # FastAPI API, auth, DB, realtime, IoT ingest
│   ├── app/
│   │   ├── api/                # REST/WebSocket routers
│   │   ├── ai/                 # Rule-based abnormal detection
│   │   ├── core/               # Config, database, security
│   │   ├── models/             # SQLAlchemy table definitions
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Email, OTP, AI service
│   │   └── websocket/          # WebSocket connection manager
│   ├── migrations/             # SQL migrations
│   ├── run_migration.py
│   └── requirements.txt
├── web_frontend/               # React 18 + TypeScript + Vite dashboard
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vercel.json
├── mobile_app/                 # Flutter app
│   ├── lib/
│   ├── assets/
│   └── pubspec.yaml
├── ai_model/                   # Training/demo model assets
├── hardware/                   # ESP32-S3 SuperMini firmware and hardware docs
│   └── esp32_s3_supermini/
├── docs/iot/                   # AIoT API contract, runbook, UAT, security docs
├── AGENTS.md
├── vercel.json
└── README.md
```

## Backend

Backend dùng FastAPI, async database access, JWT auth, OTP, email service, realtime WebSocket và API ingest cho thiết bị AIoT.

### Chạy backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Nếu bạn đã có virtualenv ở thư mục root, có thể dùng:

```bash
source ../.venv/bin/activate
```

API chạy tại:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

### Biến môi trường backend

Tạo `backend/.env` dựa trên [backend/.env.example](/Users/doanlan/CNST/cardioguard-ai/backend/.env.example).

Các biến quan trọng:

```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=replace-with-a-strong-random-secret-at-least-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=60
EXPOSE_DEV_OTP=false
IOT_DEVICE_SHARED_TOKEN=
OPENAI_API_KEY=
```

Ghi chú:

- `IOT_DEVICE_SHARED_TOKEN` chỉ là fallback cho môi trường dev.
- Production nên dùng token riêng từng thiết bị qua `device_token_hash`.

## Database Migrations

Chạy migration từ thư mục `backend`:

```bash
cd backend
python run_migration.py migrations/006_add_device_auth_columns.sql
```

Migration IoT quan trọng:

- [006_add_device_auth_columns.sql](/Users/doanlan/CNST/cardioguard-ai/backend/migrations/006_add_device_auth_columns.sql)

Migration này thêm:

- `devices.device_mac`
- `devices.device_token_hash`
- `devices.token_last_rotated_at`
- `devices.firmware_version`
- `devices.metadata`
- unique index cho MAC đã normalize

## Web Frontend

Web dashboard dùng React 18, TypeScript, Vite và `lucide-react`.

### Chạy web

```bash
cd web_frontend
npm install
npm run dev
```

Web chạy tại:

```text
http://localhost:5173
```

Build production:

```bash
npm run build
```

### Biến môi trường web

Tạo `web_frontend/.env` dựa trên [web_frontend/.env.example](/Users/doanlan/CNST/cardioguard-ai/web_frontend/.env.example).

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Mobile App

Mobile app dùng Flutter, Provider, HTTP API, WebSocket realtime, ECG painter và heart painter.

### Chạy mobile

```bash
cd mobile_app
flutter pub get
flutter run
```

Build Android APK:

```bash
flutter build apk --release
```

## AIoT / ESP32-S3 SuperMini

Phần cứng hiện tập trung vào prototype:

- ESP32-S3 SuperMini
- Random telemetry trước khi nối cảm biến thật
- MAC-based device mapping
- Per-device token
- HTTP telemetry ingest
- Offline buffer + retry/backoff

Firmware nằm tại:

- [hardware/esp32_s3_supermini/firmware](/Users/doanlan/CNST/cardioguard-ai/hardware/esp32_s3_supermini/firmware)

Tài liệu vận hành phần cứng:

- [operating-flow.md](/Users/doanlan/CNST/cardioguard-ai/hardware/esp32_s3_supermini/docs/operating-flow.md)
- [wiring.md](/Users/doanlan/CNST/cardioguard-ai/hardware/esp32_s3_supermini/docs/wiring.md)

### Chạy firmware

Firmware dùng PlatformIO:

```bash
cd hardware/esp32_s3_supermini/firmware
pio run
pio run -t upload
pio device monitor -b 115200
```

Các cấu hình cần chỉnh nằm trong:

- [config.h](/Users/doanlan/CNST/cardioguard-ai/hardware/esp32_s3_supermini/firmware/include/config.h)

Các giá trị cần thay trước khi flash:

- `kWifiSsid`
- `kWifiPassword`
- `kTelemetryEndpoint`
- `kDeviceToken`

## AIoT API Chính

### Gửi telemetry

```http
POST /iot/telemetry
X-Device-Uid: CG-ESP32S3-0001
X-Device-Mac: A8:42:E3:11:22:33
X-Device-Token: cgdt_xxx
Content-Type: application/json
```

Backend sẽ:

1. Xác thực token thiết bị.
2. Map `device_mac -> patient_id`.
3. Lưu `sensor_data`.
4. Chạy abnormal detection.
5. Tạo `alerts` nếu cần.
6. Broadcast WebSocket cho patient, doctor được phân công và admin.

### Xem trạng thái thiết bị

```http
GET /iot/devices/{device_uid}/status
Authorization: Bearer <jwt>
```

### Rotate token thiết bị

```http
POST /iot/devices/{device_uid}/rotate-token
Authorization: Bearer <jwt>
```

Chỉ `admin` hoặc `doctor` có quyền rotate token.

## Tài Liệu IoT

Các tài liệu hỗ trợ triển khai:

- [API contract](/Users/doanlan/CNST/cardioguard-ai/docs/iot/api-contract.md)
- [Runbook](/Users/doanlan/CNST/cardioguard-ai/docs/iot/runbook.md)
- [UAT checklist](/Users/doanlan/CNST/cardioguard-ai/docs/iot/uat-checklist.md)
- [Security policy](/Users/doanlan/CNST/cardioguard-ai/docs/iot/security-policy.md)

## Quyền Realtime

WebSocket realtime gửi dữ liệu theo role:

- `patient`: chỉ thấy dữ liệu của chính mình.
- `doctor`: chỉ thấy bệnh nhân được phân công trong `doctor_patient`.
- `admin`: thấy toàn bộ.

Các event chính:

- `health_metrics`
- `emergency_alerts`
- `appointments`
- `notifications`
- `chat`

## AI Model

Thư mục [ai_model](/Users/doanlan/CNST/cardioguard-ai/ai_model) chứa dữ liệu và model demo:

- `heart_disease_clean.csv`
- `heart_disease_model.pkl`
- `train_model.py`
- `app.py`

Phần AI realtime hiện tại trong backend chủ yếu là rule-based abnormal detection tại:

- [heart_ai.py](/Users/doanlan/CNST/cardioguard-ai/backend/app/ai/heart_ai.py)

## Kiểm Tra Nhanh

Backend syntax check:

```bash
python3 -m compileall backend/app
```

Web build:

```bash
cd web_frontend
npm run build
```

Flutter:

```bash
cd mobile_app
flutter analyze
```

Firmware:

```bash
cd hardware/esp32_s3_supermini/firmware
pio run
```

## Ghi Chú Bảo Mật

- Không commit `.env`.
- Không commit token thiết bị thật.
- Không dùng JWT user trong firmware.
- Không tin `patient_id` do firmware gửi lên.
- Token thiết bị chỉ hiển thị một lần khi rotate.
- Production nên tắt shared token fallback và chỉ dùng `device_token_hash`.
