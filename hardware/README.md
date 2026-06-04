# CardioGuard AI Hardware — ESP32-S3 SuperMini

Firmware cho thiết bị đeo gửi telemetry sức khỏe (nhịp tim, SpO2, ECG) về backend CardioGuard qua HTTP.

## Board

- **MCU:** ESP32-S3 SuperMini
- **Cảm biến:** MAX30102 (HR/SpO2), AD8232 (ECG)

## Firmware

Firmware nằm tại `esp32_s3_supermini/firmware/`, viết bằng C++ trên PlatformIO.

### Kiến trúc

- State machine: `IDLE → WIFI_CONNECT → SENDING → BACKOFF`
- Offline buffer + retry/backoff (HTTP 4xx/5xx)
- MAC-based device mapping
- Per-device token auth (`X-Device-Token`)
- Random demo mode (chưa gắn cảm biến thật)

### Cấu hình

Sửa file `include/config.h` trước khi flash:

```cpp
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define TELEMETRY_ENDPOINT "http://server/api/sensor-data"
#define DEVICE_TOKEN "cgdt_..."
```

### Build & Flash

```bash
cd hardware/esp32_s3_supermini/firmware
pio run
pio run -t upload
pio device monitor -b 115200
```

## API Endpoint

```http
POST /api/sensor-data
X-Device-Uid: CG-ESP32S3-0001
X-Device-Mac: A8:42:E3:11:22:33
X-Device-Token: cgdt_xxx
Content-Type: application/json
```

## Tài liệu liên quan

- [Sơ đồ chân & wiring](esp32_s3_supermini/docs/wiring.md)
- [Luồng vận hành](esp32_s3_supermini/docs/operating-flow.md)
