# AIoT Runbook

Runbook vận hành cho CardioGuard AIoT pipeline.

## 1) Onboard thiết bị

1. Xác định MAC thật của ESP (`A8:42:E3:11:22:33`).
2. Cập nhật `devices`:
   - `device_mac` = MAC thật
   - `patient_id` = bệnh nhân cần gắn
   - `status` = `active` hoặc `online`
3. Rotate token qua API để lấy token riêng.
4. Nạp token mới vào firmware (`kDeviceToken`) và flash lại.

## 2) Kiểm tra nhanh sau deploy

1. Gửi test telemetry qua `POST /iot/telemetry`.
2. Kiểm tra có row mới trong `sensor_data`.
3. Kiểm tra `devices.last_seen_at` và `devices.battery` được cập nhật.
4. Kiểm tra WS dashboard nhận `health_metrics`.
5. Nếu bất thường, kiểm tra `alerts` và WS `emergency_alerts`.

## 3) Xử lý lỗi thường gặp

`401 Invalid device token`:
- Rotate token và nạp lại firmware.
- Kiểm tra nhầm môi trường (`dev/staging/prod`) hay không.

`404 Device not paired`:
- Kiểm tra `devices.device_mac`.
- Kiểm tra `patient_id` đã gán chưa.

`403 Device is not allowed`:
- Kiểm tra `devices.status` có thuộc `revoked/inactive/blocked` không.

`Offline/stale trên dashboard`:
- Kiểm tra Wi-Fi/endpoint ở firmware.
- Kiểm tra backend đang chạy và nhận request.

## 4) Quy trình rotate token định kỳ

1. Gọi `POST /iot/devices/{uid}/rotate-token`.
2. Lưu token mới vào vault nội bộ.
3. Nạp token mới cho firmware.
4. Xác nhận telemetry hoạt động lại.
5. Xóa token cũ khỏi mọi nơi lưu tạm.

## 5) Log cần theo dõi

- `device_uid`, `device_mac`, `patient_id`
- `status_code` ingest
- `alerts count`
- `last_seen_at`
- `auth_failed` theo thiết bị
