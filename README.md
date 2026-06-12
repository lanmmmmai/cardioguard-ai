# CardioGuard AI

Hệ thống giám sát sức khỏe đa nền tảng cho bệnh nhân, bác sĩ và admin. Backend FastAPI, web dashboard React + TypeScript, mobile app Flutter, AI model và pipeline AIoT cho thiết bị ESP32 gửi telemetry realtime.

Chỉ số hỗ trợ: nhịp tim · SpO2 · huyết áp · ECG · cảnh báo bất thường · trạng thái thiết bị IoT · WebSocket realtime phân quyền

## Cấu Trúc Dự Án

```text
cardioguard-ai/
├── backend/                    # FastAPI (Python 3.11)
│   ├── app/
│   │   ├── api/                # 14+ routers (auth, user, patient, sensor, alert, crud, cms, email, chat, feature, profile, admin_doctor, realtime)
│   │   ├── ai/                 # Rule-based abnormal detection (heart_ai.py)
│   │   ├── core/               # Config, database, security, rate_limit, password_policy
│   │   ├── models/             # SQLAlchemy table definitions
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Email, OTP, AI service, audit, DB optimization
│   │   └── websocket/          # WebSocket connection manager (role-aware)
│   ├── migrations/             # 20 SQL migration files
│   ├── scripts/                # Migration runner, seed data, start.sh
│   ├── tests/                  # Unit + integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── web_frontend/               # React 18 + TypeScript + Vite 8
│   ├── src/
│   │   ├── auth/               # AuthContext, ProtectedRoute, roles
│   │   ├── components/         # Dashboard, Alerts, Patients, Chat, CMS, medical-records
│   │   ├── hooks/              # useWebSocket, useBrowserPath
│   │   ├── layouts/            # RoleLayout
│   │   ├── lib/                # Supabase client
│   │   ├── pages/              # Role-based pages (patient, doctor, admin)
│   │   ├── services/           # API clients
│   │   ├── types/              # Shared TypeScript interfaces
│   │   └── utils/              # API errors, password policy, severity
│   ├── public/                 # Manifest, service worker, icons
│   ├── api/                    # Vercel serverless SEO function
│   ├── netlify/                # Netlify SEO function
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── server.js               # Production Express server (SEO injector)
│   ├── seo-injector.js
│   ├── vercel.json
│   └── netlify.toml
├── mobile_app/                 # Flutter (Android + macOS + Windows)
│   ├── lib/
│   │   ├── config/             # AppConfig (API/WS URLs)
│   │   ├── core/               # ApiClient, AppLogger, SecureStorage
│   │   ├── models/             # Dart data models
│   │   ├── providers/          # Provider state management (auth, patient, alert, chat, appointment)
│   │   ├── screens/            # 13+ screens (login, dashboard, patients, alerts, chat, settings)
│   │   ├── services/           # WebSocket service
│   │   ├── ui/                 # Theme, design tokens
│   │   └── widgets/            # ECG painter, 3D heart painter, form widgets
│   ├── assets/                 # Fonts (Pretendard), app icon
│   ├── android/
│   ├── macos/
│   ├── windows/
│   ├── test/
│   └── pubspec.yaml
├── ai_model/                   # scikit-learn heart disease model + data
├── hardware/                   # ESP32-S3 SuperMini firmware (PlatformIO)
│   └── esp32_s3_supermini/
│       ├── firmware/           # C++: state machine, telemetry sender, offline buffer
│       ├── docs/               # operating-flow.md, wiring.md
│       └── provisioning/
├── docs/                       # Architecture, deployment, setup guide, troubleshooting
│   └── iot/                    # API contract, runbook, UAT checklist, security policy
├── .docs/                      # AGENTS.md, WORKFLOW.md (dev guidelines)
├── .github/workflows/          # CI/CD pipeline, APK build
├── docker-compose.yml
├── Makefile                    # setup, dev, build, test, lint, migrate, seed, deploy
├── render.yaml                 # Render.com deployment config
└── README.md
```

## Chạy Backend + Web Bằng Docker

Yêu cầu:

- Docker Desktop đang chạy.
- Có `.env` ở root hoặc `backend/.env` chứa cấu hình backend thật.
- `DATABASE_URL` trỏ tới database truy cập được từ container.

Tạo file env mẫu nếu chưa có:

```bash
cp .env.docker.example .env
```

Build image:

```bash
docker compose build
```

Chạy backend và web:

```bash
docker compose up -d
```

Kiểm tra trạng thái:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f web
```

URL sau khi chạy:

```text
Backend API: http://localhost:8000
Backend docs: http://localhost:8000/docs
Web: http://localhost:5173
```

### Các câu lệnh quản lý Docker hữu ích

Dưới đây là bảng tổng hợp các lệnh hữu ích để quản lý hệ thống CardioGuard AI khi chạy qua Docker:

| Mục tiêu | Câu lệnh |
| :--- | :--- |
| **Biên dịch & Khởi chạy trực tiếp** | `docker compose up --build` |
| **Chạy dưới chế độ nền (ngầm)** | `docker compose up -d` |
| **Dừng các dịch vụ tạm thời** | `docker compose stop` |
| **Dừng và xóa bỏ container, mạng ảo** | `docker compose down` |
| **Xóa sạch hoàn toàn (cả ổ đĩa Volume dữ liệu)** | `docker compose down -v` |
| **Xem logs trực tiếp toàn bộ hệ thống** | `docker compose logs -f` |
| **Xem logs trực tiếp của Backend** | `docker compose logs -f backend` |
| **Xem logs trực tiếp của Web Frontend** | `docker compose logs -f web` |
| **Truy cập vào Terminal của Backend** | `docker compose exec backend sh` |
| **Gieo dữ liệu mẫu (Seeder) trong Docker** | `docker compose exec backend python seed_data.py` |
| **Giải phóng dung lượng rác của Docker** | `docker system prune -a --volumes` |

Ghi chú:

- `docker-compose.yml` đọc `.env` và `backend/.env` nếu tồn tại.
- Web container cần `VITE_API_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` để build.
- Web container production chạy Node SEO server (`server.js`) inject Open Graph meta từ CMS `domain_links`. Dùng `BACKEND_API_URL` để gọi backend nội bộ, mặc định `http://backend:8000`.
- Không đưa `.env` thật vào image hoặc commit lên git.

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

Tạo `backend/.env` dựa trên `.env.docker.example` (ở root project).

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

- [006_add_device_auth_columns.sql](backend/migrations/006_add_device_auth_columns.sql)

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

Chạy production server có backend injection SEO:

```bash
BACKEND_API_URL=http://localhost:8000 PUBLIC_SITE_URL=https://giatky.site npm run start
```

Server này đọc `dist/index.html`, gọi `/api/cms/domain-links/resolve?path=...`, rồi thay các placeholder `__SEO_*__` bằng dữ liệu DB trước khi trả HTML cho crawler/social preview.

### Biến môi trường web

Tạo `web_frontend/.env` với nội dung:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/realtime
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Mobile App

Mobile app dùng Flutter, Provider, HTTP API, WebSocket realtime, ECG painter và heart painter.

### Chạy mobile

```bash
cd mobile_app
flutter pub get
flutter run
```

Chạy trên điện thoại thật cùng mạng LAN với backend:

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
cd mobile_app
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000
```

Ghi chú:
- `10.0.2.2` chỉ dùng cho Android emulator.
- Có thể override WebSocket riêng nếu cần: `--dart-define=WS_URL=ws://192.168.1.10:8000/ws/realtime`

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

- [hardware/esp32_s3_supermini/firmware](hardware/esp32_s3_supermini/firmware)

Tài liệu vận hành phần cứng:

- [operating-flow.md](hardware/esp32_s3_supermini/docs/operating-flow.md)
- [wiring.md](hardware/esp32_s3_supermini/docs/wiring.md)

### Chạy firmware

Firmware dùng PlatformIO:

```bash
cd hardware/esp32_s3_supermini/firmware
pio run
pio run -t upload
pio device monitor -b 115200
```

Các cấu hình cần chỉnh nằm trong:

- [config.h](hardware/esp32_s3_supermini/firmware/include/config.h)

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

- [API contract](docs/iot/api-contract.md)
- [Runbook](docs/iot/runbook.md)
- [UAT checklist](docs/iot/uat-checklist.md)
- [Security policy](docs/iot/security-policy.md)

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

Thư mục [ai_model](ai_model) chứa dữ liệu và model demo:

- `heart_disease_clean.csv`
- `heart_disease_model.pkl`
- `train_model.py`
- `app.py`

Phần AI realtime hiện tại trong backend chủ yếu là rule-based abnormal detection tại:

- [heart_ai.py](backend/app/ai/heart_ai.py)

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
