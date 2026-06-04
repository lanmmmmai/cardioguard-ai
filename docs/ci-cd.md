# CI/CD Pipeline

CardioGuard có 2 GitHub Actions workflows: CI/CD pipeline và build APK.

## CI/CD Pipeline

**File:** `.github/workflows/ci-cd.yml`

### Trigger

- Push hoặc PR vào `main` / `phuc-bang`

### Jobs

| Job | Steps | Notes |
|-----|-------|-------|
| **backend-check** | Python 3.11 → pip install → `compileall` syntax check → import check | Không chạy unit test, không chạy linter |
| **frontend-check** | Node.js 20 → npm install → `npm run lint` → `npx tsc --noEmit` → `npm run build` | Không chạy `npm test` |
| **docker-check** | Build backend Docker image → Build web Docker image | Phụ thuộc cả 2 job trên |
| **deploy-notify** | Print deploy info | Chỉ chạy khi push `main`. Deploy thực tế qua Render/Vercel auto-deploy |

## Build APK

**File:** `.github/workflows/build-apk.yml`

### Trigger

- `workflow_dispatch` hoặc push `main`

### Steps

1. Setup Java 17 (temurin)
2. Setup Flutter 3.44.0 (stable)
3. `flutter clean && flutter pub get`
4. Optional: decode keystore
5. `flutter build apk --release`
6. Upload APK artifact

> Không chạy `flutter test`.

## Makefile Commands

| Command | Mô tả |
|---------|-------|
| `make test` | Chạy frontend tests (vitest) |
| `make test-backend` | Chạy backend tests (pytest) |
| `make test-frontend` | `npm test` (vitest) |
| `make lint` | Lint frontend (ESLint) |
| `make lint-frontend` | ESLint `--max-warnings 0` |
| `make lint-backend` | ruff (nếu cài) |

## Deploy Flow

```
Local Dev → Push → PR → Merge to main
                            │
                            ▼
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Render         Vercel       GitHub Actions
        (Backend)     (Frontend)      (Mobile APK)
```

- **Backend:** Render auto-deploy Docker từ branch `main`. Cấu hình trong `render.yaml`.
- **Frontend:** Vercel auto-deploy từ `web_frontend/`. Biến môi trường cấu hình trong Vercel Dashboard.
- **Mobile:** GitHub Actions build APK, upload artifact.

## Hạn chế

- **Không chạy test trong CI**: Cả backend test, frontend test, mobile test đều không được chạy
- **Không backend linter**: `ruff` không được cài trong CI
- **Không coverage**: Không có coverage report
- **Không e2e test**: Không có Playwright/Cypress
