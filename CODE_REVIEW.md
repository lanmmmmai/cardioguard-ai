# 📋 CODE REVIEW REPORT — CardioGuard AI

**Ngày review:** 2026-06-02
**Tổng số issues:** 80+
**Modules:** Backend (FastAPI), Web Frontend (React), Mobile App (Flutter), AI Model, Hardware (ESP32)

---

## Mục lục

1. [Backend Issues](#1-backend-issues)
2. [Web Frontend Issues](#2-web-frontend-issues)
3. [Mobile App Issues](#3-mobile-app-issues)
4. [AI Model Issues](#4-ai-model-issues)
5. [Hardware Firmware Issues](#5-hardware-firmware-issues)
6. [Infrastructure Issues](#6-infrastructure-issues)
7. [Priority Matrix](#7-priority-matrix)
8. [Lỗi Đã Khắc Phục (Resolved)](#8-lỗi-đã-khắc-phục-resolved)

---

## 1. Backend Issues


## 3. Mobile App Issues

### 🟡 [MEDIUM] MO-11: Providers never disposed, init never called

- **File:** `mobile_app/lib/main.dart:47-51`
- **Mô tả:** 5 providers created eagerly. `AuthProvider` storing JWT never initialized (init never called).
- **Fix:** Thêm `lazy: false` nếu cần init, gọi `init()`.

---

### 🟡 [MEDIUM] MO-12: Animation tick tạo `Random` object mỗi frame

- **File:** `mobile_app/lib/screens/dashboard_screen.dart:155-204`
- **Mô tả:** `math.Random()` tạo mới mỗi frame. 60fps = 60 Random instances/giây.
- **Code:**
  ```dart
  simEcg = (math.Random().nextDouble() - 0.5) * 0.02;  // New Random mỗi frame
  ```
- **Fix:** Lưu `Random` instance как field.

---

### 🟡 [MEDIUM] MO-13: `setState` gọi 60fps — full widget rebuild

- **File:** `mobile_app/lib/screens/dashboard_screen.dart:161`
- **Mô tả:** `setState` gọi mỗi animation frame → toàn bộ widget tree rebuild. `LayoutBuilder`, `Provider.of`, complex widgets đều rebuild.
- **Fix:** Dùng `AnimatedBuilder` hoặc `CustomPainter` với `repaint`.

---

### 🟡 [MEDIUM] MO-14: Không có exponential backoff khi reconnect

- **File:** `mobile_app/lib/services/websocket_service.dart:87-92`
- **Mô tả:** Nếu server down, reconnect loop mỗi 3s vô thời hạn → battery drain.
- **Code:**
  ```dart
  Future.delayed(const Duration(seconds: 3), () async {
    if (!_isConnected && !_isIntentionalDisconnect) {
      await connect();  // Loop vô hạn
    }
  });
  ```
- **Fix:** Thêm exponential backoff và max retry count.

---

### 🟡 [MEDIUM] MO-15: `response.data` không validate trước khi cast

- **File:** `patient_provider.dart:46-50`, `alert_provider.dart:30`, `chat_provider.dart:29`, `appointment_provider.dart:26`
- **Mô tả:** Nếu API trả JSON object thay vì array, throw TypeError.
- **Code:**
  ```dart
  final List<dynamic> list = response.data;  // Crash nếu là Map
  ```
- **Fix:** Validate `response.data is List` trước khi cast.

---

### 🟡 [MEDIUM] MO-16: `settings_screen.dart` age parse default to 0

- **File:** `mobile_app/lib/screens/settings_screen.dart:146`
- **Mô tả:** `int.tryParse` default 0 nếu non-numeric input. Age=0 gửi lên API.
- **Code:**
  ```dart
  final age = int.tryParse(_ageController.text) ?? 0;  // age = 0 nếu invalid
  ```
- **Fix:** Thêm validation error hoặc dùng TextFormField với number keyboard.

---

### 🟢 [LOW] MO-17: `dart:ui` import nặng chỉ dùng cho `VoidCallback`

- **File:** `mobile_app/lib/core/api_client.dart:1`
- **Mô tả:** `dart:ui` heavy import chỉ cho type alias.
- **Fix:** Dùng `package:flutter/foundation.dart`.

---

### 🟢 [LOW] MO-18: `app_logger.dart` không có log levels

- **File:** `mobile_app/lib/core/app_logger.dart`
- **Mô tả:** Chỉ có `log()` method. Không có DEBUG, INFO, WARN, ERROR. sensitive patient data có thể bị logged → HIPAA/GDPR violation.
- **Fix:** Thêm log levels và conditional output.

---

### 🟢 [LOW] MO-19: Redundant password validation rules

- **File:** `mobile_app/lib/screens/settings_screen.dart:41-58`
- **Mô tả:** Check uppercase (line 42) đã guarantee letter. Check "chữ cái" (line 44) redundant.
- **Fix:** Merge hoặc bỏ redundant check.

---

### 🟢 [LOW] MO-20: `ecg_painter.dart` dot vẽ ở `width` bị clip

- **File:** `mobile_app/lib/widgets/ecg_painter.dart:90`
- **Mô tả:** Dot vẽ ở `width` — right edge of canvas, bị clip.
- **Code:**
  ```dart
  final lastX = width;  // Bị clip
  ```
- **Fix:** Dùng `width - 4` hoặc tương tự.

---

### 🟢 [LOW] MO-21: `Provider.of` gọi trong animation listener

- **File:** `mobile_app/lib/screens/dashboard_screen.dart:155-204`
- **Mô tả:** `Provider.of<PatientProvider>(context, listen: false)` gọi 60fps — traverse element tree mỗi frame.
- **Fix:** Cache provider reference.

---

### 🟢 [LOW] MO-22: Password trimmed trước khi gửi

- **File:** `mobile_app/lib/screens/login_screen.dart:34-35`
- **Mô tả:** `_passwordController.text.trim()` — trim password. Users có thể intentional dùng spaces trong passphrase.
- **Fix:** Không trim password, hoặc document behavior.

---
## 6. Infrastructure Issues

### 🟠 [HIGH] INFRA-01: Massive dependency bloat trong `requirements.txt`

- **File:** `backend/requirements.txt`
- **Mô tả:** 250 packages包括 `torch`, `transformers`, `ultralytics`, `jupyter`, `selenium`, `paddleocr`, `easyocr`, `streamlit`. Không có package nào cần cho FastAPI backend. `requirements.runtime.txt` chỉ có 14 packages. Attack surface khổng lồ.
- **Fix:** Dùng `requirements.runtime.txt` cho production, giữ `requirements.txt` cho dev.

---

### 🟡 [MEDIUM] INFRA-02: Docker container chạy root

- **File:** `backend/Dockerfile`, `web_frontend/Dockerfile`
- **Mô tả:** Cả hai Dockerfiles chạy processes dưới root user. Defense in depth thiếu.
- **Fix:** Thêm `RUN adduser --disabled-password appuser && USER appuser`.

---

### 🟡 [MEDIUM] INFRA-03: Conflicting OpenCV packages

- **File:** `backend/requirements.txt:130-132`
- **Mô tả:** Install đồng thời `opencv-contrib-python`, `opencv-python`, `opencv-python-headless` — conflicts.
- **Fix:** Chọn một package.

---

### 🟡 [MEDIUM] INFRA-04: Unpinned numpy, pyarrow

- **File:** `backend/requirements.txt:129, 160`
- **Mô tả:** Không có version pin. Major version bumps có thể break.
- **Fix:** Pin known-working ranges.

---

### 🟢 [LOW] INFRA-05: `seed_data.py` dùng `datetime.now()` không timezone

- **File:** `backend/seed_data.py:77, 78, 100, 101`
- **Mô tả:** `datetime.now()` tạo naive datetime. Migration dùng `TIMESTAMPTZ`. Inconsistency.
- **Fix:** Dùng `datetime.now(timezone.utc)`.

---

### 🟢 [LOW] INFRA-06: `web_frontend/Dockerfile` không có `.dockerignore`

- **File:** `web_frontend/Dockerfile`
- **Mô tả:** `COPY web_frontend/ ./` copy everything including `.git`, `node_modules`, `.env`.
- **Fix:** Thêm `.dockerignore`.

---

### 🟢 [LOW] INFRA-07: `docker-compose.yml` không có healthcheck cho web

- **File:** `docker-compose.yml:27-40`
- **Mô tả:** Backend có healthcheck nhưng web không có. Failed nginx start undetected.
- **Fix:** Thêm healthcheck cho web service.

---
## 4. AI Model Issues

### 🟡 [MEDIUM] AI-02: CORS wildcard methods/headers

- **File:** `ai_model/app.py:49-50`
- **Mô tả:** `allow_methods=["*"]`, `allow_headers=["*"]` với `allow_credentials=True` — quá permissive.
- **Fix:** Restrict actual methods/headers.

---

### 🟡 [MEDIUM] AI-03: Không có rate limiting

- **File:** `ai_model/app.py` (toàn bộ)
- **Mô tả:** `/predict-heart-risk` không có rate limiting. CPU-bound inference có thể bị DoS.
- **Fix:** Thêm rate limiting.

---

### 🟡 [MEDIUM] AI-04: Synchronous model inference trong async handler

- **File:** `ai_model/app.py:183-188`
- **Mô tả:** `model.predict()` và `model.predict_proba()` là CPU-blocking calls. Trong async FastAPI handler, block event loop.
- **Code:**
  ```python
  @app.post("/predict-heart-risk")
  async def predict_risk(...):
      prediction = model.predict(input_df)  # BLOCKING
  ```
- **Fix:** Dùng `run_in_executor` hoặc sync endpoint.

---

### 🟢 [LOW] AI-07: No model validation beyond accuracy

- **File:** `ai_model/train_model.py:100-110`
- **Mô tả:** Chỉ report accuracy. Với medical prediction model, precision, recall, F1, AUC-ROC quan trọng hơn.
- **Fix:** Lưu và evaluate thêm metrics.

---

### 🟢 [LOW] AI-08: `joblib.dump` không pin version

- **File:** `ai_model/train_model.py:124`
- **Mô tả:** Pickle format phụ thuộc scikit-learn version. Nếu upgrade, old `.pkl` có thể fail load.
- **Fix:** Pin scikit-learn version hoặc dùng `skops`.

---

### 🟢 [LOW] AI-09: `requirements.txt` không có upper bounds

- **File:** `ai_model/requirements.txt`
- **Mô tả:** Tất cả packages dùng `>=` — breaking changes có thể silent break API.
- **Fix:** Pin known-working ranges.

---
## 5. Hardware Firmware Issues

### 🔴 [CRITICAL] HW-01: Hardcoded WiFi credentials trong source

- **File:** `hardware/esp32_s3_supermini/firmware/include/config.h:7-10`
- **Mô tả:** WiFi SSID/password và device auth token stored as plaintext `static const char*`. Ai đó có firmware source hoặc decompiled binary có thể extract.
- **Code:**
  ```cpp
  static const char *kWifiSsid = "REPLACE_WIFI_SSID";
  static const char *kWifiPassword = "REPLACE_WIFI_PASSWORD";
  static const char *kDeviceToken = "REPLACE_DEVICE_TOKEN";
  ```
- **Fix:** Dùng encrypted NVS partition hoặc provisioning flow. Không commit credentials.

---

### 🟠 [HIGH] HW-05: JSON injection qua unescaped string concatenation

- **File:** `hardware/esp32_s3_supermini/firmware/src/telemetry_format.cpp:26-58`
- **Mô tả:** String values concat trực tiếp vào JSON mà không escape. Nếu string chứa `"`, `\`, hoặc control chars → malformed JSON.
- **Code:**
  ```cpp
  json += frame.device_uid;      // Không escape
  json += frame.mode;            // Không escape
  ```
- **Fix:** Dùng proper JSON library hoặc escape values.

---

### 🟠 [HIGH] HW-06: Boot state transitions quá nhanh

- **File:** `hardware/esp32_s3_supermini/firmware/src/main.cpp:109-115`
- **Mô tả:** Boot→wifi_connecting→time_syncing→paired_ready xảy ra trong một `loop()` call (1s). Không có actual WiFi connection waiting, NTP sync, hay pairing verification.
- **Fix:** Thêm actual waiting/validation cho mỗi state.

---

### 🟡 [MEDIUM] HW-07: `static` variables trong header gây ODR issues

- **File:** `hardware/esp32_s3_supermini/firmware/include/config.h:4-15`
- **Mô tả:** `static const char*` trong header — mỗi translation unit có copy riêng. Flash/RAM waste trên embedded.
- **Fix:** Dùng `constexpr` hoặc `inline` (C++17).

---

### 🟡 [MEDIUM] HW-08: `g_serial_line` unbounded accumulation

- **File:** `hardware/esp32_s3_supermini/firmware/src/main.cpp:14, 79`
- **Mô tả:** Global `String` never freed/cleared on error paths. ESP32 heap limited.
- **Fix:** Clear `g_serial_line` trên error paths.

---

### 🟡 [MEDIUM] HW-09: String concatenation repeated heap allocation

- **File:** `hardware/esp32_s3_supermini/firmware/src/telemetry_format.cpp:25-61`
- **Mô tả:** Mỗi `+=` trên Arduino `String` có thể trigger heap reallocation. `json.reserve(512)` có thể insufficient nếu payload > 512 bytes.
- **Fix:** Dùng fixed buffer hoặc `snprintf`.

---

### 🟡 [MEDIUM] HW-10: `send_payload != payload` comparison unreliable

- **File:** `hardware/esp32_s3_supermini/firmware/src/telemetry_sender.cpp:131`
- **Mô tả:** So sánh hai `String` objects by value. Nếu buffer có identical payload, sẽ incorrect.
- **Fix:** Dùng index tracking thay vì string comparison.

---

### 🟢 [LOW] HW-11: Static local variables never reset

- **File:** `hardware/esp32_s3_supermini/firmware/src/random_telemetry.cpp:85-89`
- **Mô tả:** `hr_base`, `spo2_base` etc. persist qua calls. Device restart → jump back defaults. Mode switch → carry over values.
- **Fix:** Reset statics khi mode thay đổi.

---

### 🟢 [LOW] HW-12: `RandomWalk` chỉ add positive step

- **File:** `hardware/esp32_s3_supermini/firmware/src/random_telemetry.cpp:40-41`
- **Mô tả:** Function chỉ hoạt động đúng khi `step_min < 0 < step_max`. Nếu cả hai positive, value chỉ increase.
- **Fix:** Document limitation hoặc refactor.

---

### 🟢 [LOW] HW-13: Battery clamp after sequence 3825

- **File:** `hardware/esp32_s3_supermini/firmware/src/random_telemetry.cpp:141`
- **Mô tả:** Sau sequence 3825, battery permanently clamped to 15. Expected behavior nhưng không có warning.
- **Fix:** Thêm wrap-around hoặc warning.

---

### 🟢 [LOW] HW-14: TelemetrySender buffer overwrite oldest frame

- **File:** `hardware/esp32_s3_supermini/firmware/src/telemetry_sender.cpp:17-27`
- **Mô tả:** Buffer full → oldest frame silently overwritten. Không error report.
- **Fix:** Flag data loss cho caller.

---
## 7. Priority Matrix

### Tier 1 — Sửa ngay (blocking / data loss / security)

| Issue | Module | File | Mô tả |
|-------|--------|------|-------|
| FE-01 | Web | `Patients.tsx:60` | Thiếu Authorization header |
| FE-02 | Web | `ECGChart.tsx:134` | CSS vars trong canvas — invisible ECG |
| MO-01 | Mobile | `alerts_screen.dart:145` | Compile error `initialValue` |
| MO-02 | Mobile | `main.dart:169` | Infinite rebuild loop |
| HW-03 | Hardware | `main.cpp:155` | State machine overwrite |
| HW-02 | Hardware | `config.h:9` | HTTP endpoint — token plaintext |
| HW-04 | Hardware | `telemetry_sender.cpp:148` | Buffered frame dropped |
| BE-02 | Backend | `auth_api.py:257` | Race condition registration |
| BE-10 | Backend | `otp_service.py:90` | Race condition OTP |
| BE-11 | Backend | `sensor_api.py:300` | No rate limit IoT |

### Tier 2 — Sửa sớm (security / reliability)

| Issue | Module | File | Mô tả |
|-------|--------|------|-------|
| BE-07 | Backend | `security.py:27` | JWT no revocation |
| BE-08 | Backend | `auth_api.py:235` | Error message leak |
| BE-09 | Backend | `user_api.py:484` | Admin role escalation |
| BE-12 | Backend | `ai_service.py:82` | AI error leak |
| BE-13 | Backend | `email_service.py:92` | SMTP TLS verify |
| FE-05 | Web | `useWebSocket.ts:74` | WS token plaintext |
| FE-06 | Web | `AuthContext.tsx:19` | sessionStorage plaintext |
| MO-05 | Mobile | `app_config.dart:4` | Hardcoded production URL |
| MO-06 | Mobile | `main.dart` | init() never called |
| MO-07 | Mobile | `secure_storage.dart:22` | deleteAll on error |
| HW-01 | Hardware | `config.h:7` | Hardcoded credentials |
| INFRA-01 | Infra | `requirements.txt` | 250 packages attack surface |

### Tier 3 — Cải thiện (quality / performance)

| Issue | Module | File | Mô tả |
|-------|--------|------|-------|
| BE-06 | Backend | `main.py:29` | CORS regex broad |
| BE-15 | Backend | `alert_api.py:9` | No pagination |
| BE-16 | Backend | `chat_api.py:15` | No message limit |
| FE-04 | Web | `App.tsx:162` | Stale closure reconnect |
| FE-09 | Web | `ChangePassword.tsx:59` | setTimeout leak |
| FE-14 | Web | `ChatWindow.tsx:76` | Streaming 500 updates |
| MO-10 | Mobile | `dashboard_screen.dart:34` | O(n) buffer |
| MO-13 | Mobile | `dashboard_screen.dart:161` | setState 60fps |
| MO-14 | Mobile | `websocket_service.dart:87` | No backoff reconnect |
| AI-04 | AI | `app.py:183` | CPU-blocking inference |

---

*Report generated by opencode — CardioGuard AI Code Review*

---
## 8. Lỗi Đã Khắc Phục (Resolved)

### 🟢 [RESOLVED] BE-07: JWT không có token revocation

---
### 🟢 [RESOLVED] FE-10: No error handling cho `response.json()`

---
### 🟢 [RESOLVED] FE-11: Canvas resize không handled

---
### 🟢 [RESOLVED] FE-12: ECG animation restart mỗi khi `liveEcgValue` thay đổi

---
### 🟢 [RESOLVED] FE-13: `setInterval` recreated mỗi telemetry update

---
### 🟢 [RESOLVED] FE-14: Chat streaming tạo quá nhiều state updates

---
### 🟢 [RESOLVED] BE-01: Rate limiting vô hiệu trong multi-worker

---
### 🟢 [RESOLVED] BE-04: Hardcoded default secret key

---
### 🟢 [RESOLVED] BE-05: Health endpoint leak exception details

---
### 🟢 [RESOLVED] BE-14: Hard-delete user không audit clinical data

---
### 🟢 [RESOLVED] BE-22: `clinical_models.py` là dead code

---
### 🟢 [RESOLVED] BE-23: `verify_password` silently return False on exception

---
### 🟢 [RESOLVED] BE-24: `_users_columns_cache` không thread-safe

---
### 🟢 [RESOLVED] BE-25: `SMTP_USERNAME` và `SMTP_USER` duplication

---
### 🟢 [RESOLVED] BE-20: `datetime.utcnow()` deprecated

---
### 🟢 [RESOLVED] BE-21: Audit log limit không có upper bound

---
### 🟢 [RESOLVED] BE-02: Race condition TOCTOU trong registration

---
### 🟢 [RESOLVED] BE-03: Duplicate route path conflict

---
### 🟢 [RESOLVED] BE-06: CORS regex quá broad

---
### 🟢 [RESOLVED] BE-08: Internal error messages leak cho client

---
### 🟢 [RESOLVED] BE-09: Admin có thể đổi role của bất kỳ user nào

---
### 🟢 [RESOLVED] BE-10: Race condition trong OTP creation

---
### 🟢 [RESOLVED] BE-11: Không có rate limiting trên IoT telemetry

---
### 🟢 [RESOLVED] BE-12: AI error message leak exception internals

---
### 🟢 [RESOLVED] BE-13: SMTP TLS không verify

---
### 🟢 [RESOLVED] BE-15: Alert API không có pagination

---
### 🟢 [RESOLVED] BE-16: Chat message không có length limit

---
### 🟢 [RESOLVED] BE-17: Password policy regex đếm chars không phải bytes

---
### 🟢 [RESOLVED] BE-18: ChangePassword không enforce old != new

---
### 🟢 [RESOLVED] BE-19: Generated random password predictable

---
### 🟢 [RESOLVED] FE-01: POST request tạo patient thiếu Authorization header

---
### 🟢 [RESOLVED] FE-02: Canvas CSS variables không render được

---
### 🟢 [RESOLVED] FE-03: Dev OTP exposed in UI

---
### 🟢 [RESOLVED] FE-04: Stale closure gây WebSocket reconnect liên tục

---
### 🟢 [RESOLVED] FE-05: JWT token gửi qua WebSocket plaintext

---
### 🟢 [RESOLVED] FE-06: User data plaintext trong sessionStorage

---
### 🟢 [RESOLVED] FE-07: `useEffect` infinite loop risk

---
### 🟢 [RESOLVED] FE-08: `routeContent` useMemo missing dependencies

---
### 🟢 [RESOLVED] FE-09: `setTimeout` leaks không clear on unmount

---
### 🟢 [RESOLVED] MO-01: `DropdownButtonFormField` dùng `initialValue` (không tồn tại)

---
### 🟢 [RESOLVED] MO-02: `_currentIndex` reset trong `build()` gây infinite rebuild

---
### 🟢 [RESOLVED] MO-03: Unsafe cast `event['data']` không null check

---
### 🟢 [RESOLVED] MO-04: Unsafe `.toDouble()` trên null/incorrect-type value

---
### 🟢 [RESOLVED] MO-05: Production URL hardcoded trong source

---
### 🟢 [RESOLVED] MO-06: `authProvider.init()` chưa bao giờ được gọi

---
### 🟢 [RESOLVED] MO-07: Read error gây `deleteAll()` — xóa sạch credentials

---
### 🟢 [RESOLVED] MO-08: TextEditingController leak trong bottom sheets

---
### 🟢 [RESOLVED] MO-09: Banner flash timer không hoạt động đúng

---
### 🟢 [RESOLVED] MO-10: ECG buffer dùng `removeAt(0)` O(n)

---
### 🟢 [RESOLVED] AI-01: Exception detail leak cho API client

---
### 🟢 [RESOLVED] AI-05: `thal` field không có bounds

---
### 🟢 [RESOLVED] AI-06: Health endpoint leak model path

---
### 🟢 [RESOLVED] HW-02: HTTP endpoint — tất cả data gửi plaintext

---
### 🟢 [RESOLVED] HW-03: State machine logic bị overwrite

---
### 🟢 [RESOLVED] HW-04: Buffered frame bị drop khi server trả 400/404

---

## 6. Archive (Đã Sửa)

### 🟢 [RESOLVED] FE-15: `filteredPatients` recomputed mỗi render

### 🟢 [RESOLVED] FE-16: Interface definitions duplicate ở 5 files

### 🟢 [RESOLVED] FE-17: `any` types ở nhiều nơi

### 🟢 [RESOLVED] FE-18: Native `alert()` blocks UI thread

### 🟢 [RESOLVED] FE-19: `SystemSettings` chỉ lưu localStorage

### 🟢 [RESOLVED] FE-20: Missing `key` prop dùng array index

### 🟢 [RESOLVED] FE-21: `ICUCamera` empty dependency array

### 🟢 [RESOLVED] FE-22: `window.setTimeout` không lưu return value

