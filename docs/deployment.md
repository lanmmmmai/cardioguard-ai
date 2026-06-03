# Hướng Dẫn Triển Khai Production

Hướng dẫn deploy CardioGuard AI ra môi trường production.

---

## 1. Backend (Render)

### 1.1 Chuẩn bị

Repository: `https://github.com/lanmmmmai/cardioguard-ai.git`

Backend được deploy trên Render tại:
`https://cardioguard-ai-backend.onrender.com`

### 1.2 Cấu hình Render

| Setting | Giá trị |
|---------|---------|
| Runtime | Python 3 |
| Build Command | `pip install -r backend/requirements.txt` |
| Start Command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

### 1.3 Biến môi trường Render

| Biến | Bắt buộc | Ghi chú |
|------|---------|---------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL (async) |
| `SECRET_KEY` | ✅ | Tối thiểu 32 ký tự |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | Mặc định 60 |
| `OPENAI_API_KEY` | ❌ | Nếu cần AI chatbot |
| `BREVO_API_KEY` | ❌ | Nếu cần email |
| `SMTP_*` | ❌ | Fallback email |
| `CORS_ORIGINS` | ❌ | Domain được phép CORS |

### 1.4 Deploy

Render auto-deploy từ branch `main`. Để trigger deploy thủ công:

1. Push code lên `main`
2. Render tự động build và deploy
3. Kiểm tra tại `https://cardioguard-ai-backend.onrender.com/health`

---

## 2. Web Frontend (Vercel / Docker)

### 2.1 Deploy lên Vercel

Kết nối repo với Vercel:

| Setting | Giá trị |
|---------|---------|
| Framework | Vite |
| Root Directory | `web_frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node Version | 18+ |

Biến môi trường Vercel:

| Biến | Giá trị |
|------|---------|
| `VITE_API_URL` | `https://cardioguard-ai-backend.onrender.com` |
| `VITE_WS_URL` | `wss://cardioguard-ai-backend.onrender.com/ws/realtime` |

### 2.2 Deploy bằng Docker (Production)

Build image cho production:

```bash
docker build -t cardioguard-web -f web_frontend/Dockerfile web_frontend
```

Chạy:

```bash
docker run -d \
  -p 80:8080 \
  -e BACKEND_API_URL=https://cardioguard-ai-backend.onrender.com \
  -e PUBLIC_SITE_URL=https://giatky.site \
  cardioguard-web
```

### 2.3 SEO Injector

Khi chạy production, web frontend dùng Node.js server để inject SEO metadata:

```bash
BACKEND_API_URL=https://cardioguard-ai-backend.onrender.com \
PUBLIC_SITE_URL=https://giatky.site \
npm run start
```

Server này:
1. Đọc `dist/index.html`
2. Gọi `/api/cms/domain-links/resolve?path=...` từ backend
3. Thay thế `__SEO_*__` placeholder bằng dữ liệu thật
4. Trả HTML hoàn chỉnh cho crawler/social preview

---

## 3. Docker Compose (Full Stack)

### 3.1 File compose

`docker-compose.yml` bao gồm:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
      - backend/.env

  web:
    build:
      context: ./web_frontend
      args:
        VITE_API_URL: http://localhost:8000
        VITE_WS_URL: ws://localhost:8000/ws/realtime
    ports:
      - "5173:8080"
    depends_on:
      backend:
        condition: service_healthy
```

### 3.2 Healthcheck

Backend có healthcheck:

```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

### 3.3 Khởi động

```bash
# Production mode
docker compose -f docker-compose.prod.yml up -d

# Development mode
docker compose up --build
```

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions

File: `.github/workflows/build-apk.yml`

Trigger: Push to `main` hoặc `workflow_dispatch`

**Steps:**
1. Checkout code
2. Setup Java 17 + Flutter 3.44.0
3. `flutter pub get`
4. Build APK release
5. Upload APK artifact

### 4.2 Quy trình deploy chuẩn

```text
Local Dev → Push to phuc-bang → PR → Merge to main
                                        │
                                        ▼
                              Auto-deploy:
                              - Render: Backend
                              - Vercel: Web Frontend
                              - GitHub Actions: Mobile APK
```

---

## 5. Kiểm Tra Sau Deploy

### 5.1 Backend

```bash
# Health check
curl https://cardioguard-ai-backend.onrender.com/health

# API test
curl https://cardioguard-ai-backend.onrender.com/docs
```

### 5.2 Web

```bash
# Kiểm tra web
curl -I https://giatky.site

# Kiểm tra SEO metadata
curl https://giatky.site/ | grep -i "og:title\|og:description"
```

### 5.3 Database

```bash
# Kiểm tra kết nối DB
docker compose exec backend python -c "
from app.core.database import database
import asyncio
result = asyncio.run(database.fetch_one('SELECT 1'))
print('DB OK:', result)
"
```

---

## 6. Biến Môi Trường Production

### 6.1 Backend `.env`

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:6543/postgres
SECRET_KEY=<strong-random-32-char-min>
ACCESS_TOKEN_EXPIRE_MINUTES=60
EXPOSE_DEV_OTP=false
IOT_DEVICE_SHARED_TOKEN=
OPENAI_API_KEY=
BREVO_API_KEY=
SMTP_SERVER=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
CORS_ORIGINS=https://giatky.site
```

### 6.2 Lưu ý bảo mật

- ❌ Không commit `.env` lên git
- ❌ Không lộ token/secret trong log
- ❌ Không dùng shared token IoT trong production
- ✅ Dùng per-device token (`device_token_hash`)
- ✅ Bật rate limiting
- ✅ Kiểm tra CORS chỉ cho phép domain đã biết
