# 🫀 Hệ Thống Giám Sát Nhịp Tim & Chỉ Số Sinh Tồn Thời Gian Thực (Smart Heart Patient Monitoring)

Hệ thống theo dõi sức khỏe và chỉ số sinh tồn của bệnh nhân (Nhịp tim, SpO2, Huyết áp, ECG) trong phòng hồi sức tích cực (ICU) thời gian thực. Ứng dụng được thiết kế tối ưu cho cả giao diện Web và App di động (hỗ trợ PWA & Capacitor), mang lại trải nghiệm mượt mà, cao cấp với cả hai chế độ giao diện Sáng (Light Mode) và Tối (Dark Mode).

---

## 🚀 Tính Năng Nổi Bật

### 1. Bật Tắt Giao Diện Sáng/Tối (Light/Dark Mode) 🌓
* Nút chuyển đổi giao diện bằng icon **Mặt trời (Sun) / Mặt trăng (Moon)** ngay trên thanh điều hướng đầu trang.
* Tự động lưu trạng thái theme đã chọn vào `localStorage` để duy trì giao diện ở các phiên truy cập sau.
* Sử dụng hệ thống **CSS Custom Variables (Vanilla CSS)** giúp chuyển đổi giao diện mượt mà và tối ưu hiệu suất.
* Biểu đồ ECG tự động chuyển sang chế độ **giấy kẻ ô ly y tế đỏ/trắng** cổ điển khi ở chế độ Light Mode, giúp y bác sĩ dễ dàng quan sát như trên giấy đo thực tế.

### 2. Mô Phỏng Quả Tim 3D Beat-sync Co Bóp 3D 💓
* Point-cloud (đám mây điểm) 3D mô phỏng hình dáng quả tim chuyển động quay tự do vẽ bằng HTML5 Canvas 60fps.
* Nhịp co bóp (heartbeat contraction) của quả tim 3D tự động đồng bộ theo nhịp tim (BPM) thực tế của bệnh nhân đang được chọn.

### 3. Biểu Đồ Điện Tâm Đồ Live ECG Waveform 📈
* Vẽ đường sóng tim P-Q-R-S-T chuẩn y khoa thời gian thực trên Canvas với hiệu ứng phát sáng neon dạ quang mượt mà.
* Tự động giả lập tín hiệu nhiễu nhẹ ở đường cơ sở để tăng tính chân thực khi không có tín hiệu truyền từ cảm biến.

### 4. Camera Giả Lập Hồng Ngoại Phòng ICU 📹
* Giao diện mô phỏng camera giám sát giường bệnh hồng ngoại / thân nhiệt (Night-Vision) tại giường ICU số 04.
* Mô phỏng chuyển động thở sinh học (Chest rise expansion) phập phồng ở ngực bệnh nhân trên giường bệnh theo thời gian thực.
* HUD camera hiển thị đầy đủ thông tin thời gian chạy, nhấp nháy icon ghi hình "REC" và vạch pin của máy quay.

### 5. Thống Kê & Phân Tích Chỉ Số Custom SVG 📊
* Biểu đồ **Donut SVG tự vẽ**: Phân tích tỷ lệ mức độ cảnh báo (Cao - Trung bình - Thấp) dựa trên lịch sử dữ liệu thu được.
* Biểu đồ **Vùng phát sáng neon SVG (Area Chart)**: Theo dõi tần suất xuất hiện cảnh báo của hệ thống trong 7 ngày qua.

### 6. Hồ Sơ Bệnh Nhân Chi Tiết & Biểu Đồ Tiến Độ (Dossier) 📁
* Quản lý danh sách bệnh nhân kèm chỉ số phân loại trạng thái bằng màu sắc cảnh báo động.
* Khi nhấn xem chi tiết bệnh nhân, hệ thống hiển thị hồ sơ bệnh án, lịch sử cảnh báo và **hai biểu đồ đường SVG vẽ trực tiếp** theo dõi xu hướng Nhịp tim (BPM) và nồng độ oxy trong máu SpO2 (%) trong thời gian thực.

---

## 🛠️ Công Nghệ Sử Dụng

### Backend
* **FastAPI**: Framework Python hiệu năng cao để xây dựng RESTful APIs và WebSocket Server.
* **SQLAlchemy / asyncpg**: Thư viện ORM hỗ trợ kết nối cơ sở dữ liệu phi đồng bộ (async/await).
* **PostgreSQL (Supabase)**: Cơ sở dữ liệu lưu trữ hồ sơ bệnh nhân, tài khoản người dùng và nhật ký cảnh báo.
* **WebSockets**: Truyền phát các gói dữ liệu sinh tồn từ các cảm biến giả lập tới clients theo thời gian thực mà không bị trễ.
* **Auth**: Bảo mật tài khoản sử dụng JWT tokens, thư viện `passlib` và mã hóa mật khẩu `bcrypt`.

### Frontend
* **ReactJS (Vite)**: Thư viện xây dựng giao diện người dùng nhanh chóng, tối ưu hóa kích thước bundle.
* **TypeScript**: Ràng buộc kiểu dữ liệu tĩnh nghiêm ngặt giúp giảm thiểu lỗi runtime.
* **Vanilla CSS**: Hệ thống giao diện được code tay 100% bằng CSS thuần để có thể tùy biến sâu các hiệu ứng Glassmorphic và Neon.
* **Lucide Icons**: Bộ icon vector sắc nét, nhẹ và hiện đại.

---

## 📂 Cấu Trúc Thư Mục Dự Án

```text
heart-monitor/
├── app/                  # FastAPI Backend source code
│   ├── api/              # Các router endpoints (Auth, Patients, Sensors, Alerts, WebSockets)
│   ├── core/             # Cấu hình hệ thống, biến môi trường và kết nối DB
│   ├── models/           # Định nghĩa các bảng Database (User, Patient, Alert)
│   ├── schemas/          # Pydantic schemas để validate đầu vào/ra API
│   ├── services/         # Logic nghiệp vụ (Giả lập sinh dữ liệu telemetry cảm biến)
│   ├── websocket/        # Quản lý danh sách connections của real-time WebSocket
│   └── main.py           # Điểm khởi chạy ứng dụng FastAPI
├── frontend/             # React Frontend source code
│   ├── public/           # Các assets tĩnh, PWA manifest, service worker và launcher icon
│   ├── src/
│   │   ├── components/   # Các màn hình chức năng (Dashboard, ICUCamera, Patients, PatientDetail, Stats...)
│   │   ├── hooks/        # Hook tự động kết nối và reconnect WebSocket
│   │   ├── App.tsx       # Quản lý routing chính, Auth state và giao diện khung (gồm theme toggler)
│   │   ├── index.css     # Định nghĩa biến CSS variables, Light Mode overrides và toàn bộ styles
│   │   └── main.tsx      # Điểm render React root
│   ├── tsconfig.json     # Cấu hình TypeScript
│   └── vite.config.ts    # Cấu hình Vite bundler
├── .env                  # Lưu trữ chuỗi kết nối Database URL (Supabase)
└── requirements.txt      # Danh sách thư viện Python của Backend
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Dự Án

### Prerequisites
* Máy tính đã cài đặt **Python 3.10+** và **Node.js 18+**.

---

### Bước 1: Thiết Lập & Chạy Backend FastAPI

1. **Di chuyển vào thư mục gốc của dự án**:
   ```bash
   cd heart-monitor
   ```

2. **Tạo và kích hoạt môi trường ảo Python (Virtual Environment)**:
   * Trên Windows (PowerShell):
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   * Trên macOS/Linux:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Cài đặt các thư viện dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Kiểm tra file `.env` ở thư mục gốc**:
   Đảm bảo tệp chứa cấu hình đường dẫn kết nối PostgreSQL của Supabase:
   ```env
   DATABASE_URL=postgresql+asyncpg://...
   ```

5. **Khởi động server Backend**:
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   * *Backend API sẽ hoạt động tại: `http://localhost:8000`*
   * *Trang tài liệu tương tác Swagger UI: `http://localhost:8000/docs`*

---

### Bước 2: Thiết Lập & Chạy Frontend React (Vite)

1. **Mở một cửa sổ terminal mới và di chuyển vào thư mục `frontend`**:
   ```bash
   cd heart-monitor/frontend
   ```

2. **Cài đặt các thư viện Node modules**:
   ```bash
   npm install
   ```

3. **Khởi chạy ứng dụng ở chế độ Development**:
   ```bash
   npm run dev
   ```

4. **Truy cập ứng dụng**:
   Mở trình duyệt web và truy cập: **[http://localhost:5173](http://localhost:5173)**

---

## 🧪 Quy Trình Thử Nghiệm Giao Diện & Giả Lập Hệ Thống

1. **Đăng Ký / Đăng Nhập**:
   * Truy cập giao diện, chọn nút **Đăng ký ngay** để tạo tài khoản bác sĩ/y tá mới.
   * Tiến hành đăng nhập bằng tài khoản vừa tạo để truy cập vào hệ thống giám sát.

2. **Quản Lý Bệnh Bệnh**:
   * Vào mục **Hồ Sơ Bệnh Nhân**, nhấn **Thêm Bệnh Nhân Mới**.
   * Nhập thông tin (Tên tuổi, tiền sử bệnh lý) để lưu hồ sơ vào cơ sở dữ liệu đám mây Supabase.

3. **Bật Tắt Theme**:
   * Nhấn vào nút hình Mặt trời/Mặt trăng trên thanh công cụ đầu trang để thấy toàn bộ giao diện chuyển đổi giữa chế độ Light và Dark Mode mượt mà.

4. **Kiểm Tra Cảnh Báo Telemetry Real-time**:
   * Vào trang **Hệ Thống Giám Sát**.
   * Nhấn nút **Giả lập Bình thường**: Hệ thống sẽ bắn tín hiệu nhịp tim ổn định (khoảng 70-80 BPM, SpO2 ~ 98%). Quả tim 3D co bóp nhịp nhàng, đường ECG đi đều đặn.
   * Nhấn nút **Giả lập Bất thường**: Cảm biến giả lập phát tín hiệu rối loạn (nhịp tim vọt lên >140 BPM, SpO2 sụt giảm nghiêm trọng <90%). Hệ thống sẽ ngay lập tức:
     * Viền thẻ nhịp tim/SpO2 chớp nhấp nháy đỏ dạ quang cảnh báo.
     * Hiện thanh banner màu đỏ tươi nổi bật báo hiệu nguy kịch kèm còi báo động ảo trên đầu trang.
     * Tự động thêm bản ghi cảnh báo mới vào mục **Cảnh Báo Hệ Thống** theo thời gian thực.
