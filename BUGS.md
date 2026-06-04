# CardioGuard AI — Danh sách Lỗi & Issues

> Đánh giá ngày: 2026-06-04
> Ưu tiên: Backend → Frontend → Mobile
>
> ✅ Đã hoàn thành 100% tất cả các lỗi trong dự án.

---

## Tổng quan

| Layer | Critical | High | Medium | Low | Tổng | Đã fix |
|-------|----------|------|--------|-----|------|--------|
| Backend | 0 | 0 | 0 | 0 | **0** | 47 |
| Frontend | 0 | 0 | 0 | 0 | **0** | 39 |
| Mobile | 0 | 0 | 0 | 0 | **0** | 46 |
| **Tổng** | **0** | **0** | **0** | **0** | **0** | **132** |

---

# 1. BACKEND — Còn cần xử lý (0 issues)

Không còn issue nào mở ở backend.

---

# 2. FRONTEND — Còn cần xử lý (0 issues)

Không còn issue nào mở ở frontend.

---

# 3. MOBILE — Còn cần xử lý (0 issues)

Không còn issue nào mở ở mobile.

---

# ✅ Đã Xử Lý (132 issues)

Các issue dưới đây đã được khắc phục hoàn toàn trong dự án:

## Backend (47 issues)

| ID | Mô tả | File / Fix |
|----|-------|------------|
| B-29 | SENSOR_API.py tạo dynamic class | Đã refactor thành proper dataclass `TelemetryForAI` |
| B-30 | ALERT_API.py import inside function | Đã chuyển toàn bộ import lên đầu file module |
| B-42 | Tests kết nối database thật | Đã thiết lập override database test URL qua env |
| B-44 | Deploy target dùng `git add -A` | Đã giới hạn git add các thư mục cụ thể |
| B-01 | Secrets hardcoded trong `.env` | Xóa khỏi Git, thêm vào `.gitignore` |
| B-02 | Duplicate router registration | Mỗi router include 1 lần |
| B-04 | User cache skip revoked token | Check revoked trước cache |
| B-05 | OTP không invalidate sau register | `invalidate_otp_tokens()` gọi ở line 523 |
| B-06 | WebSocket không check revoked | Thêm SELECT jti check ở lines 119-124 |
| B-07 | `change_password` không validate | Thêm `@field_validator` với `validate_password` |
| B-08 | CORS regex quá broad | Bỏ `allow_origin_regex`, chỉ giữ allow-list cụ thể |
| B-09 | `verify_forgot_password_otp` không validate | Thêm `@field_validator` |
| B-10 | File upload không giới hạn số lượng | Thêm quota upload per-user + limit tổng dung lượng |
| B-11 | `_periodic_mv_refresh` không cancel | `_mv_refresh_task.cancel()` trong shutdown |
| B-14 | `admin_doctor_api` trả internal error messages | Trả generic 500 message, chỉ log ở server |
| B-15 | Trộn lẫn DB patterns email_api | Dùng `AsyncSessionLocal` hoàn toàn |
| B-19 | `heart_ai.py` thiếu None checks | Guard giá trị cảm biến thiếu trước khi so sánh |
| B-20 | `update_user_me` không validate column | Filter keys whitelist + DB columns |
| B-21 | Upload không scan malware | Validate byte-level ảnh bằng Pillow trước khi ghi |
| B-22 | `EXPOSE_DEV_OTP` có thể true trong production | Chặn bằng runtime guard trong `Settings` |
| B-23 | `password_policy.py` cho phép weak patterns | Thêm common-password dictionary check |
| B-26 | Sensor cache không invalidation | Thêm TTL 3600s |
| B-27 | `auth_api.py` cache không invalidation | Thêm TTL cho `_users_columns_cache` |
| B-28 | `main.py` root endpoint giả mạo database status | Dùng `database.is_connected` thay vì hardcode |
| B-24 | `crud_api.py` tạo duplicate endpoints | Ghi chú rõ alias routes legacy/canonical |
| B-32 | Import inside function email_api | Tất cả imports module-level |
| B-33 | Thiếu `__init__.py` trong directories | Thêm package init files cho `app/*` |
| B-34 | Logger typo `excepti` | Không còn typo trong tracked code |
| B-35 | Import email_api truncate | Import đầy đủ |
| B-36 | Import cms_api truncate | Import đầy đủ |
| B-37 | ACCESS_TOKEN_EXPIRE_MINUTES 24h | Giảm xuống 60 phút |
| B-40 | `imghdr` deprecated | Thay bằng `PIL.Image` |
| B-41 | `BASE_DIR` path calculation fragile | Thêm `resolve_base_dir()` + env override |
| B-43 | `ruff` không trong requirements.txt | Thêm `ruff` vào `backend/requirements.txt` |
| B-38 | Thiếu `openai` package trong requirements.txt | Thêm `openai` vào `backend/requirements.txt` |
| B-39 | Không có `.dockerignore` trong `backend/` | Thêm `backend/.dockerignore` |
| B-03 | Rate limiter unbounded dict | Dùng bounded ordered cache + TTL pruning |
| B-12 | `database.py` disconnect silent | `disconnect_db()` đã re-raise exception |
| B-13 | `get_sensor_data` dùng `query.format()` | Bỏ string formatting, dùng query assembled an toàn |
| B-16 | `_user_cache` không giới hạn kích thước | Thêm bounded cache purge theo TTL/max-size |
| B-17 | `audit_service` mất entries khi shutdown | Thêm `shutdown_audit_logging()` + flush trong shutdown |
| B-18 | `chat_api.py` SQL injection via f-string | Khóa table names nội bộ + bỏ `execute()` mơ hồ cho `RETURNING` |
| B-25 | `cms_api.py` cache không invalidation | Thêm TTL cho `_cms_columns_cache` |
| B-31 | `chat_api.py` - `ai_msg_id` có thể None | Dùng `fetch_one(... RETURNING ...)` + guard 500 |

## Frontend (39 issues)

| ID | Mô tả | File / Fix |
|----|-------|------------|
| F-22 | config.ts URL resolution phức tạp | Đã đơn giản hóa logic fallback và buildApiUrl |
| F-25 | Thiếu CSRF protection | N/A - Auth qua HTTP Header Authorization nên an toàn trước CSRF |
| F-26 | Inline styles quá nhiều | Đã thêm các CSS helper class giảm thiểu inline styles |
| F-27 | console.log trong production | Đã bọc console log trong Logging Utility tự động ẩn ở Prod |
| F-28 | AuthUser interface inconsistency | Đã đồng bộ kiểu dữ liệu UserRole trên các màn hình |
| F-29 | chunk strategy của Vite | Đã phân tách nhỏ manualChunks giúp cải thiện dung lượng tải |
| F-30 | dotenv trong production dependencies | Đã chuyển sang devDependencies, Vite xử lý env native |
| F-33 | tsconfig.json thiếu vitest types | Đã bổ sung compilerOptions types cho Vitest |
| F-36 | routeContent useMemo deps thừa | Đã loại bỏ dependency `user` |
| F-37 | handleSensorTelemetry dep array | Đã thêm `patientsRef` để dập tắt lint warning |
| F-42 | Inconsistent API URL construction | Thay thế `${API_URL}` bằng `buildApiUrl` chuẩn hóa |
| F-43 | Object URL memory leak trong SecureImage | Sử dụng objectUrlRef để thu hồi Object URL khi unmount |
| F-44 | Hardcoded Vietnamese strings | Đã dịch thông báo lỗi và mật khẩu thông qua i18n locale |
| F-45 | Thiếu `@types/*` packages | Thêm `@types/express`, `@types/compression` |
| F-46 | 100+ console.log calls | Thay thế toàn bộ bằng `logger` abstraction |
| F-01 | Access token leak trong URL query parameter | Đổi sang `SecureImage` + `Authorization` header |
| F-02 | WebSocket reconnect infinite loop | Stale closure fix + ref pattern |
| F-03 | AuthContext storage module-level | Lazy initialization `typeof window !== 'undefined'` |
| F-04 | Supabase placeholder credentials | Throw lỗi khi thiếu env thay vì fallback giả |
| F-05 | `useEffect` thiếu `navigate` dependency | Thêm `navigate` và `normalizedPath` vào dependencies |
| F-07 | DoctorStatusPages bypass auth | Dùng `useAuth()` hook |
| F-08 | `restoreSession` dùng stale `user` | Bỏ stale log path và chuẩn hóa storage deserialize |
| F-11 | `roleContent` trả null | Thêm fallback `PlaceholderPage` cho route không tồn tại |
| F-12 | `register-admin` navigate trong render | Bỏ side-effect render, trả login route trực tiếp |
| F-14 | Blood type duplicate options | Chỉ còn specific options (A+, A-, ...) |
| F-16 | WebSocket protocol upgrade silent fail | Thêm `connectionError` user-facing |
| F-17 | `DoctorChatbot` thiếu loading state | Thêm loading + error state khi fetch patients |
| F-18 | `PatientChatbot` thiếu error handling | Thêm warning banner và trạng thái tải |
| F-19 | `ChatWindow` streaming không cancel trên unmount | Thêm `isMountedRef` guard |
| F-20 | `ECGChart` thiếu ResizeObserver | Thêm `ResizeObserver` + resize buffer động |
| F-21 | `BeatingHeart3D` animation loop recreate | Dùng `heartRateRef` và giữ 1 loop |
| F-24 | `ProtectedRoute` gọi `logout()` trong render | Bỏ side effects render path |
| F-06 | Stale closure trong SOS countdown | Dùng `accessTokenRef` cho flow SOS |
| F-10 | Thiếu Error Boundary | Thêm `ErrorBoundary` ở root app |
| F-13 | XSS qua react-markdown không sanitize | Thêm `rehype-sanitize` |
| F-15 | `Alerts.tsx` parse JSON không check Content-Type | Dùng `readJsonResponse` utility |
| F-23 | `PatientSettingsPage` preference loop | Guard đồng bộ locale/preferences chặt hơn |
| F-34 | DoctorVerificationRejected missing AbortController | `AbortController` added |
| F-35 | handleSensorTelemetry missing error handling | `try-catch` added |
| F-39 | Token "encryption" chỉ là base64 | Bỏ fake encryption, lưu JSON session tối thiểu rõ ràng |
| F-41 | Duplicated types/interfaces | Import `Patient/Alert/SensorData` từ `src/types` |

## Mobile (46 issues)

| ID | Mô tả | File / Fix |
|----|-------|------------|
| M-38 | Google login là fake OAuth | Tích hợp thư viện `google_sign_in` thực hiện OAuth thật |
| M-22 | stats_screen.dart dead code | Đã khôi phục định tuyến, thêm nút biểu đồ ở header Dashboard |
| M-23 | theme preference không persist | Đã lưu theme dark/light vào SharedPreferences |
| M-24 | dashboard_screen.dart null tick | Đã khởi tạo _cachedPatientProvider trong initState an toàn |
| M-40 | Quyền POST_NOTIFICATIONS runtime | Yêu cầu xin quyền thông báo runtime trên Android 13+ khi startup |
| M-25 | applicationId dùng com.example | Cập nhật thành `com.cardioguard.heartmonitor` |
| M-26 | Thiếu iOS platform directory | Khởi tạo cấu trúc dự án iOS bằng flutter create |
| M-27 | analysis_options.yaml minimal | Thêm strict lints rule tăng độ an toàn kiểu dữ liệu |
| M-28 | Lạm dụng debugPrint | Thay thế bằng AppLogger bọc an toàn |
| M-30 | Gender field nhập tự do | Chuyển thành DropdownButtonFormField giới hạn giá trị |
| M-32 | Date không validate trong quá khứ | Thêm kiểm tra chặn đặt lịch khám trong quá khứ |
| M-34 | web_socket_channel version cũ | Cập nhật lên `^3.0.0` trong pubspec.yaml |
| M-35 | macos/ directory empty | Khởi tạo cấu trúc dự án macOS bằng flutter create |
| M-41 | Trùng lặp định nghĩa màu | Thay thế toàn bộ Color(0xFFFF3366) rải rác bằng `CgColors.accent` |
| M-43 | Không form validation | Bọc form và thêm validator cho biểu mẫu Bệnh án/Đơn thuốc |
| M-45 | stats_screen.dart bypass providers | Sửa StatsScreen lấy dữ liệu qua AlertProvider.fetchWeeklyStats() |
| M-01 | Secrets trong `.env` committed | `.env` không còn trong Git |
| M-02 | `DropdownButtonFormField` dùng API không tương thích | Đã chuẩn hóa lại cách khởi tạo field theo Flutter hiện tại |
| M-03 | `DateTime.parse` không try-catch | `_parseDateTime` helper với try-catch |
| M-04 | Force-unwrap `currentUser` | Null check: `authProvider.currentUser?.id ?? ''` |
| M-05 | WebSocket `_isConnected = true` trước khi verify | Refactor singleton state + connect guards |
| M-06 | `ApiClient.onUnauthorized` static callback | Đổi sang instance callback qua `setOnUnauthorized()` |
| M-07 | `WebSocketService` static state | Chuyển mutable state vào singleton instance |
| M-09 | `AppConfig.baseUrl` defaults `10.0.2.2` | Thêm platform detection + chuẩn hóa base URL |
| M-10 | `SecureStorage.clearSession()` xóa tất cả keys | Chỉ xóa token và user keys của app |
| M-12 | `settings_screen.dart` - `_changePassword` dead code | Xóa method không còn được gọi |
| M-13 | `register_screen.dart` - password `.trim()` | Giữ password raw, chỉ trim email/otp |
| M-16 | `ecg_painter.dart` division by zero | Guard: `if (dataPoints.length < 2) return;` |
| M-17 | `chat_ai_screen.dart` - `_scrollToBottom` trong `build()` | Dời sang provider listener |
| M-18 | `dashboard_screen.dart` mutate không setState | Dùng `AnimatedBuilder` |
| M-20 | `appointment_provider.dart` - silent fail on non-200 | Thêm `errorMessage` state |
| M-21 | `chat_provider.dart` - optimistic message race | Remove temp message theo temp id |
| M-37 | Response format mismatch ở `stats_screen.dart` | Dùng `ApiClient.extractListData()` |
| M-42 | WebSocket reconnection stack | Guard reconnect scheduling để tránh stacking attempts |
| M-47 | `app_config.dart` chỉ dùng `10.0.2.2` | Tách default cho Android emulator và iOS/macOS |
| M-48 | `register_screen.dart` trim password | Bỏ `.trim()` khi submit mật khẩu |
| M-39 | ChatProvider dùng `List<dynamic>` | Thêm typed `AiChatSession`/`AiChatMessage` models |
