# CardioGuard AIoT Operating Plan

Kế hoạch vận hành thiết bị AIoT cho hệ thống CardioGuard AI, kết hợp thiết bị IoT đeo tay, truyền dữ liệu sinh hiệu realtime và lớp AI phân tích bất thường sức khỏe.

## Mục tiêu

Giai đoạn đầu tiên của phần cứng CardioGuard AI là tạo một prototype thiết bị đeo giống đồng hồ theo dõi sức khỏe:

- Mỗi thiết bị ESP32-S3 SuperMini gắn với đúng một bệnh nhân.
- Thiết bị gửi dữ liệu sinh hiệu realtime lên hệ thống.
- Hệ thống được định hướng theo mô hình AIoT: thiết bị IoT thu thập dữ liệu sinh hiệu, backend tiếp nhận dữ liệu realtime, lớp AI phân tích bất thường và dashboard hiển thị cảnh báo cho bác sĩ/bệnh nhân.
- Giai đoạn prototype, AI có thể xử lý bằng rule-based, Z-score hoặc Isolation Forest trên dữ liệu random có kiểm soát.
- Khi chuyển sang cảm biến thật, AI tiếp tục sử dụng cùng telemetry frame để đánh giá bất thường từ dữ liệu MAX30102, AD8232 và MPU6050.
- Giai đoạn đầu chưa cần cảm biến thật; ESP32 sẽ gửi dữ liệu random có kiểm soát để kiểm tra luồng end-to-end.
- Khi chuyển sang cảm biến thật, luồng hệ thống không đổi; chỉ thay lớp tạo dữ liệu random bằng lớp đọc cảm biến thật.

Thiết bị không tự quyết định `patient_id`. Hệ thống quản lý mapping `device_uid -> patient_id`.

## Kiểm tra với luồng ứng dụng thực tiễn

Luồng này phù hợp với cách các ứng dụng IoT/wearable thực tế thường thiết kế:

- Thiết bị có danh tính riêng, không dùng tài khoản người dùng làm danh tính firmware.
- Pairing được quản lý từ backend/app, không hardcode bệnh nhân trong firmware.
- Telemetry được gửi về backend, backend mới map sang bệnh nhân và phát realtime cho dashboard.
- Thiết bị có trạng thái vận hành riêng: online, offline, pin yếu, tín hiệu kém, lỗi cảm biến.
- Cần có `sequence` và `timestamp` để phát hiện mất gói, dữ liệu cũ, duplicate.
- Cần có retry/backoff và buffer tạm thời khi mất Wi-Fi.
- Cần tách cảnh báo y khoa với cảnh báo thiết bị. Ví dụ: SpO2 thấp là cảnh báo y khoa, pin yếu là cảnh báo vận hành.

Trong prototype random telemetry, ta mô phỏng đúng luồng này thay vì đi thẳng vào cảm biến thật. Cách này giống thực tế vì giữ nguyên:

- identity của thiết bị
- assignment với bệnh nhân
- telemetry frame
- device status
- dashboard realtime
- alert flow

Khác biệt duy nhất: giá trị sinh hiệu được sinh random có kiểm soát.

## Kiến trúc tổng quát

```text
AIoT Device Layer
  ESP32-S3 / ESP32-C3
  -> Random telemetry generator / Real sensor reader
  -> Basic edge preprocessing
  -> Device runtime state
  -> Wi-Fi transport

Backend IoT Ingest Layer
  -> Receive telemetry
  -> Validate device credential
  -> Map device_uid -> patient_id
  -> Store sensor_data

AI Analysis Layer
  -> Moving Average noise filtering
  -> Rule-based threshold detection
  -> Z-score anomaly detection
  -> Isolation Forest anomaly detection
  -> Risk level classification

Realtime Application Layer
  -> Alerts
  -> WebSocket realtime
  -> Dashboard
  -> Doctor/Patient/Admin notification
```

Giai đoạn cảm biến thật sẽ thay:

```text
Random telemetry generator
```

bằng:

```text
MAX30102 reader + AD8232 reader + signal quality processor
```

## Quyền sở hữu và pairing

### Nguyên tắc

- Một ESP32-S3 chỉ gắn với một bệnh nhân tại một thời điểm.
- Một bệnh nhân có thể có nhiều thiết bị trong tương lai, nhưng prototype chỉ dùng một thiết bị chính.
- Backend là nguồn sự thật cho mapping thiết bị.
- Firmware chỉ biết:
  - `device_uid`
  - device credential
  - backend base URL
  - Wi-Fi config

### Luồng pairing mức sản phẩm

1. Admin hoặc bác sĩ chọn bệnh nhân trong hệ thống.
2. Admin/bác sĩ chọn hoặc tạo thiết bị với `device_uid`.
3. Hệ thống gắn `device_uid` vào `patient_id`.
4. Hệ thống cấp credential cho thiết bị.
5. Credential được nạp vào ESP32 qua USB Serial, BLE provisioning, hoặc captive portal nội bộ.
6. ESP32 gửi heartbeat/telemetry bằng `device_uid`.
7. Backend tra cứu `patient_id` từ `device_uid`.
8. Dashboard của bệnh nhân/bác sĩ/admin nhận dữ liệu realtime.

## Giai đoạn 1: Random telemetry prototype

Mục tiêu của giai đoạn này là chứng minh luồng end-to-end trước khi cảm biến thật ổn định.

### Việc cần làm

1. Tạo firmware skeleton cho ESP32-S3 SuperMini.
2. Thêm cấu hình thiết bị:
   - `device_uid`
   - backend URL
   - Wi-Fi SSID/password
   - chế độ gửi random telemetry
3. Tạo random telemetry generator.
4. Tạo device state machine.
5. Gửi telemetry định kỳ.
6. Mô phỏng bất thường theo kịch bản.
7. Mô phỏng trạng thái thiết bị: pin, Wi-Fi RSSI, uptime, firmware version.
8. Kiểm tra dashboard có hiển thị như thiết bị thật.

### Random telemetry generator

Dữ liệu random không nên random hoàn toàn. Cần sinh theo khoảng hợp lý để dashboard giống thực tế.

Giá trị bình thường:

| Chỉ số | Khoảng để sinh random |
| --- | --- |
| Heart rate | 60-100 bpm |
| SpO2 | 95-100% |
| Systolic BP | bỏ trống nếu chưa có module BP |
| Diastolic BP | bỏ trống nếu chưa có module BP |
| ECG value | -0.3 đến 0.3 |

Giá trị bất thường để test:

| Kịch bản | Giá trị để sinh |
| --- | --- |
| Nhịp tim cao | 121-150 bpm |
| Nhịp tim thấp | 35-49 bpm |
| SpO2 thấp | 85-91% |
| ECG bất thường | <= -0.9 hoặc >= 0.9 |
| Tín hiệu kém | signal_quality = poor |
| Mất kết nối | tạm dừng gửi telemetry |
| Pin yếu | battery <= 15% |

Nên có các chế độ random:

- `normal`: chỉ số ổn định trong ngưỡng bình thường.
- `occasional_abnormal`: thỉnh thoảng tạo bất thường ngắn.
- `critical_demo`: tạo bất thường liên tục để test alert.
- `poor_signal_demo`: số đo bị đánh dấu tín hiệu kém.
- `offline_demo`: ngừng gửi để test stale/offline state.

### Telemetry frame concept

Không cần chốt API ở giai đoạn này, nhưng firmware và backend nên thống nhất concept frame:

```json
{
  "device_uid": "CG-ESP32S3-0001",
  "timestamp": "device-time-or-null",
  "sequence": 12842,
  "mode": "random_demo",
  "readings": {
    "heart_rate": 82,
    "spo2": 97,
    "systolic_bp": null,
    "diastolic_bp": null,
    "ecg_value": 0.18,
    "body_temperature": null,
    "motion_value": null
  },
  "signal": {
    "ppg_quality": "good",
    "ecg_quality": "good",
    "leads_off": false,
    "motion_detected": false
  },
  "device": {
    "battery": 86,
    "rssi": -58,
    "firmware_version": "0.1.0-random",
    "uptime_ms": 320000
  },
  "ai_input_context": {
    "window_size": 30,
    "source": "iot_device",
    "is_demo_data": true
  }
}
```

Trong random phase:

- `mode` phải ghi rõ là `random_demo`.
- Dashboard/log nên biết đây là dữ liệu demo nếu cần.
- Không được dùng random data để đưa ra kết luận y khoa thật.
- ESP32 không tự kết luận `risk_level` hoặc `anomaly_score`; backend AI chịu trách nhiệm phân tích.

Backend có thể tạo kết quả AI riêng sau khi nhận telemetry:

```json
{
  "ai_result": {
    "is_abnormal": true,
    "anomaly_score": 0.87,
    "risk_level": "critical",
    "detected_by": ["threshold_rule", "z_score"],
    "suggested_action": "Bác sĩ cần kiểm tra trạng thái bệnh nhân"
  }
}
```

## Device state machine

Firmware nên có state rõ ràng để sau này gắn cảm biến thật không phải viết lại luồng.

```text
BOOT
  -> WIFI_CONNECTING
  -> TIME_SYNCING
  -> PAIRED_READY
  -> MEASURING
  -> SENDING
```

Trạng thái lỗi:

```text
WIFI_DISCONNECTED
AUTH_FAILED
BACKEND_UNAVAILABLE
LOW_BATTERY
POOR_SIGNAL
SENSOR_ERROR
OFFLINE_BUFFERING
```

### Ý nghĩa từng state

- `BOOT`: khởi động firmware, đọc cấu hình.
- `WIFI_CONNECTING`: kết nối Wi-Fi.
- `TIME_SYNCING`: đồng bộ thời gian. Nếu fail vẫn có thể gửi bằng sequence.
- `PAIRED_READY`: có `device_uid` và credential hợp lệ.
- `MEASURING`: đang tạo random readings hoặc đọc cảm biến thật sau này.
- `SENDING`: đang gửi telemetry lên backend.
- `WIFI_DISCONNECTED`: mất Wi-Fi, bắt đầu buffer tạm.
- `AUTH_FAILED`: credential bị từ chối, dừng gửi nhanh.
- `BACKEND_UNAVAILABLE`: backend lỗi hoặc timeout, retry backoff.
- `LOW_BATTERY`: pin thấp, vẫn gửi nếu có thể.
- `POOR_SIGNAL`: tín hiệu kém, gửi kèm flag để dashboard không tin tuyệt đối.
- `SENSOR_ERROR`: khi chuyển sang cảm biến thật, dùng cho lỗi MAX30102/AD8232.
- `OFFLINE_BUFFERING`: lưu tạm frame khi chưa gửi được.

## Luồng runtime chi tiết

### 1. Boot

1. Bật nguồn.
2. Đọc config từ flash/NVS.
3. Kiểm tra `device_uid` có tồn tại.
4. Kiểm tra mode hiện tại:
   - `random_demo`
   - `sensor_real`
5. Khởi tạo serial logs.
6. Chuyển sang `WIFI_CONNECTING`.

### 2. Wi-Fi

1. Kết nối Wi-Fi bằng config đã nạp.
2. Nếu kết nối thành công:
   - lưu RSSI
   - chuyển sang `TIME_SYNCING`
3. Nếu thất bại:
   - retry có giới hạn
   - chuyển `WIFI_DISCONNECTED`
   - tiếp tục thử lại theo backoff

### 3. Time sync

1. Đồng bộ thời gian bằng SNTP/NTP.
2. Nếu thành công, telemetry có timestamp từ device.
3. Nếu thất bại, telemetry vẫn có `sequence`; backend có thể dùng server time.
4. Không block thiết bị quá lâu chỉ vì time sync fail.

### 4. Generate readings

1. Tăng `sequence`.
2. Sinh heart rate theo mode.
3. Sinh SpO2 theo mode.
4. Để BP là `null` nếu chưa có module BP thật.
5. Sinh ECG value.
6. Sinh signal quality.
7. Sinh battery/RSSI/uptime.

### 5. Gửi telemetry

1. Đóng gói telemetry frame.
2. Gửi lên backend.
3. Nếu thành công:
   - xóa frame khỏi buffer nếu là frame gửi lại
   - tiếp tục chu kỳ mới
4. Nếu timeout/5xx:
   - lưu frame vào buffer
   - retry theo exponential backoff
5. Nếu 401/403:
   - chuyển `AUTH_FAILED`
   - dừng gửi telemetry liên tục
6. Nếu Wi-Fi mất:
   - chuyển `OFFLINE_BUFFERING`

### 6. Backend, AI và dashboard

1. Backend nhận telemetry frame từ thiết bị IoT.
2. Backend xác thực `device_uid` và device credential.
3. Backend tìm `patient_id` theo `device_uid`.
4. Backend lưu dữ liệu thô vào `sensor_data`.
5. AI preprocessing xử lý nhiễu bằng Moving Average.
6. AI anomaly detection kiểm tra bất thường bằng:
   - rule-based threshold
   - Z-score
   - Isolation Forest
7. AI risk classifier phân loại mức độ nguy hiểm:
   - normal
   - warning
   - critical
8. Backend tạo alert nếu AI/rule phát hiện bất thường.
9. Backend broadcast realtime qua WebSocket.
10. Dashboard hiển thị:
   - chỉ số sinh hiệu
   - trạng thái source là thiết bị
   - kết quả phân tích AI
   - mức độ nguy hiểm
   - cảnh báo bất thường
   - trạng thái thiết bị
   - khuyến nghị theo dõi

## Luồng dashboard mong muốn

Dashboard nên phân biệt 5 loại trạng thái:

1. Realtime tốt:
   - thiết bị online
   - tín hiệu tốt
   - dữ liệu mới

2. Realtime nhưng tín hiệu kém:
   - thiết bị online
   - có readings
   - `signal_quality = poor`
   - UI cần hiển thị "Tín hiệu kém"

3. Offline/stale:
   - không có frame mới trong ngưỡng thời gian
   - UI hiển thị "Mất kết nối" hoặc "Dữ liệu cũ"

4. Demo/random:
   - dữ liệu từ mode random
   - UI/log nội bộ nên đánh dấu "Demo telemetry"
   - không dùng cho clinical decision

5. AIoT Health Intelligence:
   - AI status: đang phân tích, không đủ dữ liệu, tín hiệu kém
   - anomaly score: điểm bất thường từ 0 đến 1
   - risk level: normal, warning, critical
   - detected by: rule, Z-score, Isolation Forest
   - explanation: ví dụ "Nhịp tim cao liên tục trong 30 giây"
   - suggested action: ví dụ "Bác sĩ cần kiểm tra bệnh nhân"

## Các phần bổ sung cần đưa vào kế hoạch

Các phần dưới đây chưa phải là code triển khai ngay, nhưng cần được chốt trong kế hoạch để firmware, backend và dashboard không lệch nhau khi bắt đầu nối end-to-end.

### 1. API contract dự kiến cho telemetry

Giai đoạn đầu có thể chỉ in telemetry ra Serial, nhưng trước khi nối backend cần thống nhất contract tối thiểu:

```text
POST /api/iot/telemetry

Headers:
- X-Device-Uid: CG-ESP32S3-0001
- X-Device-Token: <device_secret>
- Content-Type: application/json
```

Response code cần quy định rõ:

| Code | Ý nghĩa | Hành vi ESP32 |
| --- | --- | --- |
| 200 | Backend nhận telemetry thành công | Xóa frame khỏi buffer nếu là frame gửi lại |
| 400 | Payload sai format hoặc thiếu field | Log lỗi, không retry vô hạn |
| 401/403 | Device token sai hoặc bị revoke | Chuyển `AUTH_FAILED`, dừng gửi liên tục |
| 404 | Thiết bị chưa được pair với bệnh nhân | Chuyển trạng thái `unpaired`, gửi heartbeat chậm |
| 429 | Gửi quá nhanh | Backoff theo thời gian backend gợi ý nếu có |
| 500/502/503 | Backend lỗi hoặc tạm unavailable | Buffer frame và retry theo backoff |

Nguyên tắc quan trọng:

- Backend lấy `patient_id` từ mapping `device_uid -> patient_id`.
- Firmware không gửi hoặc không được tin cậy nếu có gửi `patient_id`.
- API contract phải giữ được cả dữ liệu random demo và dữ liệu cảm biến thật sau này.

### 2. Database tối thiểu cần chuẩn bị

Để hỗ trợ luồng một thiết bị gắn với một bệnh nhân, backend cần có các nhóm dữ liệu sau:

```text
devices
- id
- device_uid
- device_secret_hash
- firmware_version
- status
- battery
- rssi
- last_seen_at
- created_at
- updated_at

device_assignments
- id
- device_id
- patient_id
- assigned_at
- unassigned_at
- is_active

sensor_data
- id
- patient_id
- device_id
- heart_rate
- spo2
- systolic_bp
- diastolic_bp
- ecg_value
- signal_quality
- mode
- sequence
- device_timestamp
- server_received_at

alerts
- id
- patient_id
- device_id
- alert_type
- severity
- message
- status
- created_at

device_events
- id
- device_id
- event_type
- message
- created_at

ai_analysis_results
- id
- patient_id
- device_id
- sensor_data_id
- heart_rate_score
- spo2_score
- ecg_score
- anomaly_score
- risk_level
- model_name
- model_version
- detected_by
- created_at

ai_model_logs
- id
- model_name
- model_version
- input_summary
- output_result
- processing_time_ms
- created_at
```

Trong prototype, có thể chưa cần tạo đủ bảng ngay. Nhưng kế hoạch phải ghi rõ để khi nối backend không phải đoán cách map thiết bị, bệnh nhân, sensor data và alert.

Nếu muốn làm đơn giản hơn ở giai đoạn đầu, có thể thêm trực tiếp các field sau vào `alerts`:

```text
alerts
- ai_score
- risk_level
- detected_by
- model_version
```

### 3. Bảo mật thiết bị

ESP32 không được dùng JWT của bệnh nhân, bác sĩ hoặc admin. Thiết bị cần dùng credential riêng.

Quy tắc bảo mật:

- Mỗi thiết bị có một `device_uid` và một `device_token` riêng.
- Backend chỉ lưu hash của token, không lưu token plaintext.
- Token chỉ hiển thị một lần khi provision hoặc rotate.
- Token lưu trong NVS/flash của ESP32.
- Không commit token vào repo.
- Không in token ra Serial Monitor.
- Nếu backend trả 401/403, ESP32 chuyển `AUTH_FAILED` và dừng spam request.
- Khi rotate token, token cũ phải bị vô hiệu hóa.

### 4. Chốt phần cứng và phạm vi cảm biến

Kế hoạch hiện tại chọn `ESP32-S3 SuperMini`. Nếu các tài liệu khác của dự án đang ghi `ESP32-C3`, cần chốt lại trước khi mua linh kiện hoặc viết firmware sâu.

| Hướng chọn | Việc cần làm |
| --- | --- |
| Giữ ESP32-S3 SuperMini | Cập nhật danh sách đồ IoT, wiring, tài liệu dự án và task triển khai theo ESP32-S3 |
| Chuyển sang ESP32-C3 | Sửa tên kế hoạch, kiểm tra lại chân GPIO, thư viện, RAM/flash và khả năng chạy Wi-Fi/BLE |

Phạm vi cảm biến:

- MAX30102 dùng cho heart rate và SpO2.
- AD8232 dùng cho ECG nếu muốn có ECG thật.
- Không suy đoán huyết áp từ MAX30102.
- Nếu chưa có module đo huyết áp thật, `systolic_bp` và `diastolic_bp` phải là `null`.
- Nếu chưa có AD8232, ECG trong dashboard phải được ghi nhận là demo/simulated.

### 5. Giới hạn offline buffer và retry

Firmware cần giới hạn rõ để không đầy bộ nhớ khi mất mạng:

```text
Offline buffer:
- Lưu tối đa 300 frame gần nhất.
- Nếu buffer đầy, xóa frame cũ nhất.
- Gửi lại theo thứ tự FIFO khi online.
- Mỗi frame giữ `sequence` để backend phát hiện thiếu dữ liệu.
- Không retry vô hạn với lỗi 400, 401, 403, 404.
- Retry với lỗi 429 và 5xx theo exponential backoff.
```

Với tần suất 1 frame/giây, 300 frame tương đương khoảng 5 phút dữ liệu offline. Mức này phù hợp cho prototype.

### 6. Test case theo từng mode demo

Các mode demo cần có test case rõ ràng để tester kiểm tra dashboard, alert và trạng thái thiết bị:

| Test case | Cách test | Kết quả mong muốn |
| --- | --- | --- |
| Normal telemetry | Chạy mode `normal` | Dashboard hiện HR, SpO2, ECG trong ngưỡng bình thường |
| Occasional abnormal | Chạy mode `occasional_abnormal` | Thỉnh thoảng xuất hiện alert ngắn |
| Critical demo | Chạy mode `critical_demo` | Tạo alert liên tục cho HR/SpO2/ECG bất thường |
| Poor signal | Chạy mode `poor_signal_demo` | Dashboard hiển thị "Tín hiệu kém" |
| Offline | Chạy `offline_demo` hoặc tắt Wi-Fi | Dashboard hiển thị "Mất kết nối" hoặc "Dữ liệu cũ" |
| Auth failed | Gửi sai token | ESP32 chuyển `AUTH_FAILED`, không spam request |
| Backend down | Tắt backend | ESP32 buffer frame và retry/backoff |
| Missing BP | Không có module BP | Dashboard hiển thị BP là `--`, không tạo alert huyết áp |

### 7. AIoT analysis cần bổ sung

AI không nên chạy trên ESP32 trong prototype. ESP32 chỉ gửi telemetry, còn backend/AI service sẽ xử lý:

- Moving Average để lọc nhiễu HR, SpO2, ECG.
- Rule-based threshold để bắt các ngưỡng lâm sàng cơ bản.
- Z-score để phát hiện giá trị lệch bất thường theo cửa sổ thời gian.
- Isolation Forest để thử phát hiện anomaly từ dữ liệu demo hoặc dataset.
- Risk classifier để tạo `risk_level`: normal, warning, critical.
- AI result phải lưu được `anomaly_score`, `detected_by`, `model_name`, `model_version`.
- Dashboard cần hiển thị rõ cảnh báo đến từ rule, Z-score hay Isolation Forest.

### 8. Jira/Confluence gợi ý

Nên tạo một epic riêng:

```text
Epic: AIoT Health Monitoring Pipeline
```

Các task nên có:

1. Thiết kế kiến trúc AIoT tổng thể.
2. Chuẩn hóa telemetry frame cho AI analysis.
3. Làm Moving Average filter.
4. Làm rule-based abnormal detection.
5. Làm Z-score anomaly detection.
6. Train thử Isolation Forest.
7. Tạo risk level: normal, warning, critical.
8. Tích hợp AI result vào backend API/WebSocket.
9. Hiển thị AI result trên dashboard.
10. Test AI anomaly detection bằng random telemetry.

### 9. Nội dung báo cáo/slide

Trong báo cáo hoặc slide thuyết trình nên có mục:

```md
## Kiến trúc AIoT của hệ thống CardioGuard AI

Hệ thống CardioGuard AI được xây dựng theo mô hình AIoT, kết hợp giữa thiết bị IoT đeo tay và lớp trí tuệ nhân tạo phân tích dữ liệu sức khỏe. Thiết bị ESP32 thu thập hoặc mô phỏng dữ liệu sinh hiệu như nhịp tim, SpO2, ECG và trạng thái vận động. Dữ liệu được gửi realtime về backend, sau đó lớp AI thực hiện lọc nhiễu, phát hiện bất thường và phân loại mức độ nguy hiểm. Kết quả phân tích được hiển thị trên dashboard để hỗ trợ bác sĩ, bệnh nhân và quản trị viên theo dõi tình trạng sức khỏe.
```

## Kế hoạch thực hiện chi tiết

### Phase 0: Chốt luồng prototype

- Xác nhận board chính thức: ESP32-S3 SuperMini hay ESP32-C3.
- Xác nhận thiết bị đầu tiên có `device_uid = CG-ESP32S3-0001`.
- Chọn bệnh nhân demo để gắn thiết bị.
- Chốt tần suất gửi random telemetry: 1 frame mỗi 1 giây.
- Chốt BP tạm thời là `null`, không random BP nếu không có module đo BP thật.
- Chốt ECG là demo nếu chưa có AD8232.
- Chốt mode mặc định là `normal`.
- Chốt tên endpoint telemetry dự kiến và các response code chính.
- Chốt giới hạn offline buffer: 300 frame gần nhất.

Kết quả cần có:

- Tài liệu pairing.
- Tài liệu telemetry frame.
- Tài liệu state machine.
- Tài liệu API contract dự kiến.
- Tài liệu database mapping tối thiểu.
- Tài liệu bảo mật device token.

### Phase 1: Firmware skeleton

- Tạo project firmware trong `firmware/`.
- Khởi tạo serial log.
- Lưu/đọc config cơ bản.
- Tạo cấu hình `device_uid`, firmware version, telemetry interval, demo mode.
- Tạo kiểu dữ liệu telemetry frame dùng chung trong firmware.
- Tạo state machine tối thiểu.
- Kết nối Wi-Fi.
- Đồng bộ SNTP.
- Tạo loop chạy mỗi 1 giây.
- In telemetry frame ra serial trước khi gửi backend.

Kết quả cần có:

- ESP32 boot được.
- Serial log hiện `device_uid`, state, sequence, generated readings.
- BP trong log là `null` khi chưa có module BP.
- Không log credential/token ra Serial.

### Phase 2: Random telemetry

- Tạo module random vitals.
- Sinh giá trị bình thường có dao động nhỏ.
- Thêm mode abnormal để test cảnh báo:
  - high HR
  - low HR
  - low SpO2
  - abnormal ECG
- Thêm mode poor signal.
- Thêm mode offline demo.
- Thêm fake battery drain chậm.
- Thêm fake RSSI.
- Thêm signal quality: `ppg_quality`, `ecg_quality`, `leads_off`, `motion_detected`.
- Đảm bảo random có kiểm soát, không nhảy số quá vô lý giữa các frame.

Kết quả cần có:

- Mỗi frame có readings và device status đầy đủ.
- Có thể đổi mode test mà không sửa core loop.
- Có test case rõ cho từng mode demo.
- Có dữ liệu đủ để dashboard phân biệt normal, abnormal, poor signal và offline.

### Phase 3: Network sending

- Gửi frame lên backend bằng HTTPS/HTTP tùy môi trường dev.
- Thêm timeout ngắn.
- Thêm retry/backoff.
- Thêm buffer tạm khi mất kết nối.
- Thêm serial log cho response.
- Gửi header `X-Device-Uid`.
- Gửi header `X-Device-Token` khi backend đã hỗ trợ credential.
- Xử lý response code:
  - 200: thành công
  - 400: payload sai, không retry vô hạn
  - 401/403: chuyển `AUTH_FAILED`
  - 404: thiết bị chưa pair
  - 429/5xx: retry/backoff
- Không gửi `patient_id` từ firmware.

Kết quả cần có:

- Backend nhận được frame.
- Dashboard cập nhật chỉ số realtime.
- Mất Wi-Fi không làm firmware crash.
- Firmware không spam backend khi auth sai.
- Offline buffer không vượt quá giới hạn đã chốt.

### Phase 4: Device-patient assignment

- Thiết bị chỉ gửi `device_uid`.
- Backend/system map `device_uid` sang bệnh nhân.
- Nếu thiết bị chưa pair, backend từ chối hoặc ghi trạng thái `unpaired`.
- Mỗi thời điểm chỉ có một assignment active cho một thiết bị.
- Có thể unassign thiết bị khỏi bệnh nhân cũ trước khi assign sang bệnh nhân mới.
- Sensor data lưu cả `patient_id` và `device_id`.
- Alert lưu cả `patient_id` và `device_id`.

Kết quả cần có:

- Một ESP32 gắn đúng một bệnh nhân.
- Đổi mapping trên hệ thống không cần flash lại firmware.
- Backend không tin `patient_id` từ firmware.
- Có thể audit lịch sử thiết bị từng gắn với bệnh nhân nào.

### Phase 4.5: AIoT Analysis Layer

- Nhận dữ liệu realtime từ bảng `sensor_data`.
- Làm lọc nhiễu Moving Average cho heart rate, SpO2, ECG.
- Thêm rule-based detection:
  - HR cao/thấp
  - SpO2 thấp
  - ECG bất thường
  - tín hiệu kém
- Thêm Z-score để phát hiện giá trị lệch bất thường theo cửa sổ thời gian.
- Train thử Isolation Forest bằng dữ liệu demo hoặc dataset tim mạch phù hợp.
- Tạo `risk_level`: normal, warning, critical.
- Lưu kết quả AI vào database.
- Trả kết quả AI cho dashboard qua WebSocket.
- Ghi log `model_name`, `model_version`, `detected_by`, `processing_time_ms`.

Kết quả cần có:

- Dashboard hiển thị được cảnh báo do AI phát hiện.
- Có điểm bất thường `anomaly_score`.
- Có mức độ nguy hiểm `risk_level`.
- Có log model để giải thích cảnh báo đến từ rule, Z-score hay Isolation Forest.
- ESP32 vẫn chỉ gửi telemetry, không tự kết luận nguy cơ y khoa.

### Phase 5: Dashboard validation

- Mở dashboard với bệnh nhân đã pair.
- Xác nhận heart rate, SpO2, ECG thay đổi theo frame random.
- Xác nhận BP hiển thị `--` nếu không có BP.
- Xác nhận dashboard/log nội bộ đánh dấu dữ liệu là demo/random.
- Xác nhận block AIoT Health Intelligence hiển thị AI status, anomaly score, risk level, detected by.
- Chạy mode abnormal:
  - HR cao tạo cảnh báo
  - HR thấp tạo cảnh báo
  - SpO2 thấp tạo cảnh báo
  - ECG bất thường tạo cảnh báo
- Chạy offline demo:
  - dashboard hiện stale/offline
- Chạy poor signal demo:
  - dashboard hiện "Tín hiệu kém"
- Chạy auth failed:
  - dashboard hoặc log vận hành ghi nhận thiết bị lỗi xác thực

Kết quả cần có:

- Luồng demo giống một wearable thật đang gửi dữ liệu.
- Cảnh báo y khoa và trạng thái thiết bị được phân biệt.
- BP thiếu không bị suy đoán.
- Alert bất thường không bị trộn với cảnh báo vận hành như pin yếu hoặc mất mạng.
- AI result được hiển thị nhưng không thay thế đánh giá y khoa của bác sĩ.

### Phase 6: Chuyển sang cảm biến thật

Sau khi random flow ổn định:

- Gắn MAX30102.
- Thay random HR/SpO2 bằng reader thật.
- Gắn AD8232.
- Thay random ECG bằng ADC reader.
- Giữ nguyên telemetry frame và backend flow.
- Thêm signal quality thật.
- Nếu thêm MPU6050, chỉ dùng để hỗ trợ motion/signal quality, không coi là sinh hiệu y khoa chính.
- Nếu thêm module huyết áp thật, mới gửi `systolic_bp` và `diastolic_bp`.

Kết quả cần có:

- Không đổi dashboard/backend flow lớn.
- Chỉ thay data source từ `random_demo` sang `sensor_real`.
- Dashboard phân biệt được dữ liệu cảm biến thật và dữ liệu demo.

### Phase 7: Kiểm thử ổn định prototype

- Chạy ESP32 gửi random telemetry 30 phút liên tục.
- Theo dõi sequence có bị mất hoặc reset bất thường không.
- Tắt Wi-Fi tạm thời để kiểm tra buffer.
- Bật lại Wi-Fi để kiểm tra gửi lại FIFO.
- Tắt backend để kiểm tra backoff.
- Gửi sai token để kiểm tra `AUTH_FAILED`.
- Chạy lần lượt các demo mode trong bảng test case.

Kết quả cần có:

- Firmware không crash trong 30 phút.
- Không mất toàn bộ dữ liệu khi offline ngắn.
- Dashboard realtime cập nhật đúng.
- Alert tạo đúng theo từng kịch bản.
- Log đủ để debug mà không lộ credential.

## Phần cần chốt trước khi code backend/firmware hoàn chỉnh

Trước khi chuyển từ skeleton sang nối backend thật, nhóm cần chốt các điểm sau:

1. Chốt loại board sử dụng: ESP32-S3 SuperMini hay ESP32-C3.
2. Chốt danh sách cảm biến thật cho giai đoạn sau: MAX30102, MPU6050, AD8232 nếu cần ECG thật.
3. Chốt API nhận telemetry: endpoint, header auth, payload, response code.
4. Chốt database cho `devices`, `device_assignments`, `sensor_data`, `alerts`, `device_events`.
5. Chốt device credential: mỗi thiết bị có token riêng, không dùng JWT người dùng.
6. Chốt giới hạn offline buffer và retry/backoff.
7. Chốt test case cho normal, abnormal, poor signal, offline, auth failed, backend unavailable.
8. Chốt cách dashboard hiển thị dữ liệu demo/random để tránh hiểu nhầm là dữ liệu y khoa thật.
9. Chốt AI pipeline: Moving Average, rule-based detection, Z-score, Isolation Forest.
10. Chốt schema AI result: `anomaly_score`, `risk_level`, `detected_by`, `model_version`.
11. Chốt dashboard block `AIoT Health Intelligence`.
12. Chốt epic/task Jira cho AIoT Health Monitoring Pipeline.

## Tiêu chí hoàn thành prototype random

Prototype được xem là hoàn thành khi:

- ESP32-S3 gửi dữ liệu random mỗi 1 giây trong ít nhất 30 phút không crash.
- Mỗi frame có `device_uid`, `sequence`, readings, signal, device status.
- Device được gắn với đúng một bệnh nhân.
- Dashboard hiện được HR, SpO2, ECG realtime.
- BP không bị suy đoán khi chưa có module BP.
- Các kịch bản abnormal tạo cảnh báo đúng.
- Mất Wi-Fi tạm thời không làm mất hết dữ liệu ngay.
- Serial log đủ để debug.
- Serial log không lộ credential/token.
- Backend không tin `patient_id` từ firmware.
- AI result có `anomaly_score`, `risk_level`, `detected_by`.
- Dashboard phân biệt được telemetry thô, alert rule-based và kết quả AI.
- Tài liệu ghi rõ đây là random telemetry, không phải dữ liệu clinical thật.

## Những việc không làm ở giai đoạn random

- Không kết luận chẩn đoán y khoa.
- Không suy đoán huyết áp từ MAX30102.
- Không hardcode `patient_id` vào firmware.
- Không dùng JWT của bệnh nhân trong firmware.
- Không để ESP32 tự kết luận `risk_level` hoặc chẩn đoán AI.
- Không tối ưu pin quá sâu trước khi luồng telemetry ổn định.
- Không làm OTA firmware trước khi prototype gửi random ổn định.
