# Xử Lý Sự Cố CardioGuard AI

Tổng hợp các lỗi thường gặp và cách khắc phục.

---

## 1. Docker & Container

### 1.1 Container không khởi động được

```bash
# Kiểm tra log
docker compose logs -f backend
docker compose logs -f web
```

**Lỗi thường gặp:**

| Log message | Nguyên nhân | Fix |
|-------------|------------|-----|
| `Cannot connect to database` | DATABASE_URL sai hoặc DB không reachable | Kiểm tra `.env`, ping DB |
| `SECRET_KEY not set` | Thiếu SECRET_KEY | Thêm vào `backend/.env` |
| `port is already allocated` | Port conflict | `docker compose stop`, kiểm tra port |
| `ModuleNotFoundError` | Thiếu dependency | `docker compose build --no-cache` |
| `service "web" depends on "backend"` | Backend chưa ready | Đợi backend healthy (khoảng 15s) |

### 1.2 Backend startup timeout

**Triệu chứng:** Web frontend báo lỗi `ECONNREFUSED` khi gọi backend

**Fix:** Đợi backend khoảng 15-20s cho migration chạy xong. Hoặc kiểm tra:

```bash
docker compose logs backend | grep "Application startup complete"
```

Nếu không thấy dòng này, backend chưa sẵn sàng.

### 1.3 Web container restart loop

```bash
# Kiểm tra nếu web không thể kết nối backend
docker compose logs web | grep -i "error\|warn\|fail"
```

**Fix:** Đảm bảo backend đã healthy trước. Nếu vẫn lỗi, rebuild:

```bash
docker compose down -v
docker compose up --build
```

### 1.4 Database migration lỗi

**Triệu chứng:** Backend log có `Migration failed` hoặc `relation "xxx" does not exist`

**Fix:** Chạy migration thủ công:

```bash
docker compose exec backend python scripts/run_all_migrations.py
```

Kiểm tra migration đã chạy:

```bash
docker compose exec backend python -c "from app.core.database import database; import asyncio; print(asyncio.run(database.fetch_all('SELECT * FROM schema_migrations')))"
```

---

## 2. Database

### 2.1 Kết nối database thất bại

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `connection refused` | DB chưa chạy | Kiểm tra Docker/DB server |
| `password authentication failed` | Sai user/password | Kiểm tra `DATABASE_URL` |
| `database "xxx" does not exist` | Chưa tạo database | `CREATE DATABASE cardioguard;` |
| `SSL connection required` | Supabase yêu cầu SSL | Dùng đúng `DATABASE_URL` từ Supabase |

### 2.2 Query timeout

**Triệu chứng:** API trả về 500 hoặc timeout sau 30s

**Nguyên nhân thường gặp:**
- Missing index trên cột hay query
- Connection pool cạn (quá nhiều request đồng thời)
- Dữ liệu quá lớn không có pagination

**Fix:**
- Kiểm tra slow query log
- Thêm index nếu cần
- Dùng pagination (limit/offset)

---

## 3. Backend

### 3.1 Lỗi xác thực

| HTTP Status | Ý nghĩa | Nguyên nhân | Fix |
|-------------|---------|-------------|-----|
| 401 | Unauthorized | Token hết hạn hoặc sai | Login lại |
| 403 | Forbidden | Không đủ quyền | Kiểm tra role |
| 422 | Validation Error | Request body sai format | Kiểm tra schema |
| 429 | Rate Limited | Gửi quá nhiều request | Chờ 60s |
| 404 | Not Found | API endpoint sai prefix (thiếu `/api`) | Kiểm tra URL endpoint |

### 3.2 OTP không gửi được

**Kiểm tra:**
1. Backend log có `OTP created` không?
2. Cấu hình email (Brevo/SMTP) đã đúng chưa?
3. Nếu `EXPOSE_DEV_OTP=true`, OTP hiện trong backend log

### 3.3 AI Chatbot trả lời mock

**Triệu chứng:** Chatbot luôn trả lời "chế độ mô phỏng"

**Nguyên nhân:** `OPENAI_API_KEY` chưa được cấu hình hoặc key không hợp lệ

**Fix:** Thêm `OPENAI_API_KEY` vào `backend/.env` và restart.

---

## 4. Web Frontend

### 4.1 Lỗi build

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `Cannot find module` | Thiếu node_modules | `npm install` |
| `Type error` | TypeScript type mismatch | Kiểm tra type |
| `VITE_API_URL not set` | Thiếu env | Tạo `web_frontend/.env` |
| `Build failed` | Lỗi syntax | `npm run build -- --debug` |

### 4.2 WebSocket không kết nối

**Kiểm tra:**
1. `VITE_WS_URL` đã đúng chưa? (`ws://localhost:8000/ws/realtime`)
2. Backend đang chạy không?
3. Console browser có lỗi không?

**Fix phổ biến:**
- Nếu chạy backend ở local: dùng `ws://localhost:8000/ws/realtime`
- Nếu chạy Docker: Web dùng `ws://backend:8000/ws/realtime` qua Express server

### 4.3 Supabase client lỗi

**Triệu chứng:** Console browser báo `Supabase client not initialized` hoặc auth không hoạt động

**Nguyên nhân:** Thiếu `VITE_SUPABASE_URL` hoặc `VITE_SUPABASE_ANON_KEY` trong env

**Fix:**
```bash
# Thêm vào web_frontend/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> Nếu dùng Docker, thêm 2 biến này vào `docker-compose.yml` dưới `web.build.args`.

### 4.4 SEO injector không hoạt động

**Triệu chứng:** Social preview không hiển thị đúng

**Kiểm tra:**
```bash
curl http://localhost:5173/ 2>&1 | head -20
```
Nếu thấy `__SEO_*__` trong HTML nghĩa là SEO injector chưa chạy.

**Fix:** Chạy web với `npm run start` thay vì `npm run dev`.

---

## 5. Mobile App

### 5.1 Không kết nối được backend

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `Connection refused` | Backend không chạy | Kiểm tra backend |
| `SocketException` | Sai địa chỉ IP | Dùng `--dart-define=API_BASE_URL=http://<IP>:8000` |
| `HandshakeException` | SSL sai | Nếu dev local, dùng HTTP |

### 5.2 Flutter analyze lỗi

```bash
flutter clean
flutter pub get
flutter analyze
```

### 5.3 Build APK thất bại

```bash
# Kiểm tra Java version
java -version  # Cần Java 17+

# Xóa cache
flutter clean
rm -rf ~/.gradle/caches/
flutter pub get
flutter build apk --release
```

---

## 6. IoT / ESP32

### 6.1 Firmware không flash được

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `Failed to connect` | Sai port/baud | Kiểm tra cổng COM |
| `A fatal error occurred` | Chip ở chế độ download | Nhấn nút BOOT khi flash |
| `Timed out waiting for packet` | Nhiễu serial | Giảm baud rate |

### 6.2 ESP32 không gửi được telemetry

**Kiểm tra:**
1. Serial monitor: ESP32 có boot và hiển thị `[CardioGuard]` log không?
2. WiFi đã kết nối? (log `WiFi connected!`)
3. Token đã đúng? (nếu sai → `AUTH_FAILED: token rejected`)
4. Endpoint URL đã đúng? (protocol, host, port, path)

### 6.3 ESP32 offline buffer

**Triệu chứng:** Dashboard không thấy dữ liệu mới nhưng ESP32 vẫn chạy

**Fix:**
- Kiểm tra WiFi: ESP32 có reconnect không?
- Kiểm tra backend: có nhận request không?
- Kiểm tra log: `send_result.buffered=true` nếu đang buffer offline

---

## 7. Docker Compose Commands

```bash
# Xem trạng thái
docker compose ps

# Xem log realtime
docker compose logs -f

# Restart một service
docker compose restart backend

# Rebuild và chạy
docker compose up --build

# Xóa hoàn toàn
docker compose down -v

# Dọn dẹp docker
docker system prune -a --volumes
```

## 8. Liên Hệ

Nếu không tìm thấy giải pháp trong tài liệu này, kiểm tra:

1. Log của service gặp lỗi
2. File `docs/iot/runbook.md` nếu là vấn đề IoT
3. File `docs/iot/uat-checklist.md` để kiểm tra end-to-end
