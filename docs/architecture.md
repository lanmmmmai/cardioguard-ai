# Kiến Trúc Hệ Thống CardioGuard AI

Tổng quan kiến trúc, luồng dữ liệu và cách các thành phần giao tiếp với nhau.

---

## 1. Tổng Quan

CardioGuard AI là hệ thống giám sát sức khỏe đa nền tảng gồm 4 thành phần chính:

```text
┌─────────────────────────────────────────────────────────┐
│                     Người Dùng                           │
│  (Patient / Doctor / Admin)                             │
└────┬────────────┬──────────────────┬───────────────────┘
     │            │                  │
     ▼            ▼                  ▼
┌─────────┐ ┌──────────┐ ┌──────────────────┐
│ Web App │ │ Mobile   │ │  IoT Device      │
│ (React) │ │ (Flutter)│ │  (ESP32-S3)      │
├─────────┤ ├──────────┤ ├──────────────────┤
│ :5173   │ │ :App     │ │  Serial/WiFi     │
└────┬────┘ └────┬─────┘ └────────┬─────────┘
     │           │                 │
     │  HTTP/WS  │  HTTP/WS       │  HTTP
     ▼           ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                     │
│  :8000                                                   │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ REST    │ │ WebSocket│ │ AI     │ │ Background   │  │
│  │ API     │ │ Manager  │ │ Service│ │ Tasks        │  │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬───────┘  │
│       │           │           │              │          │
│       ▼           ▼           ▼              ▼          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Database Layer (Asyncpg + SQLAlchemy)    │   │
│  └──────────────────────┬───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   PostgreSQL         │
              │   (Supabase)         │
              └──────────────────────┘
```

## 2. Thành Phần Chi Tiết

### 2.1 Backend (Python / FastAPI)

**Port:** `8000`

| Layer | Công nghệ | Chức năng |
|-------|----------|-----------|
| API Router | FastAPI | 14 routers: auth, user, patient, sensor, alert, crud, cms, email, chat, feature, profile, admin_doctor, realtime |
| WebSocket | Connection Manager | Realtime role-aware: health_metrics, alerts, chat, appointments |
| Auth | JWT (HS256) + OTP (HMAC-SHA256) | Xác thực JWT, OTP email verification |
| AI | Rule-based (heart_ai) + OpenAI / Mock | Anomaly detection + chatbot |
| Database | SQLAlchemy async + asyncpg + `databases` | Async PostgreSQL queries |
| Security | Rate limiter, bcrypt, password policy, revoked tokens | Bảo vệ API |
| IoT Ingest | HTTP endpoint | Nhận telemetry từ thiết bị ESP32 |

**Cấu trúc thư mục:**

```
backend/app/
├── api/                    # REST endpoint handlers
│   ├── auth_api.py         # Login, register, OTP, password
│   ├── user_api.py         # User management
│   ├── patient_api.py      # Patient CRUD
│   ├── sensor_api.py       # Sensor data + IoT telemetry
│   ├── alert_api.py        # Alert endpoints
│   ├── chat_api.py         # Chat/AI endpoints
│   ├── crud_api.py         # Generic CRUD for 16+ tables
│   ├── cms_api.py          # CMS: domain links, email templates, data tables
│   ├── email_api.py        # Email template management, sending
│   ├── profile_api.py      # Avatar upload, profile update
│   ├── feature_api.py      # Feature flags
│   ├── admin_doctor_api.py # Doctor verification, management
│   └── realtime_api.py     # WebSocket handler
├── ai/                     # Rule-based abnormal detection (heart_ai.py)
├── core/                   # Config, database, security, rate_limit, password_policy
├── models/                 # SQLAlchemy ORM models
├── schemas/                # Pydantic request/response schemas
├── services/               # Email, OTP, AI service, audit, db_optimization
└── websocket/              # WebSocket connection manager (role-aware)
```

### 2.2 Web Frontend (React / TypeScript / Vite)

**Port:** `5173`

| Layer | Công nghệ | Chức năng |
|-------|----------|-----------|
| UI | React 18 + TypeScript | Dashboard components |
| Build | Vite | Dev server + production build |
| Icons | lucide-react | UI icons |
| Auth | AuthContext | JWT token management |
| WebSocket | useWebSocket hook | Realtime data |
| SEO | Node injector server | Server-side Open Graph injection |

**Luồng dữ liệu:**

```
User Action → Component → API Service → Backend → Response → Component Re-render
                                ↕
                         WebSocket Hook ← Health Metrics / Alerts
```

### 2.3 Mobile App (Flutter / Dart)

| Layer | Công nghệ | Chức năng |
|-------|----------|-----------|
| State Management | Provider | ChangeNotifier pattern |
| HTTP | Dio | REST API calls |
| WebSocket | web_socket_channel | Realtime telemetry |
| UI | Material Design 3 | Bệnh nhân, bác sĩ, admin screens |
| Custom Widgets | CustomPainter | ECG painter, 3D heart painter |

**Cấu trúc:**

```
mobile_app/lib/
├── core/            # API client, app logger, constants
├── providers/       # State management (auth, telemetry, alerts, ...)
├── screens/         # UI screens per role
├── services/        # WebSocket, notification services
└── widgets/         # Reusable widgets (ECG, 3D heart)
```

### 2.4 IoT Hardware (ESP32-S3 SuperMini)

| Thành phần | Công nghệ | Chức năng |
|-----------|----------|-----------|
| MCU | ESP32-S3 | Xử lý trung tâm |
| Firmware | PlatformIO / Arduino | C++ code |
| Kết nối | WiFi + HTTP | Gửi telemetry lên backend |
| Offline | Buffer FIFO | Lưu tạm khi mất mạng |
| Backoff | Exponential | Tránh spam khi backend lỗi |

## 3. Luồng Dữ Liệu Chính

### 3.1 Authentication Flow

```text
Client                    Backend                     Database
  │                         │                          │
  │── POST /auth/login ────→│                          │
  │   {email, password}     │── SELECT user ──────────→│
  │                         │←── user data ────────────│
  │                         │── verify_password()      │
  │                         │── create JWT token       │
  │←── {access_token} ──────│                          │
  │                         │                          │
  │── GET /auth/me ────────→│                          │
  │   Authorization: JWT    │── verify token           │
  │                         │── SELECT user ──────────→│
  │←── user profile ────────│                          │
```

### 3.2 Telemetry Flow (IoT → Web/Mobile)

```text
ESP32                   Backend                   DB & WebSocket
  │                       │                          │
  │── POST /iot/telemetry─→│                          │
  │   {hr, spo2, bp, ecg}  │── Auth device token     │
  │                        │── Map MAC → patient     │
  │                        │── INSERT sensor_data ───→│
  │                        │── Abnormal detection    │
  │                        │── INSERT alert (if any)─→│
  │                        │                          │
  │                        │── WS broadcast ─────────→│
  │                        │   {health_metrics}       │ Web/Mobile
  │←── 200 OK ─────────────│                          │
```

### 3.3 WebSocket Realtime Flow

```text
Client (Web/Mobile)        Backend WS Manager          DB / Other Clients
  │                           │                          │
  │── WS Connect ────────────→│                          │
  │   ?token=JWT              │── verify JWT             │
  │                           │── register connection    │
  │←── connected ─────────────│                          │
  │                           │                          │
  │                           │←── New sensor_data ──────│ DB Trigger
  │                           │── broadcast_sensor_data  │
  │←── {health_metrics} ──────│                          │
  │                           │                          │
  │                           │←── New alert ───────────│ DB Trigger
  │                           │── broadcast_alert        │
  │←── {alert} ──────────────│                          │
```

## 4. Database Schema (Chính)

| Table | Mục đích | Ghi chú |
|-------|---------|---------|
| `users` | User accounts | `role`: patient/doctor/admin |
| `patients` | Patient profiles | 1-1 với users |
| `doctor_patients` | Phân công bác sĩ - bệnh nhân | N-N |
| `sensor_data` | Dữ liệu cảm biến | Heart rate, SpO2, BP, ECG |
| `alerts` | Cảnh báo bất thường | LOW_SPO2, HIGH_HEART_RATE, ... |
| `chatbot_messages` | Lịch sử chat AI | |
| `devices` | Thiết bị IoT | MAC, token hash, status |
| `appointments` | Lịch hẹn khám | |
| `email_logs` | Log gửi email | Audit trail |
| `medical_records` | Hồ sơ bệnh án | |
| `domain_links` | SEO domain links | |

## 5. Công Nghệ & Phiên Bản

| Thành phần | Công nghệ | Phiên bản |
|-----------|-----------|-----------|
| Backend Framework | FastAPI | 0.115+ |
| Database | PostgreSQL (Supabase) | 15+ |
| Database Driver | asyncpg | 0.30+ |
| ORM | SQLAlchemy | 2.0+ |
| JWT | python-jose | 3.3+ |
| Frontend Framework | React | 18+ |
| Build Tool | Vite | 8+ |
| Mobile Framework | Flutter | 3.38+ |
| State Management | Provider | 6+ |
| HTTP (Mobile) | Dio | 5+ |
| MCU | ESP32-S3 | - |
| Container | Docker | 24+ |

## 6. Mô Hình Bảo Mật

```text
Request → Rate Limit → JWT Verify → Role Check → Handler → Response
              │             │            │
              ▼             ▼            ▼
         429 Too Many    401         403 Forbidden
         Requests       Unauthorized
```

- **Rate Limit**: IP + email + endpoint, cửa sổ trượt 60s
- **JWT**: HS256, thời hạn configurable, có JTI chống replay
- **RBAC**: 3 role (patient, doctor, admin), kiểm tra trên từng endpoint
- **IoT Auth**: Token riêng từng thiết bị, hash trong DB, MAC mapping
