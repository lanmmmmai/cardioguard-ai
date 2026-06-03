# Hướng Dẫn Triển Khai CardioGuard AI (Docker, Supabase, Render, Vercel)

Tài liệu này hướng dẫn chi tiết cách chạy dự án **CardioGuard AI** trên máy cục bộ bằng Docker và đưa dự án lên môi trường production online sử dụng Supabase, Render, và Vercel.

---

## Mục lục
1. [Triển khai Cục bộ với Docker Compose](#1-triển-khai-cục-bộ-với-docker-compose)
2. [Thiết lập Cơ sở dữ liệu Supabase (PostgreSQL)](#2-thiết-lập-cơ-sở-dữ-liệu-supabase-postgresql)
3. [Triển khai Backend lên Render (FastAPI)](#3-triển-khai-backend-lên-render-fastapi)
4. [Triển khai Frontend lên Vercel (React + Vite)](#4-triển-khai-frontend-lên-vercel-react--vite)
5. [Cấu hình thiết bị IoT / ESP32](#5-cấu-hình-thiết-bị-iot--esp32)

---

### 1. Triển khai Cục bộ với Docker Compose

Docker Compose cho phép khởi chạy đồng thời cả **Backend (FastAPI)** và **Frontend (React)** cùng với các cấu hình môi trường đầy đủ.

#### Bước 1.1: Chuẩn bị file môi trường
Tạo file `.env` tại thư mục gốc bằng cách sao chép file cấu hình mẫu:
```bash
cp .env.docker.example .env
```

Cập nhật các tham số tối thiểu trong `.env`:
*   `DATABASE_URL`: Địa chỉ kết nối đến cơ sở dữ liệu PostgreSQL của bạn (cục bộ hoặc Supabase).
*   `SECRET_KEY`: Khóa bảo mật ký JWT (độ dài tối thiểu 32 ký tự, không được để mặc định).

#### Bước 1.2: Biên dịch và Khởi chạy
Chạy lệnh sau để Docker tự động build image và khởi chạy các container:
```bash
docker compose up --build -d
```

#### Bước 1.3: Quản lý Docker Container
Dưới đây là một số lệnh thường dùng để kiểm soát và quản lý hệ thống qua Docker:

*   **Xem logs trực tiếp của toàn hệ thống**:
    ```bash
    docker compose logs -f
    ```
*   **Xem logs trực tiếp của Backend**:
    ```bash
    docker compose logs -f backend
    ```
*   **Xem logs trực tiếp của Web Frontend**:
    ```bash
    docker compose logs -f web
    ```
*   **Chạy toàn bộ migrations cơ sở dữ liệu trong Docker**:
    ```bash
    docker compose exec backend python scripts/run_all_migrations.py
    ```
*   **Tạo dữ liệu mẫu (Seeder)**:
    ```bash
    docker compose exec backend python scripts/seed_data.py
    ```
*   **Dừng các container**:
    ```bash
    docker compose down
    ```

---

### 2. Thiết lập Cơ sở dữ liệu Supabase (PostgreSQL)

Supabase cung cấp cơ sở dữ liệu PostgreSQL đám mây mạnh mẽ, được tối ưu hóa cho ứng dụng của chúng ta.

#### Bước 2.1: Tạo dự án Supabase
1.  Truy cập [Supabase](https://supabase.com) và đăng nhập.
2.  Tạo một dự án mới (**New Project**), đặt tên và thiết lập mật khẩu cơ sở dữ liệu (**Database Password**). Hãy lưu lại mật khẩu này.
3.  Chọn khu vực (**Region**) gần người dùng của bạn nhất (ví dụ: Singapore - `ap-southeast-1`).

#### Bước 2.2: Lấy chuỗi kết nối (Database Connection String)
1.  Vào mục **Project Settings** > **Database**.
2.  Tìm phần **Connection string** và chọn tab **URI**.
3.  Sao chép chuỗi kết nối hiển thị.
    *   *Lưu ý*: Supabase cung cấp cổng **Direct Connection** (`5432`) và **Transaction Pooler** (`6543`, khuyên dùng kèm tham số `?pgbouncer=true`).
    *   Ứng dụng CardioGuard AI đã được cấu hình connection pool nhỏ tối ưu đặc biệt cho Supabase Transaction Pooler (cổng `6543`).
4.  **Cực kỳ quan trọng**: Vì backend sử dụng thư viện kết nối không đồng bộ `asyncpg` của Python, bạn **phải thay đổi tiền tố** từ `postgresql://` hoặc `postgres://` thành **`postgresql+asyncpg://`**.
    *   *Ví dụ chuỗi kết nối gốc*:
        `postgres://postgres.xxxx:your-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
    *   *Chuỗi sửa đổi để điền vào `DATABASE_URL`*:
        `postgresql+asyncpg://postgres.xxxx:your-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

#### Bước 2.3: Thực thi cơ sở dữ liệu (Migrations & Seeder)
Để áp dụng toàn bộ cấu trúc bảng và dữ liệu mẫu lên database Supabase từ máy của bạn:
1.  Mở thư mục `backend/` trên máy cục bộ của bạn.
2.  Kích hoạt môi trường ảo Python và cài đặt thư viện:
    ```bash
    python3 -m venv .venv
    
    # Trên Windows:
    .venv\Scripts\activate
    # Trên macOS/Linux:
    source .venv/bin/activate
    
    pip install -r requirements.txt
    ```
3.  Tạo hoặc sửa file `backend/.env` hoặc `.env` tại thư mục gốc, điền chuỗi kết nối Supabase đã sửa đổi vào biến `DATABASE_URL`:
    ```env
    DATABASE_URL=postgresql+asyncpg://postgres.xxxx:your-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
    SECRET_KEY=nut_bam_bi_mat_rat_manh_va_dai_tren_32_ky_tu_12345
    ```
4.  Chạy script tự động áp dụng toàn bộ migrations lên Supabase:
    ```bash
    python scripts/run_all_migrations.py
    ```
5.  *(Tùy chọn)* Đổ dữ liệu mẫu (Seeder) lên Supabase để hiển thị bảng điều khiển đẹp mắt hơn:
    ```bash
    python scripts/seed_data.py
    ```

---

### 3. Triển khai Backend lên Render (FastAPI)

Render là nền tảng PaaS rất phù hợp để chạy ứng dụng FastAPI. Chúng ta sẽ triển khai thông qua Dockerfile đã chuẩn bị sẵn để đảm bảo tính nhất quán môi trường.

#### Bước 3.1: Tạo Web Service mới trên Render
1.  Đăng nhập vào [Render](https://render.com).
2.  Chọn **New +** > **Web Service**.
3.  Kết nối với kho lưu trữ Git (GitHub hoặc GitLab) chứa mã nguồn dự án của bạn.

#### Bước 3.2: Cấu hình Service trên Render
*   **Name**: `cardioguard-backend`
*   **Environment / Runtime**: Chọn **Docker** (Render sẽ tự động build từ Dockerfile).
*   **Docker Context**: `.` (để trống hoặc dùng dấu chấm để trỏ về thư mục gốc của dự án).
*   **Dockerfile Path**: `backend/Dockerfile` (chỉ ra đường dẫn đến Dockerfile của backend).
*   **Branch**: Nhánh git bạn muốn triển khai (ví dụ: `main` hoặc `phuc-bang`).

#### Bước 3.3: Khai báo các biến môi trường (Environment Variables)
Nhấp vào nút **Advanced** > **Add Environment Variable** để điền các biến sau:

| Tên biến | Giá trị mẫu / Mô tả |
| :--- | :--- |
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `postgresql+asyncpg://...` *(Chuỗi kết nối Supabase đã có `+asyncpg`)* |
| `SECRET_KEY` | *(Khóa bí mật JWT ngẫu nhiên dài hơn 32 ký tự)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `EXPOSE_DEV_OTP` | `false` |
| `FRONTEND_ORIGINS` | `https://your-frontend-app.vercel.app` *(Đường dẫn trang web Frontend của bạn sau khi deploy lên Vercel để cho phép CORS)* |
| `OPENAI_API_KEY` | *(Khóa API OpenAI nếu dùng trợ lý chatbot AI)* |
| `BREVO_API_KEY` | *(Khóa API email của Brevo để gửi mã OTP kích hoạt)* |

#### Bước 3.4: Kích hoạt triển khai
1.  Nhấp vào **Create Web Service**.
2.  Render sẽ tiến hành tải mã nguồn, build docker image và khởi chạy container.
3.  Sau khi hoàn tất, Render sẽ cung cấp cho bạn một đường dẫn dạng: `https://cardioguard-backend.onrender.com`. Đây chính là đường dẫn API chính thức của ứng dụng.

---

### 4. Triển khai Frontend lên Vercel (React + Vite)

Frontend sử dụng React, TypeScript và Vite, được tối ưu hóa tốt nhất khi triển khai lên Vercel và hỗ trợ tính năng SEO/Meta-tags SSR thông qua Vercel Serverless Functions.

#### Bước 4.1: Tạo Project mới trên Vercel
1.  Đăng nhập vào [Vercel](https://vercel.com).
2.  Nhấp vào **Add New** > **Project**.
3.  Chọn kho lưu trữ chứa mã nguồn dự án của bạn.

#### Bước 4.2: Cấu hình Build Settings
*   **Framework Preset**: Chọn **Vite**.
*   **Root Directory**: Nhấp chọn **Edit** và chọn thư mục **`web_frontend`**.
*   **Build & Development Settings**:
    *   *Build Command*: `npm run build`
    *   *Output Directory*: `dist`

#### Bước 4.3: Thiết lập các biến môi trường trên Vercel
Các biến này dùng trong cả quá trình build code React (Build-time) và chạy API SEO Serverless (Run-time):

1.  **VITE_API_URL**: Địa chỉ URL backend Render của bạn.
    *   *Ví dụ*: `https://cardioguard-backend.onrender.com`
2.  **VITE_WS_URL**: Địa chỉ WebSocket của backend Render.
    *   *Lưu ý*: Phải bắt đầu bằng `wss://` thay vì `ws://` khi chạy online trên giao thức HTTPS/WSS bảo mật.
    *   *Ví dụ*: `wss://cardioguard-backend.onrender.com/ws/realtime`
3.  **BACKEND_API_URL**: *(Dùng cho hàm SEO)* Cùng giá trị với `VITE_API_URL`.
    *   *Ví dụ*: `https://cardioguard-backend.onrender.com`
4.  **BACKEND_WS_URL**: *(Dùng cho hàm SEO)* Cùng giá trị với `VITE_WS_URL`.
    *   *Ví dụ*: `wss://cardioguard-backend.onrender.com/ws/realtime`
5.  **PUBLIC_SITE_URL**: Đường dẫn trang web của bạn (sẽ cập nhật sau khi Vercel sinh domain, hoặc điền domain custom của bạn).
    *   *Ví dụ*: `https://cardioguard-dashboard.vercel.app`

Nhấp **Deploy**. Vercel sẽ tiến hành biên dịch và cung cấp cho bạn một địa chỉ URL web dashboard công khai.

---

### 5. Cấu hình thiết bị IoT / ESP32

Sau khi backend chính thức chạy online thành công trên Render:
1.  Mở mã nguồn firmware của ESP32 tại [hardware/esp32_s3_supermini/firmware/include/config.h](file:///e:/AIoT/cardioguard-ai/hardware/esp32_s3_supermini/firmware/include/config.h).
2.  Cập nhật các thông số kết nối:
    *   `kWifiSsid`: Tên mạng Wifi nơi thiết bị hoạt động.
    *   `kWifiPassword`: Mật khẩu Wifi.
    *   `kTelemetryEndpoint`: Trỏ tới URL backend Render của bạn.
        *   *Ví dụ*: `"https://cardioguard-backend.onrender.com/iot/telemetry"`
    *   `kDeviceToken`: Token bảo mật của thiết bị (đã được tạo thông qua API `/iot/devices/{device_uid}/rotate-token` trên admin dashboard hoặc gieo trực tiếp trong DB).

---

*Xem thêm tài liệu chính tại [README.md](file:///e:/AIoT/cardioguard-ai/README.md) để có cái nhìn tổng quan về hệ thống và cấu trúc các thư mục.*
