# Hướng Dẫn Chạy Dự Án Bằng Docker & Make

Tài liệu này cung cấp hướng dẫn chi tiết và đầy đủ cách thiết lập, chạy thử nghiệm, di chuyển cơ sở dữ liệu (migration), và vận hành toàn bộ hệ thống CardioGuard AI bằng sự kết hợp giữa **Docker** và **Makefile**.

---

## 1. Tổng Quan Về Makefile

Makefile ở thư mục gốc của dự án hoạt động như một trung tâm điều phối (unified command center). Thay vì phải gõ các câu lệnh dài dòng hoặc di chuyển qua lại giữa các thư mục, bạn chỉ cần sử dụng lệnh `make <tên-lệnh>`.

Để hiển thị danh sách tất cả các lệnh được hỗ trợ và mô tả của chúng:
```bash
make help
```

---

## 2. Các Lệnh Vận Hành Chi Tiết

Dưới đây là bảng tổng hợp tất cả các lệnh được thiết lập sẵn trong dự án:

| Lệnh `make` | Nhóm chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| `make setup` | Cài đặt ban đầu | Khởi tạo venv cho backend, cài đặt dependencies cho cả Backend (pip) và Frontend (npm), tạo tệp cấu hình `.env` mẫu từ bản clone. |
| `make dev` | Khởi chạy | Biên dịch và chạy đồng thời Backend và Web Frontend ở chế độ **foreground** (xem log trực tiếp trên màn hình). |
| `make dev-detached`| Khởi chạy ngầm | Biên dịch và chạy toàn bộ container ở chế độ **background (ngầm)**, trả lại quyền điều khiển terminal. |
| `make dev-backend` | Chạy local | Chỉ khởi chạy một mình Backend cục bộ bằng Uvicorn không qua Docker (hỗ trợ hot-reload). |
| `make dev-frontend` | Chạy local | Chỉ khởi chạy một mình Frontend cục bộ bằng Vite không qua Docker (hỗ trợ hot-reload). |
| `make build` | Biên dịch | Biên dịch lại toàn bộ Docker images của dự án. |
| `make migrate` | Cơ sở dữ liệu | Chạy toàn bộ các file SQL migrations (`backend/migrations/`) trên database. |
| `make migrate-force`| Cơ sở dữ liệu | Cập nhật lại toàn bộ checksum của migrations (sửa lỗi checksum drift khi thay đổi cấu trúc). |
| `make seed` | Cơ sở dữ liệu | Gieo dữ liệu giả lập (bệnh nhân mẫu, tài khoản mẫu, lịch hẹn mẫu) để kiểm thử. |
| `make db-reset` | Cơ sở dữ liệu | **Cảnh báo xóa sạch**: Xóa bỏ tất cả các bảng trong DB của dự án. |
| `make test` | Kiểm thử | Chạy tất cả các unit/integration test của cả Backend và Web Frontend. |
| `make test-backend` | Kiểm thử | Chỉ chạy unit test của Backend. |
| `make test-frontend`| Kiểm thử | Chỉ chạy unit test của Frontend. |
| `make clean` | Dọn dẹp | Xóa bỏ caches Python (`__pycache__`), cache Node, thư mục build `dist`. |
| `make clean-all` | Dọn dẹp | Thực hiện `make clean` và xóa sạch `.venv` cùng `node_modules` (dùng khi muốn cài đặt lại từ đầu). |
| `make docker-down` | Docker | Dừng và xóa bỏ hoàn toàn các container, mạng ảo Docker. |
| `make docker-logs` | Docker | Xem logs của tất cả các container đang chạy. |
| `make docker-logs-backend` | Docker | Chỉ xem logs của Backend container. |
| `make docker-logs-web` | Docker | Chỉ xem logs của Frontend container. |
| `make deploy` | Triển khai | Đẩy code lên Git để kích hoạt CI/CD tự động build lên Render/Vercel. |

---

## 3. Quy Trình Chạy Dự Án Từng Bước (Step-by-Step)

### Bước 1: Chuẩn bị môi trường
1. Hãy chắc chắn rằng bạn đã mở **Docker Desktop** trên máy.
2. Tạo tệp `.env` cấu hình dùng chung ở thư mục gốc:
   ```bash
   cp .env.docker.example .env
   ```
3. Tạo tệp `.env` cấu hình chi tiết cho backend tại `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   *(Điền địa chỉ kết nối Database Supabase của bạn vào biến `DATABASE_URL` trong file này).*

### Bước 2: Khởi tạo và đồng bộ dependencies
Chạy lệnh setup để khởi tạo virtual environment và cài đặt dependencies cho các thư mục:
```bash
make setup
```

### Bước 3: Khởi chạy hệ thống bằng Docker
Khởi chạy ngầm toàn bộ dịch vụ:
```bash
make dev-detached
```
*Lưu ý: Nếu bạn muốn theo dõi log trực tiếp trên màn hình, hãy chạy lệnh `make dev`.*

### Bước 4: Chạy database migrations
Để cấu trúc bảng cơ sở dữ liệu được cập nhật mới nhất:
```bash
make migrate
```

### Bước 5: Gieo dữ liệu thử nghiệm
Khởi tạo các tài khoản bệnh nhân, bác sĩ và lịch hẹn mẫu:
```bash
make seed
```

---

## 4. Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

### 1. Lỗi cổng kết nối đã bị chiếm dụng (`Port 8000 already in use`)
* **Nguyên nhân**: Có một tiến trình uvicorn chạy ngầm hoặc một container Docker cũ chưa được tắt hoàn toàn.
* **Khắc phục**: Chạy lệnh giải phóng Docker:
  ```bash
  make docker-down
  ```

### 2. Lỗi `dependency failed to start: container ... exited (137)` hoặc xung đột container
* **Nguyên nhân**: Xảy ra khi bạn chạy nhiều lệnh `docker compose up` hoặc `make dev` song song ở các cửa sổ terminal khác nhau gây tranh chấp.
* **Khắc phục**:
  1. Tắt hết các terminal đang chạy `make dev`.
  2. Dọn sạch các container cũ bằng cách chạy:
     ```bash
     make docker-down
     ```
  3. Khởi chạy lại:
     ```bash
     make dev-detached
     ```

### 3. Lỗi lockfile không khớp (`npm ci` fail)
* **Nguyên nhân**: File `package.json` vừa được cập nhật thêm dependency mới nhưng lockfile `package-lock.json` chưa được cập nhật tương ứng trên máy host.
* **Khắc phục**: Di chuyển vào thư mục frontend và chạy `npm install` để cập nhật lockfile trên máy host trước khi build lại Docker:
  ```bash
  cd web_frontend
  npm install
  cd ..
  make dev-detached
  ```
