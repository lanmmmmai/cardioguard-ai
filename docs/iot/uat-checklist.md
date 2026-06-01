# AIoT UAT Checklist

Checklist xác nhận end-to-end trước khi release.

## A. Device and mapping

- [ ] Thiết bị có `device_mac` đúng trong DB.
- [ ] Thiết bị được gắn đúng `patient_id`.
- [ ] Token thiết bị đã rotate và nạp vào firmware.

## B. Ingest API

- [ ] `POST /iot/telemetry` trả `200` với token đúng.
- [ ] Token sai trả `401`.
- [ ] MAC sai format trả `400`.
- [ ] MAC chưa pair trả `404`.
- [ ] Thiết bị `revoked/inactive/blocked` trả `403`.

## C. Data persistence

- [ ] Mỗi telemetry thành công tạo row mới trong `sensor_data`.
- [ ] `devices.last_seen_at` cập nhật theo lần gửi gần nhất.
- [ ] `devices.battery` cập nhật nếu payload có field `device.battery`.

## D. Alerting

- [ ] `spo2 < 92` tạo `LOW_SPO2`.
- [ ] `heart_rate > 120` tạo `HIGH_HEART_RATE`.
- [ ] `heart_rate < 50` tạo `LOW_HEART_RATE`.
- [ ] `abs(ecg_value) > 0.8` tạo `ABNORMAL_ECG`.
- [ ] BP null không tạo `HIGH_BLOOD_PRESSURE`.

## E. Realtime and roles

- [ ] Patient thấy dữ liệu của chính mình realtime.
- [ ] Doctor chỉ thấy bệnh nhân được assign trong `doctor_patient`.
- [ ] Admin thấy đầy đủ.
- [ ] WS có `health_metrics` và `emergency_alerts` đúng payload.

## F. Operational scenarios

- [ ] Mất Wi-Fi tạm thời: firmware buffer lại và gửi tiếp khi online.
- [ ] `429/5xx`: firmware backoff, không spam.
- [ ] `401/403`: firmware dừng gửi nhanh và báo auth failure.
