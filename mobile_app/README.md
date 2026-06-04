# CardioGuard — Mobile App (Flutter)

Mobile app cho hệ thống giám sát sức khỏe CardioGuard AI. Hỗ trợ Android, macOS, Windows.

## Kiến trúc

- **State management**: Provider (`ChangeNotifierProvider`)
- **HTTP**: Dio + ApiClient wrapper (JWT interceptor)
- **Realtime**: WebSocket via `web_socket_channel` (role-aware)
- **Auth**: JWT token (login/register/forgot-password) + biometric (optional)
- **Charts**: `fl_chart` (ECG, SpO2), custom painters (ECG painter, 3D heart)

## Cấu trúc thư mục

```
lib/
├── config/          # AppConfig (baseUrl, wsUrl từ --dart-define)
├── core/            # ApiClient, AppLogger, SecureStorage
├── models/          # User, Patient, Alert, Appointment, MedicalRecord, etc.
├── providers/       # Auth, Patient, Alert, Chat, Appointment providers
├── screens/         # Login, Register, Dashboard, Patients, Alerts, Chat, Settings, Stats
├── services/        # WebSocketService
├── ui/              # CgTokens (colors/typography), CgTheme
└── widgets/         # ECG painter, 3D heart painter, book appointment sheet, CG widgets
```

## Chạy locally

```bash
cd mobile_app
flutter pub get
flutter run
```

Override API URLs (chạy cùng mạng LAN với backend):

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000
```

| --dart-define | Mặc định | Ghi chú |
|---------------|----------|---------|
| `API_BASE_URL` | `http://10.0.2.2:8000` | Android emulator. iOS cần `http://127.0.0.1:8000` |
| `WS_URL` | `ws://10.0.2.2:8000/ws/realtime` | WebSocket URL |

> **Lưu ý:** `10.0.2.2` là alias của host machine trên Android emulator. Trên iOS simulator dùng `127.0.0.1`.

## Build APK release

```bash
flutter build apk --release
```

## Tính năng chính

- Dashboard realtime: ECG chart, 3D heart animation, SpO2, huyết áp
- Danh sách bệnh nhân (doctor/admin), chi tiết + biểu đồ lịch sử
- Cảnh báo sức khỏe theo thời gian thực
- AI Chat (OpenAI / mock fallback)
- Đặt lịch hẹn với bác sĩ
- Quản lý hồ sơ, đổi mật khẩu
- Hỗ trợ dark/light theme

## Liên kết

- Backend API: `http://localhost:8000` (dev)
- Web dashboard: `http://localhost:5173` (dev)
