# 🫀 Hệ Thống Giám Sát Nhịp Tim & Chỉ Số Sinh Tồn Đa Nền Tảng (Smart Heart Patient Monitoring)

Hệ thống theo dõi sức khỏe và chỉ số sinh tồn của bệnh nhân (Nhịp tim, SpO2, Huyết áp, ECG) trong phòng hồi sức tích cực (ICU) thời gian thực. Dự án được chia tách thành cấu trúc phân rã kiến trúc (Multi-platform Clean Architecture) rõ ràng, hỗ trợ đầy đủ giao diện Web cao cấp và App di động chạy Native mượt mà.

---

## 📂 Giao Diện & Cấu Trúc Thư Mục Dự Án

```text
heart-monitor-workspace/
├── backend/                   # 🚀 Backend dịch vụ (Deploy lên Render)
│   ├── app/                   # FastAPI source code (WebSocket, Telemetry Simulator)
│   ├── .env                   # Thông tin cấu hình cơ sở dữ liệu Supabase
│   └── requirements.txt       # Danh sách thư viện Python
├── web_frontend/              # 🌐 Web Client (Deploy lên Vercel)
│   ├── src/                   # ReactJS + TypeScript + Vite (Font Futura)
│   ├── package.json
│   └── index.html
├── mobile_app/                # 📱 Mobile App (Build ra Android APK / iOS)
│   ├── lib/                   # Flutter App (Dart code - Font Futura)
│   │   ├── screens/           # Giao diện chính (Dashboard, Camera, Patients, Stats, Auth...)
│   │   ├── services/          # HTTP ApiService & WebSocket telemetry
│   │   └── widgets/           # Vẽ ECG Live & Quả tim 3D co bóp
│   ├── assets/fonts/          # Thư mục lưu trữ font Futura.ttf
│   └── pubspec.yaml           # Đăng ký thư viện và tài nguyên app
└── README.md                  # Hướng dẫn khởi chạy hệ thống
```

---

## 🚀 Các Tính Năng Nổi Bật Trên Cả Web & App

1. **Bật Tắt Chế Độ Sáng/Tối (Light/Dark Mode) 🌓**:
   * Chuyển đổi giao diện bằng icon Mặt trời/Mặt trăng ngay trên thanh menu đầu, tự động ghi nhớ trạng thái vào `localStorage` (Web) hoặc bộ nhớ máy (App).
   * Khi chuyển sang Light Mode, biểu đồ ECG tự động chuyển thành **giấy kẻ ô ly đỏ/trắng** cổ điển của bệnh viện để bác sĩ dễ đọc chỉ số.

2. **Quả Tim 3D Beat-sync Co Bóp 💓**:
   * Điểm đám mây (Point-cloud) 3D tự động quay quanh trục, co bóp theo tần số nhịp tim thực tế (BPM) của bệnh nhân qua các phép toán hình học chiếu không gian vẽ trên Canvas/CustomPainter.

3. **Điện Tâm Đồ Live ECG Waveform 📈**:
   * Vẽ chu kỳ sóng P-Q-R-S-T dạ quang mượt mà (60fps) giúp theo dõi sát sao nhịp tim sinh học.

4. **Camera Giả Lập ICU 📹**:
   * Chế độ camera hồng ngoại ban đêm (Night-Vision), giả lập nhịp thở phập phồng của bệnh nhân trên giường bệnh theo chu kỳ sóng Sin.

5. **Thống Kê Tự Vẽ Custom SVG & fl_chart 📊**:
   * Phân tích trực quan tỷ lệ cảnh báo nguy hiểm, xu hướng alarm 7 ngày qua của hệ thống.

6. **Dùng Chung Database Supabase**:
   * Đồng bộ hóa dữ liệu bệnh nhân, hồ sơ bệnh lý, tài khoản đăng nhập giữa Web và App di động.

---

## 🛠️ Hướng Dẫn Khởi Chạy Từng Thành Phần

### 🚀 1. Khởi Chạy Backend (FastAPI)

1. Mở cửa sổ Terminal và di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```
2. Kích hoạt môi trường ảo Python (thư mục `.venv` nằm ở thư mục gốc):
   * **Windows (PowerShell)**:
     ```powershell
     ..\.venv\Scripts\activate
     ```
   * **macOS/Linux**:
     ```bash
     source ../.venv/bin/activate
     ```
3. Cài đặt các thư viện (chỉ thực hiện ở lần đầu tiên):
   ```bash
   pip install -r requirements.txt
   ```
4. Khởi chạy Server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   * *API hoạt động tại: `http://localhost:8000`*
   * *Swagger tài liệu API: `http://localhost:8000/docs`*

---

### 🌐 2. Khởi Chạy Web Frontend (React)

1. Mở cửa sổ Terminal thứ hai và di chuyển vào thư mục `web_frontend`:
   ```bash
   cd web_frontend
   ```
2. Cài đặt các thư viện Node modules:
   ```bash
   npm install
   ```
3. Khởi chạy Web Server:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt web truy cập: **[http://localhost:5173](http://localhost:5173)**

---

### 📱 3. Khởi Chạy & Biên Dịch Mobile App (Flutter)

* **Yêu cầu**: Máy tính đã cài đặt [Flutter SDK](https://docs.flutter.dev/get-started/install) và cấu hình biến môi trường thành công.
* **Cài Font**: Tải tệp tin `Futura.ttf` và lưu vào thư mục `mobile_app/assets/fonts/Futura.ttf` trước khi chạy.

1. Mở cửa sổ Terminal thứ ba và di chuyển vào thư mục `mobile_app`:
   ```bash
   cd mobile_app
   ```
2. Tải các gói thư viện Flutter:
   ```bash
   flutter pub get
   ```
3. Khởi chạy trên thiết bị ảo hoặc cắm cáp thiết bị thật:
   ```bash
   flutter run
   ```
4. Build xuất file APK cài đặt lên điện thoại Android:
   ```bash
   flutter build apk --release
   ```
   * *Tệp tin APK xuất ra tại: `build/app/outputs/flutter-apk/app-release.apk`*

---

## ⚠️ Lưu Ý Cấu Hình Địa Chỉ IP Khi Kiểm Thử App

* **Khi chạy trên Thiết bị giả lập (Android Emulator)**:
  Ứng dụng đã được cấu hình mặc định trỏ về máy chủ phát triển qua địa chỉ IP `10.0.2.2:8000` (Localhost chuyển tiếp của Emulator). Bạn không cần thay đổi gì.

* **Khi cắm cáp chạy trên Điện thoại thật**:
  Điện thoại và máy tính chạy server của bạn **bắt buộc phải kết nối chung một mạng Wi-Fi**. Bạn cần:
  1. Tìm địa chỉ IP mạng nội bộ của máy tính bạn (Ví dụ: `192.168.1.15`).
  2. Mở file [api_service.dart](file:///D:/STCN/heart-monitor/mobile_app/lib/services/api_service.dart#L6) và sửa dòng cấu hình `baseUrl`:
     ```dart
     static String baseUrl = 'http://192.168.1.15:8000'; // Thay thế IP máy tính của bạn
     ```
  3. Mở file [websocket_service.dart](file:///D:/STCN/heart-monitor/mobile_app/lib/services/websocket_service.dart#L5) và sửa dòng cấu hình `wsUrl`:
     ```dart
     static String wsUrl = 'ws://192.168.1.15:8000/ws/realtime'; // Thay thế IP máy tính của bạn
     ```
