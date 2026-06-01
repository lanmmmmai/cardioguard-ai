# AIoT Security Policy

Policy bảo mật cho luồng thiết bị AIoT CardioGuard.

## 1) Device identity

- Mỗi thiết bị có định danh MAC riêng (`device_mac`).
- Mapping thiết bị -> bệnh nhân dựa trên dữ liệu backend, không dựa vào dữ liệu firmware tự khai.

## 2) Authentication

- Ưu tiên token riêng từng thiết bị (`device_token_hash`).
- Shared token chỉ dùng fallback tạm thời khi chưa migrate xong.
- Không dùng JWT user (patient/doctor/admin) trong firmware.

## 3) Token handling

- Token plaintext chỉ hiển thị một lần khi rotate.
- Backend chỉ lưu hash token.
- Không log token trong server log hoặc serial log.
- Rotate token định kỳ hoặc ngay khi nghi lộ thông tin.

## 4) Authorization

- Device ingest chỉ nhận telemetry cho thiết bị đã pair.
- Dashboard/WS theo RBAC:
  - `patient`: chỉ dữ liệu của chính mình
  - `doctor`: chỉ bệnh nhân được phân công
  - `admin`: toàn bộ

## 5) Data integrity

- Backend không tin `patient_id` từ firmware.
- Chuẩn hóa MAC (bỏ `:`/`-`, lowercase) trước khi map.
- Từ chối thiết bị `revoked/inactive/blocked`.

## 6) Operational safeguards

- Áp dụng rate limit cho ingest endpoint trong môi trường production.
- Theo dõi tần suất lỗi `401/403` theo thiết bị để phát hiện token leak.
- Bật audit log cho các thao tác:
  - đổi mapping thiết bị
  - rotate token
  - thay đổi trạng thái thiết bị
