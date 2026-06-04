# Hướng Dẫn Cài Đặt CardioGuard AI

Hướng dẫn từng bước để thiết lập môi trường phát triển CardioGuard AI trên máy local.

---

## 1. Yêu Cầu Hệ Thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---------|-------------------|---------|
| Python | 3.11+ | Backend |
| Node.js | 18+ | Web Frontend |
| Flutter | 3.38+ | Mobile App |
| Docker Desktop | 24+ | Chạy backend + web (khuyên dùng) |
| Git | 2.40+ | Quản lý phiên bản |

## 2. Clone Repository

```bash
git clone https://github.com/lanmmmmai/cardioguard-ai.git
cd cardioguard-ai
```

## 3. Cấu Hình Biến Môi Trường

Tạo file `.env` ở thư mục gốc:

```bash
cp .env.docker.example .env
```

Tạo file `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

### Các biến bắt buộc trong `backend/.env`:

| Biến | Mô tả | Ví dụ |
|------|-------|-------|
| `DATABASE_URL` | URL kết nối PostgreSQL (async) | `postgresql+asyncpg://user:pass@host:5432/cardioguard` |
| `SECRET_KEY` | Khóa bí mật JWT (tối thiểu 32 ký tự) | `your-strong-random-secret-key-here` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Thời hạn token (phút) | `60` |

### Các biến tùy chọn:

| Biến | Mô tả |
|------|-------|
| `OPENAI_API_KEY` | API key OpenAI cho AI chatbot (nếu không có, hệ thống chạy mock) |
| `BREVO_API_KEY` | API key Brevo cho email service |
| `SMTP_*` | Cấu hình SMTP (dùng nếu không có Brevo) |
| `EXPOSE_DEV_OTP` | `true` để hiển thị OTP trong log dev |
| `IOT_DEVICE_SHARED_TOKEN` | Shared token fallback cho IoT (dev only) |

## 4. Chạy Bằng Docker (Khuyên Dùng)

Build và chạy backend + web:

```bash
docker compose up --build
```

Sau khi container khởi động:

| Dịch vụ | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| Web Dashboard | http://localhost:5173 |

Kiểm tra health:

```bash
curl http://localhost:8000/health
```

Xem log:

```bash
docker compose logs -f backend
docker compose logs -f web
```

## 5. Chạy Backend Không Docker

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Chạy Migration

```bash
cd backend
python scripts/run_all_migrations.py
```

### Seed Dữ Liệu Mẫu

```bash
cd backend
python scripts/seed_data.py
```

## 6. Chạy Web Frontend Không Docker

```bash
cd web_frontend
npm install
npm run dev
```

Tạo `web_frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/realtime
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Lưu ý:** Web frontend cần `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` cho chức năng Supabase auth. Nếu chưa có, vào [Supabase Dashboard](https://supabase.com) → Project Settings → API để lấy.

## 7. Chạy Mobile App

```bash
cd mobile_app
flutter pub get
flutter run
```

Chạy trên thiết bị thật cùng mạng LAN:

```bash
# Backend chạy ở chế độ 0.0.0.0
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Mobile trỏ tới IP backend
cd mobile_app
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000
```

## 8. Firmware ESP32

Xem hướng dẫn chi tiết tại: `hardware/esp32_s3_supermini/README.md`

Cài đặt PlatformIO trong VS Code, sau đó:

```bash
cd hardware/esp32_s3_supermini/firmware
# Sửa config.h với thông tin WiFi và endpoint
# Build và flash
pio run -t upload
# Monitor
pio device monitor -b 115200
```

## 9. Kiểm Tra Nhanh

```bash
# Backend syntax
python -m compileall backend/app

# Web build
cd web_frontend && npm run build

# Flutter analyze
cd mobile_app && flutter analyze

# Firmware build
cd hardware/esp32_s3_supermini/firmware && pio run
```

## 10. Cấu Trúc File Env

```
cardioguard-ai/
├── .env                      # (tùy chọn) biến dùng chung, docker-compose đọc
├── backend/
│   └── .env                  # Biến backend (DATABASE_URL, SECRET_KEY, ...)
└── web_frontend/
    └── .env                  # Biến web (VITE_API_URL, VITE_WS_URL)
```

## Xử Lý Lỗi Thường Gặp Khi Cài Đặt

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `Port 8000 already in use` | Có process khác chiếm port | Đổi port hoặc kill process |
| `DATABASE_URL not set` | Thiếu file `.env` | Copy `.env.docker.example` và điền thông tin |
| `Cannot connect to database` | DB chưa chạy hoặc sai URL | Kiểm tra Docker/URL |
| `npm ERR!` | Thiếu dependencies | `rm -rf node_modules && npm install` |
| `flutter: Cannot find "flutter"` | Flutter chưa cài | Cài Flutter SDK |
