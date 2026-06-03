# CardioGuard AI — Danh sách Lỗi & Issues

> Đánh giá ngày: 2026-06-03
> Ưu tiên: Backend → Frontend → Mobile
>
> Ghi chú trạng thái: một số lỗi runtime đã được xử lý trong nhánh hiện tại.
> Đặc biệt, các API dashboard bệnh nhân (`/api/patients`, `/api/alerts`,
> `/api/sensor-data`, `/api/sensors/history`) đã chạy ổn định lại; phần
> Supabase của frontend cũng đã được cấp biến môi trường thật thay vì
> `example.supabase.co`.

---

## Tổng quan

| Layer | Critical | High | Medium | Low | Tổng |
|-------|----------|------|--------|-----|------|
| Backend | 3 | 7 | 12 | 11 | 33 |
| Frontend | 4 | 8 | 17 | 8 | 37 |
| Mobile | 5 | 9 | 10 | 11 | 35 |
| **Tổng** | **12** | **24** | **39** | **30** | **105** |

## Đã Xử Lý

Các lỗi dưới đây là những mục quan trọng đã được xác minh là đã khắc phục trong
nhánh hiện tại:

- Backend dashboard không còn trả `500` ở các endpoint bệnh nhân/cảnh báo/cảm biến.
- Endpoint lịch sử cảm biến `/api/sensors/history` đã trả `200` với CORS đúng.
- Frontend không còn trỏ vào `https://example.supabase.co` khi build cục bộ.
- Audit log timezone issue đã được sửa để tránh lỗi ghi `audit_logs`.

---

# 1. BACKEND (Ưu tiên cao nhất)

## CRITICAL

### B-01: Secrets hardcoded trong `.env` commit lên Git
- **File:** `backend/.env:1-20`
- **Mô tả:** Database password, SMTP password, Brevo API key, OpenAI API key đều nằm trong `.env` và có thể bị commit lên Git. Đây là lỗ hổng bảo mật nghiêm trọng, đặc biệt với healthcare app (HIPAA).
- **Fix:** Xóa `.env` khỏi Git history, thêm vào `.gitignore`, rotate tất cả credentials ngay lập tức.

### B-02: Duplicate router registration trong `main.py`
- **File:** `backend/app/main.py:207-233`
- **Mô tả:** `cms_router` được include **3 lần** và nhiều router được include **2 lần** (1 lần không prefix, 1 lần với `/api/`). Tạo duplicate routes, gây confusion cho API consumers.
- **Fix:** Kiểm tra và remove duplicate router registrations. Mỗi router chỉ nên include 1 lần.

### B-03: Rate limiter là in-memory dict không giới hạn (Memory Leak)
- **File:** `backend/app/core/rate_limit.py:26-82`
- **Mô tả:** `_rate_limits` dict grows không giới hạn. Old entries chỉ được cleanup khi check_rate_limit() được gọi cho key đó. Dưới sustained attack, memory sẽ tăng vô hạn.
- **Fix:** Implement periodic cleanup hoặc dùng bounded LRU cache với TTL.

## HIGH

### B-04: User cache bỏ qua revoked token check
- **File:** `backend/app/api/auth_api.py:186-202`
- **Mô tả:** Khi user nằm trong `_user_cache`, function return ngay mà **không kiểm tra** token đã bị revoke chưa. User logout (revoked JTI) vẫn authenticated trong 30s.
- **Fix:** Di chuyển revoked token check ra ngoài cache block, hoặc invalidate cache entry khi revoke token.

### B-05: OTP không bị invalidate sau registration thành công
- **File:** `backend/app/api/auth_api.py:401-521`
- **Mô tả:** Sau khi register thành công, OTP token không được gọi `invalidate_otp_tokens()`. OTP có thể bị replay (dù `consumed_at` đã partially mitigate).
- **Fix:** Gọi `await invalidate_otp_tokens(purpose=OTP_PURPOSE_REGISTER, email=email)` sau registration.

### B-06: WebSocket không kiểm tra revoked token
- **File:** `backend/app/api/realtime_api.py:114-155`
- **Mô tả:** WebSocket decode JWT và verify user nhưng **không check** JTI đã bị revoke chưa. User logout nhưng WebSocket connection vẫn active.
- **Fix:** Thêm revoked_tokens check sau khi decode JWT.

### B-07: `change_password` không validate password strength
- **File:** `backend/app/api/auth_api.py:863-949`
- **Mô tả:** `ChangePasswordRequest` có `new_password: str` nhưng không dùng `validate_password()`. User có thể đổi sang password yếu như "1".
- **Fix:** Thêm `@field_validator("new_password")` với `validate_password`.

### B-08: CORS regex quá broad
- **File:** `backend/app/main.py:91-95`
- **Mô tả:** Regex `r"^(https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?"` cho phép bất kỳ private IP nào với bất kỳ port. `vercel\.app` match mọi subdomain.
- **Fix:** Whitelist cụ thể những origins cần thiết.

### B-09: `verify_forgot_password_otp` thiếu password validation
- **File:** `backend/app/api/auth_api.py:768-860`
- **Mô tả:** Khi `data.new_password` được cung cấp, nó được dùng trực tiếp mà không qua `validate_password()`.
- **Fix:** Luôn validate password qua `validate_password()`.

### B-10: File download cho phép upload không giới hạn số lượng
- **File:** `backend/app/api/profile_api.py:345-394`
- **Mô tả:** Có limit 5MB nhưng không limit số lượng upload per user. Attacker có thể fill disk.
- **Fix:** Implement per-user upload quotas.

### B-11: `_periodic_mv_refresh` không bị cancel khi shutdown
- **File:** `backend/app/main.py:102-206`
- **Mô tả:** `_mv_refresh_task` created on startup nhưng không cancel trong shutdown handler. Gây lỗi khi graceful shutdown.
- **Fix:** Cancel task trong shutdown() trước khi disconnect database.

## MEDIUM

### B-12: `connect_db` nuốt exception information
- **File:** `backend/app/core/database.py:44-52`
- **Mô tả:** `disconnect_db` catch all exceptions và **im lặng nuốt** chúng, có thể ẩn đi cleanup issues.
- **Fix:** Log exception hoặc re-raise.

### B-13: `get_sensor_data` dùng `query.format()` (potential SQL injection)
- **File:** `backend/app/api/sensor_api.py:777`
- **Mô tả:** Dùng Python string formatting để inject `where_sql`. Hiện tại safe nhưng fragile.
- **Fix:** Dùng parameterized queries.

### B-14: `admin_doctor_api` trả internal error messages
- **File:** `backend/app/api/admin_doctor_api.py:187, 274`
- **Mô tả:** `str(e)` được expose cho client, tiết lộ database errors.
- **Fix:** Return generic error message, log exception server-side.

### B-15: Trộn lẫn `database` và `AsyncSessionLocal` trong email_api
- **File:** `backend/app/api/email_api.py`
- **Mô tả:** Sử dụng 2 patterns khác nhau cho database access, gây khó khăn transaction management.
- **Fix:** Standardize trên một pattern.

### B-16: `_user_cache` không giới hạn kích thước
- **File:** `backend/app/api/auth_api.py:57`
- **Mô tả:** Dict grows unbounded, không có max size.
- **Fix:** Dùng LRU cache với max size.

### B-17: `audit_service` mất entries khi shutdown
- **File:** `backend/app/services/audit_service.py:39-136`
- **Mô tả:** Buffer entries có thể bị mất khi server shutdown giữa chừng.
- **Fix:** Flush buffer trong shutdown handler.

### B-18: `chat_api.py` SQL injection via f-string
- **File:** `backend/app/api/chat_api.py:105-114`
- **Mô tả:** `ensure_session_owner()` dùng f-strings cho table names và role parameter.
- **Fix:** Dùng parameterized queries cho role filter.

### B-19: `heart_ai.py` thiếu None checks
- **File:** `backend/app/ai/heart_ai.py:34-71`
- **Mô tả:** `detect_abnormal()` access sensor values trực tiếp. Nếu None → TypeError.
- **Fix:** Thêm None checks trước comparisons.

### B-20: `update_user_me` không validate column names
- **File:** `backend/app/api/user_api.py:208-211`
- **Mô tả:** `set_sql` build từ keys mà không validate against actual columns.
- **Fix:** Filter keys against actual column set.

### B-21: Upload không scan malware
- **File:** `backend/app/api/profile_api.py:345-394`
- **Mô tả:** Files được write mà không validate nội dung.
- **Fix:** Implement content-type validation ở byte level.

### B-22: `config.py` - `EXPOSE_DEV_OTP` có thể true trong production
- **File:** `backend/app/core/config.py:59`
- **Mô tả:** Nếu `.env` set `EXPOSE_DEV_OTP=true` trong production, OTP sẽ bị expose.
- **Fix:** Đảm bảo không bao giờ set true trong production.

## LOW

### B-23: `password_policy.py` cho phép weak patterns
- **File:** `backend/app/core/password_policy.py:20`
- **Mô tả:** Regex cho phép `Password1!` passes. Không check dictionary-based passwords.
- **Fix:** Thêm common password dictionary check.

### B-24: `crud_api.py` tạo duplicate endpoints
- **File:** `backend/app/api/crud_api.py:756-761`
- **Mô tả:** `register_table_routes` gọi 2 lần cho 1 table tạo duplicate routes.
- **Fix:** Document alias routes rõ ràng.

### B-25: `cms_api.py` cache không invalidation
- **File:** `backend/app/api/cms_api.py:257`
- **Mô tả:** `_cms_columns_cache` không có TTL hoặc invalidation.
- **Fix:** Thêm TTL.

### B-26: `sensor_api.py` cache không invalidation
- **File:** `backend/app/api/sensor_api.py:48-116`
- **Mô tả:** `_devices_columns_cache` never invalidated nếu schema thay đổi.
- **Fix:** Thêm TTL-based expiry.

### B-27: `auth_api.py` cache không invalidation
- **File:** `backend/app/api/auth_api.py:115-139`
- **Mô tả:** `_users_columns_cache` never refreshed.
- **Fix:** Thêm TTL.

### B-28: `main.py` root endpoint giả mạo database status
- **File:** `backend/app/main.py:271-283`
- **Mô tả:** Trả `"database_connected": True` mà không check thật.
- **Fix:** Hoặc remove claim hoặc probe database thật.

### B-29: `sensor_api.py` tạo dynamic class không proper type
- **File:** `backend/app/api/sensor_api.py:309-319`
- **Mô tả:** Dùng `type("TelemetryForAI", (), {...})()` tạo dynamic class.
- **Fix:** Tạo proper dataclass.

### B-30: `alert_api.py` import inside function
- **File:** `backend/app/api/alert_api.py:228, 301`
- **Mô tả:** Import statements nằm trong function bodies.
- **Fix:** Move imports lên đầu file.

### B-31: `chat_api.py` - `ai_msg_id` có thể None
- **File:** `backend/app/api/chat_api.py:205-206`
- **Mô tả:** `database.execute()` có thể trả None, `str(ai_msg_id)` = "None".
- **Fix:** Thêm fallback.

### B-32: `email_api.py` dùng import inside function
- **File:** `backend/app/api/email_api.py`
- **Mô tả:** Import trong function body.
- **Fix:** Move imports lên đầu file.

### B-33: Thiếu `__init__.py` trong một số directories
- **File:** Nhiều nơi
- **Mô tả:** Một số directories thiếu `__init__.py`.
- **Fix:** Thêm cho tất cả Python package directories.

---

# 2. FRONTEND

## CRITICAL

### F-01: Access token leak trong URL query parameter
- **File:** `src/pages/PatientCompleteProfile.tsx:190`, `src/pages/DoctorCompleteProfile.tsx:214`, `src/components/ProfilePage.tsx:426`, `src/layouts/RoleLayout.tsx:61`
- **Mô tả:** Access token được append `?token=${accessToken}` vào image/media URLs. Token có thể leak qua browser history, referrer headers, dev tools.
- **Fix:** Dùng Authorization headers cho media fetches hoặc dùng signed URLs.

### F-02: WebSocket reconnect infinite loop
- **File:** `src/hooks/useWebSocket.ts:78-170`
- **Mô tả:** `connect()` memoized nhưng `onclose` handler giữ reference cũ, tạo stale closure reconnect attempts.
- **Fix:** Store `connect` trong ref và dùng ref version trong `onclose`.

### F-03: AuthContext `storage` assigned tại module level
- **File:** `src/auth/AuthContext.tsx:36`
- **Mô tả:** `const storage = window.sessionStorage` ở module scope. SSR environments hoặc tests sẽ crash khi `window` undefined.
- **Fix:** Move vào component hoặc dùng lazy initialization.

### F-04: Supabase client tạo với placeholder credentials
- **File:** `src/lib/supabase.ts:10-12`
- **Mô tả:** Khi env vars missing, client tạo với `'https://example.supabase.co'` và `'public-anon-key-placeholder'`. Không throw nhưng silent fail.
- **Fix:** Throw error trong development mode khi env vars missing.
- **Trạng thái hiện tại:** Đã được cấp `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong `.env` và `web_frontend/.env.local`, nên build hiện tại không còn rơi vào placeholder.

## HIGH

### F-05: `useEffect` thiếu `navigate` dependency
- **File:** `src/App.tsx:107-142`
- **Mô tả:** Navigation useEffect dùng `navigate` nhưng không listed trong dependencies.
- **Fix:** Thêm `navigate` vào dependency array.

### F-06: `useEffect` stale closure trong `PatientHome`
- **File:** `src/pages/RolePages.tsx:174-195`
- **Mô tả:** SOS countdown effect gọi `handleTriggerSos` dùng `accessToken` từ scope. Nếu token thay đổi giữa countdown, stale token được dùng.
- **Fix:** Dùng ref cho `accessToken`.

### F-07: `DoctorStatusPages` fetch bypass auth context
- **File:** `src/pages/DoctorStatusPages.tsx:89-103`
- **Mô tả:** Dùng `window.sessionStorage.getItem('access_token')` trực tiếp thay vì `useAuth()` hook.
- **Fix:** Dùng `useAuth()` hook.

### F-08: `restoreSession` dùng stale `user` reference
- **File:** `src/auth/AuthContext.tsx:160-182`
- **Mô tả:** Gọi `refreshUser()` rồi log `user?.email` nhưng `user` state chưa update.
- **Fix:** Dùng return value của `refreshUser()`.

### F-09: Thiếu `AbortController` trong fetch calls
- **File:** `src/App.tsx:144-205`, `src/pages/PatientChatbot.tsx:28-43`, `src/pages/DoctorChatbot.tsx:29-41`
- **Mô tả:** Nhiều `fetch()` trong `useEffect` không dùng `AbortController`. Component unmount giữa chừng → state update on unmounted component.
- **Fix:** Thêm `AbortController` và cleanup.

### F-10: Thiếu Error Boundary
- **File:** `src/App.tsx:596-602`
- **Mô tả:** Không có React Error Boundary. Component throw → entire app crash → white screen.
- **Fix:** Thêm ErrorBoundary component.

### F-11: `roleContent` trả null cho unrecognized routes
- **File:** `src/App.tsx:448-449`
- **Mô tả:** Trả `null` → blank page không có feedback.
- **Fix:** Trả NotFound component.

### F-12: `register-admin` route navigate trong render
- **File:** `src/App.tsx:465-468`
- **Mô tả:** `navigate()` gọi trong render phase (side effect).
- **Fix:** Move vào `useEffect`.

## MEDIUM

### F-13: XSS qua `react-markdown` không sanitization
- **File:** `src/components/chat/MessageBubble.tsx:39-41`
- **Mô tả:** `ReactMarkdown` với `remarkGfm` nhưng không có `rehype-sanitize`. AI response có thể chứa malicious HTML.
- **Fix:** Thêm `rehype-sanitize` plugin.

### F-14: Blood type select có duplicate options
- **File:** `src/pages/PatientCompleteProfile.tsx:349-367`, `src/components/ProfilePage.tsx:672-691`
- **Mô tả:** Có cả generic (`A`, `B`) và specific (`A+`, `A-`) options. Users chọn `A` → ambiguous.
- **Fix:** Remove generic options.

### F-15: `Alerts.tsx` parse JSON error không check Content-Type
- **File:** `src/components/Alerts.tsx:55-66`
- **Mô tả:** Parse JSON mà không check response body có phải JSON không.
- **Fix:** Dùng `readJsonResponse` utility.

### F-16: WebSocket protocol auto-upgrade có thể fail
- **File:** `src/hooks/useWebSocket.ts:90-91`
- **Mô tả:** HTTPS + `ws://` → `wss://`. Nếu backend không support → silent fail.
- **Fix:** Thêm error handler rõ ràng.

### F-17: `DoctorChatbot` thiếu loading state
- **File:** `src/pages/DoctorChatbot.tsx:29-41`
- **Mô tả:** Không có loading indicator khi fetch patients.
- **Fix:** Thêm spinner/skeleton.

### F-18: `PatientChatbot` thiếu error handling
- **File:** `src/pages/PatientChatbot.tsx:28-43`
- **Mô tả:** Nếu sensor history fetch fail, không có user-visible error.
- **Fix:** Show warning banner và retry button.

### F-19: `ChatWindow` streaming effect không cancel trên unmount
- **File:** `src/components/chat/ChatWindow.tsx:83-100`
- **Mô tả:** `setTimeout` loop không check component still mounted.
- **Fix:** Dùng `isMounted` ref.

### F-20: `ECGChart` thiếu Resize Observer
- **File:** `src/components/ECGChart.tsx:44-46`
- **Mô tả:** Canvas resize nhưng data buffer fixed 300 points.
- **Fix:** Thêm ResizeObserver hoặc make buffer responsive.

### F-21: `BeatingHeart3D` animation loop recreate mỗi heartRate change
- **File:** `src/components/BeatingHeart3D.tsx:78-178`
- **Mô tả:** `useEffect` có `[heartRate]` dependency → animation loop tear down/recreate.
- **Fix:** Store `heartRate` trong ref.

### F-22: `config.ts` URL resolution quá phức tạp
- **File:** `src/config.ts:86-103`
- **Mô tả:** 10+ fallback sources, priority order non-obvious.
- **Fix:** Simplify URL resolution.

### F-23: `PatientSettingsPage` preference loop
- **File:** `src/pages/PatientSettingsPage.tsx:58-66`
- **Mô tả:** Hai `useEffect` tương tác → potential infinite loop.
- **Fix:** Guard against setting locale same value.

### F-24: `ProtectedRoute` gọi `logout()` trong render
- **File:** `src/auth/ProtectedRoute.tsx:134-148`
- **Mô tả:** Side effects trong render phase.
- **Fix:** Move vào `useEffect`.

### F-25: Thiếu CSRF protection
- **File:** `src/services/cmsApi.ts`, `src/App.tsx`
- **Mô tả:** Không có CSRF tokens. JWT-only thì lower priority.
- **Fix:** Document hoặc implement nếu dùng cookie-based.

### F-26: Inline styles quá nhiều
- **File:** Nhiều components
- **Mô tả:** Performance hurt, maintainability issues.
- **Fix:** Move sang CSS classes.

### F-27: `console.info`/`console.debug` trong production
- **File:** `src/App.tsx:153,174,195`, `src/services/cmsApi.ts`
- **Mô tả:** Log sensitive data (patient data, tokens) ra console.
- **Fix:** Dùng logging abstraction với DEV guard.

## LOW

### F-28: `AuthUser` interface inconsistency
- **File:** `src/auth/roles.ts:16-28`
- **Mô tả:** `UserRole` type mismatch giữa components.
- **Fix:** Standardize types.

### F-29: `vite.config.ts` chunk strategy quá aggressive
- **File:** `vite.config.ts:26-31`
- **Mô tả:** Tất cả node_modules bundle thành 1 chunk → large initial bundle.
- **Fix:** Split thành granular chunks.

### F-30: `dotenv` trong production dependencies
- **File:** `package.json:16`
- **Mô tả:** Vite handle env vars natively. `dotenv` unnecessary.
- **Fix:** Move hoặc remove.

### F-31: Missing `aria-label` và accessibility
- **File:** Nhiều components
- **Mô tả:** Interactive elements thiếu accessibility attributes.
- **Fix:** Thêm ARIA attributes.

### F-32: Missing `React.FC` return type annotations
- **File:** Nhiều components
- **Mô tả:** Không standardized typing.
- **Fix:** Standardize component typing.

### F-33: `eslint` config missing trong `tsconfig.json`
- **File:** `tsconfig.json`
- **Mô tả:** Không include vitest types.
- **Fix:** Thêm vitest types.

### F-34: `DoctorVerificationRejected` fetch không AbortController
- **File:** `src/pages/DoctorStatusPages.tsx:89-103`
- **Mô tả:** Fetch trong useEffect không abort khi unmount.
- **Fix:** Thêm AbortController.

### F-35: Missing Error Handling trong `handleSensorTelemetry`
- **File:** `src/App.tsx:216-256`
- **Mô tả:** WebSocket handler thiếu error handling.
- **Fix:** Thêm try-catch.

### F-36: `routeContent` useMemo dependencies quá nhiều
- **File:** `src/App.tsx:362-452`
- **Mô tả:** Dependencies include unused values.
- **Fix:** Clean up dependency list.

### F-37: `handleSensorTelemetry` missing `patientsRef` dependency
- **File:** `src/App.tsx:216-256`
- **Mô tả:** `useCallback` có `[]` deps nhưng dùng ref.
- **Fix:** Thêm comment giải thích.

---

# 3. MOBILE (Flutter)

## CRITICAL

### M-01: Secrets hardcoded trong `.env` commit lên Git
- **File:** `.env` (project root)
- **Mô tả:** Same as B-01. Database credentials, API keys exposed.
- **Fix:** Xóa khỏi Git, rotate credentials.

### M-02: `DropdownButtonFormField` dùng `initialValue` (compile error)
- **File:** `mobile_app/lib/screens/patients_screen.dart:166,187`, `alerts_screen.dart:168`, `book_appointment_sheet.dart:266`
- **Mô tả:** `DropdownButtonFormField` không có `initialValue`. Parameter đúng là `value`. **Compile-time error.**
- **Fix:** Thay `initialValue:` bằng `value:`.

### M-03: `DateTime.parse` không try-catch (runtime crash)
- **File:** `mobile_app/lib/models/models.dart:178,246,318,386,453`
- **Mô tả:** Mọi `fromJson` gọi `DateTime.parse()` không error handling. Date string malformed → crash.
- **Fix:** Wrap trong try-catch.

### M-04: Force-unwrap `currentUser` (null crash)
- **File:** `mobile_app/lib/screens/patient_detail_screen.dart:216,220,553`
- **Mô tả:** `authProvider.currentUser!.id` dùng `!` operator. Session expired → Null check error.
- **Fix:** Thêm null check trước usage.

### M-05: WebSocket `_isConnected = true` trước khi verify
- **File:** `mobile_app/lib/services/websocket_service.dart:72`
- **Mô tả:** Set `_isConnected = true` ngay sau `IOWebSocketChannel.connect()` nhưng connection có thể fail async.
- **Fix:** Move vào `stream.listen` handler.

## HIGH

### M-06: `ApiClient.onUnauthorized` static callback (memory leak)
- **File:** `mobile_app/lib/core/api_client.dart:31`
- **Mô tả:** Static `VoidCallback` persist cross lifecycle. Hot restart → stale references.
- **Fix:** Make instance member hoặc guard với `addPostFrameCallback`.

### M-07: `WebSocketService` static state (memory leak)
- **File:** `mobile_app/lib/services/websocket_service.dart:24-38`
- **Mô tả:** `_channel`, `_listeners` static. Hot restart → stale callbacks retained.
- **Fix:** Make service instance-based.

### M-08: `_logoutSilent` gọi `notifyListeners()` từ non-UI context
- **File:** `mobile_app/lib/providers/auth_provider.dart:248-254`
- **Mô tả:** Gọi từ Dio interceptor (async). `notifyListeners()` từ non-UI context → errors.
- **Fix:** Wrap trong `addPostFrameCallback`.

### M-09: `AppConfig.baseUrl` defaults `10.0.2.2` (broken on iOS)
- **File:** `mobile_app/lib/config/app_config.dart:13-16`
- **Mô tả:** `10.0.2.2` chỉ cho Android emulator. iOS Simulator dùng `127.0.0.1`.
- **Fix:** Platform detection hoặc document `--dart-define`.

### M-10: `SecureStorage.clearSession()` xóa tất cả keys
- **File:** `mobile_app/lib/core/secure_storage.dart:110`
- **Mô tả:** `_storage.deleteAll()` xóa CẢ keys của plugins khác.
- **Fix:** Delete chỉ app-specific keys.

### M-11: `_currentIndex` reset trong `build()` (perpetual rebuild)
- **File:** `mobile_app/lib/main.dart:238-246`
- **Mô tả:** `setState` trong `build()` → loop until valid.
- **Fix:** Move clamping ra ngoài `build()`.

### M-12: `settings_screen.dart` - `_changePassword` dead code
- **File:** `mobile_app/lib/screens/settings_screen.dart:96-135`
- **Mô tả:** Method defined nhưng never called. Bottom sheet duplicate logic.
- **Fix:** Remove hoặc refactor.

### M-13: `register_screen.dart` - password `.trim()`
- **File:** `mobile_app/lib/screens/register_screen.dart:101`
- **Mô tả:** `_passwordController.text.trim()` strips whitespace. User không expect điều này.
- **Fix:** Remove `.trim()` từ password fields.

### M-14: `splash_screen.dart` - `authProvider.init()` gọi 2 lần
- **File:** `mobile_app/lib/screens/splash_screen.dart:37`, `main.dart:71`
- **Mô tả:** `init()` gọi 2 lần, redundant.
- **Fix:** Remove call từ `SplashScreen`.

## MEDIUM

### M-15: `AppLogger` PII masking quá aggressive
- **File:** `mobile_app/lib/core/app_logger.dart:42`
- **Mô tả:** Regex mask 10-11 digit numbers包括legitimate data.
- **Fix:** Targeted regex hơn.

### M-16: `ecg_painter.dart` division by zero
- **File:** `mobile_app/lib/widgets/ecg_painter.dart:71`
- **Mô tả:** `dataPoints.length == 1` → division by zero.
- **Fix:** Thêm guard: `if (dataPoints.length < 2) return;`.

### M-17: `chat_ai_screen.dart` - `_scrollToBottom` trong `build()`
- **File:** `mobile_app/lib/screens/chat_ai_screen.dart:109`
- **Mô tả:** Fires trên mỗi rebuild → redundant scroll animations.
- **Fix:** Move vào `didUpdateWidget` hoặc `ScrollController` listener.

### M-18: `dashboard_screen.dart` - `_onAnimationTick` mutate không `setState`
- **File:** `mobile_app/lib/screens/dashboard_screen.dart:263-264`
- **Mô tả:** `_ecgPoints` mutate ngoài `setState`. Works nhưng fragile.
- **Fix:** Wrap hoặc dùng `ValueNotifier`.

### M-19: `patients_screen.dart` - modal rebuild loop
- **File:** `mobile_app/lib/screens/patients_screen.dart:101-115`
- **Mô tả:** API calls trong `StatefulBuilder.builder` → rebuild loop nếu fail.
- **Fix:** Add `hasLoaded` flag.

### M-20: `appointment_provider.dart` - silent fail on non-200
- **File:** `mobile_app/lib/providers/appointment_provider.dart:42-53`
- **Mô tả:** Non-200 → silent old data retained, no error indication.
- **Fix:** Set error state.

### M-21: `chat_provider.dart` - optimistic message race
- **File:** `mobile_app/lib/providers/chat_provider.dart:164-210`
- **Mô tả:** `remove` có thể fail nếu list modified giữa add/remove.
- **Fix:** Use unique ID check.

### M-22: `stats_screen.dart` - dead code
- **File:** `mobile_app/lib/screens/stats_screen.dart`
- **Mô tả:** Fully implemented nhưng never referenced.
- **Fix:** Add to navigation hoặc remove.

### M-23: `main.dart` - theme preference không persist
- **File:** `mobile_app/lib/main.dart:55`
- **Mô tả:** `_isDarkTheme` toggle runtime nhưng never saved.
- **Fix:** Save to SharedPreferences.

### M-24: `dashboard_screen.dart` - `_cachedPatientProvider` null during tick
- **File:** `mobile_app/lib/screens/dashboard_screen.dart:89,215`
- **Mô tả:** Animation tick fire trước `didChangeDependencies` → null pointer.
- **Fix:** Initialize trong `initState` với `addPostFrameCallback`.

## LOW

### M-25: `applicationId` dùng `com.example`
- **File:** `mobile_app/android/app/build.gradle.kts:40`
- **Mô tả:** Default Flutter template value.
- **Fix:** Đổi thành `com.cardioguard.ai`.

### M-26: Missing iOS platform directory
- **Mô tả:** Không có `ios/` directory. Không build được iOS.
- **Fix:** `flutter create . --platforms=ios`.

### M-27: `analysis_options.yaml` minimal rules
- **File:** `mobile_app/analysis_options.yaml:10`
- **Mô tả:** Không enable additional rules cho healthcare app.
- **Fix:** Thêm strict rules.

### M-28: Excessive `debugPrint` statements
- **File:** `mobile_app/lib/main.dart:40,62,70-88`
- **Mô tả:** Debug noise.
- **Fix:** Replace với `AppLogger`.

### M-29: Password validation message typo
- **File:** `mobile_app/lib/screens/forgot_password_screen.dart:49`
- **Mô tả:** Thiếu "ít" → `'Mật khẩu phải có nhất 1 ký tự đặc biệt'`.
- **Fix:** Thêm "ít".

### M-30: Gender field là free text
- **File:** `mobile_app/lib/screens/settings_screen.dart:509-515`
- **Mô tả:** Users có thể nhập bất kỳ gì.
- **Fix:** Dùng DropdownButtonFormField.

### M-31: Status mapping thiếu `'completed'`
- **File:** `mobile_app/lib/screens/appointments_screen.dart:251-266`
- **Mô tả:** Completed appointment show as "ĐANG CHỜ".
- **Fix:** Thêm case cho `'completed'`.

### M-32: Scheduled date không validate against past
- **File:** `mobile_app/lib/widgets/book_appointment_sheet.dart:169-175`
- **Mô tả:** Timezone edge cases.
- **Fix:** Thêm final validation.

### M-33: Chart data không bounded
- **File:** `mobile_app/lib/screens/patient_detail_screen.dart:148-153`
- **Mô tả:** `_hrSpots` grow unbounded → memory growth.
- **Fix:** Cap list size: `if (length > 60) removeAt(0)`.

### M-34: `web_socket_channel` version cũ
- **File:** `mobile_app/pubspec.yaml:14`
- **Mô tả:** Version 2.x legacy. 3.x recommended.
- **Fix:** Update to `^3.0.0`.

### M-35: Missing `macos/` directory
- **Mô tả:** `macos/` empty. Không build được macOS.
- **Fix:** `flutter create . --platforms=macos`.

---

# Prioritized Fix Order

## Phase 1: Security & Critical (Làm ngay)
1. **B-01/M-01**: Xóa `.env` khỏi Git, rotate credentials
2. **F-01**: Access token leak trong URLs
3. **B-02**: Duplicate router registration
4. **M-02**: DropdownButtonFormField compile error
5. **M-03**: DateTime.parse crash
6. **M-04**: Force-unwrap null crash
7. **F-02**: WebSocket reconnect loop
8. **F-03**: Module-level `window.sessionStorage`

## Phase 2: High Severity (Tuần này)
9. **B-04**: User cache skip revoked token
10. **B-05**: OTP not invalidated
11. **B-06**: WebSocket no revoked check
12. **B-07**: Password strength validation
13. **F-09/F-10**: AbortController + Error Boundary
14. **M-05/M-06/M-07**: WebSocket/ApiClient issues

## Phase 3: Medium Severity (Tuần sau)
15. **B-08**: CORS regex broad
16. **B-13**: SQL injection via format()
17. **F-13**: XSS via react-markdown
18. **F-14**: Blood type duplicate options
19. **M-16**: Division by zero
20. **M-10**: SecureStorage clear all

## Phase 4: Low Severity (Khi có thời gian)
21. Các issues còn lại (cache, logging, typing, etc.)
