# Quy Trình Phát Triển

Hướng dẫn quy trình làm việc, commit, code review và test cho dự án CardioGuard AI.

---

## 1. Quy Trình Chung

```text
1. Chọn issue từ CODE_REVIEW.md hoặc task mới
2. Tạo nhánh từ phuc-bang
3. Code + Test
4. Chạy verify (lint, build, test)
5. Commit theo Conventional Commits
6. Push và tạo PR vào phuc-bang
7. Code Review
8. Merge vào phuc-bang
9. Merge phuc-bang → main (khi ổn định)
```

## 2. Branch Strategy

| Branch | Mục đích | Protect |
|--------|---------|---------|
| `main` | Production-ready, auto-deploy | ✅ |
| `phuc-bang` | Development chính, feature integration | ✅ |
| `feat/*` | Feature nhánh con | ❌ |
| `fix/*` | Bug fix nhánh con | ❌ |

**Quy tắc:**
- Không commit trực tiếp lên `main` hoặc `phuc-bang`
- Luôn tạo nhánh từ `phuc-bang` cho công việc mới
- Xoá nhánh con sau khi merge

## 3. Coding Standards

Tuân theo skill `cardioguard-code-standards`:

- **File header**: Mỗi file phải có header comment mô tả mục đích, luồng xử lý, quan hệ
- **Docstrings**: Google Style (Python), JSDoc (TypeScript), /// (Dart)
- **Type hints**: Bắt buộc Python + TypeScript
- **Imports**: Theo thứ tự: standard lib → third-party → local
- **Logging**: Chi tiết mọi function, branch, API call, state change (xem `cardioguard-error-debugging`)

### Commit Format

```
<type>(<scope>): <short description>

<body>  ← optional
```

**Type:** `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`, `perf`
**Scope:** `backend`, `web`, `mobile`, `hardware`, `ai`, `docs`, `config`, `deps`

**Ví dụ:**
```
feat(backend): add OTP rate limiting per IP
fix(web): correct vitals chart y-axis scale
test(mobile): add WebSocket reconnection tests
```

### Checklist Trước Commit

- [ ] Không còn `print()` / `console.log()` debug
- [ ] Đã chạy lint/analyze
- [ ] Đã build thử
- [ ] Đã thêm logging đầy đủ
- [ ] Đã test (nếu viết test mới)

## 4. Issue-Fix Workflow

Xem chi tiết tại [WORKFLOW.md](/.docs/WORKFLOW.md). Tóm tắt:

### Step 1: Đọc hiểu issue
- Đọc kỹ mô tả lỗi/yêu cầu
- Xác định module bị ảnh hưởng
- Đọc file liên quan

### Step 2: Reproduce
- Xác định input/output gây lỗi
- Chạy log để capture stack trace

### Step 3: Fix
- Sửa code đúng nguyên nhân gốc
- Thêm logging nếu cần

### Step 4: Verify
- Chạy backend: kiểm tra API endpoint
- Chạy web: `npm run build`
- Chạy mobile: `flutter analyze`

### Step 5: Commit
- Commit ngay sau khi verify xong
- Không để unstaged changes cuối session

## 5. Testing

Xem chi tiết tại skill `cardioguard-testing-standards`.

### Framework theo module

| Module | Framework | Command |
|--------|-----------|---------|
| Backend | Python `unittest` | `python -m unittest discover -s tests` |
| Web Frontend | Vitest | `npx vitest run` |
| Mobile App | `flutter_test` | `flutter test` |

### Khi nào viết test

- **Core logic**: Bắt buộc (auth, security, models)
- **Schema validation**: Bắt buộc
- **Service (có mock)**: Khuyến khích
- **Smoke test tạm**: Xoá sau khi chạy (không commit)

### Test Lifecycle

1. Viết test
2. Chạy thử (pass/fail đúng kỳ vọng)
3. Phân loại:
   - **Quan trọng** → Giữ lại + thêm hướng dẫn chạy trong file test
   - **Không quan trọng** → Xoá sau khi xác nhận pass

## 6. Code Review

- Kiểm tra logging đã đầy đủ chưa
- Kiểm tra security (không leak token/PII)
- Kiểm tra không có debug code
- Kiểm tra tuân thủ code standards

## 7. Khi Gặp Lỗi

```text
1. Đọc stack trace → xác định file + dòng
2. Phân loại lỗi (DataError, TypeError, ConnectionError...)
3. Đọc code 20 dòng xung quanh vị trí lỗi
4. Sửa + verify
5. Commit
```

Xem skill `cardioguard-error-debugging` cho chi tiết.

## 8. Công Cụ Hỗ Trợ

| Mục đích | Command |
|----------|---------|
| Backend syntax check | `python -m compileall backend/app` |
| Web build | `npm run build` (trong `web_frontend/`) |
| Flutter analyze | `flutter analyze` (trong `mobile_app/`) |
| Firmware build | `pio run` (trong `hardware/.../firmware/`) |
| Migration | `python scripts/run_all_migrations.py` |
| Seed data | `python scripts/seed_data.py` |
| Docker rebuild | `docker compose up --build` |

## 9. Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, asyncpg |
| Web | React 18, TypeScript, Vite, lucide-react |
| Mobile | Flutter 3.44+, Provider, Dio |
| Database | PostgreSQL 15+ (Supabase) |
| Hardware | ESP32-S3, PlatformIO, Arduino |
| AI | OpenAI API / Rule-based mock |
| CI/CD | GitHub Actions, Render, Vercel |
| Container | Docker, Docker Compose |
