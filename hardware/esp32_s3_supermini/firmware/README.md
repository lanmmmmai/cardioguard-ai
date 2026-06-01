# ESP32-S3 SuperMini Firmware (Phase 1-3)

Muc tieu giai doan nay:

- Khoi dong ESP32-S3 va in trang thai state machine.
- Tao random telemetry moi 1 giay voi cac mode test.
- In frame dang JSON len Serial de test luong truoc khi noi backend.
- Gui telemetry len backend qua HTTP voi buffer + retry/backoff.

## Cau truc

- `platformio.ini`: cau hinh PlatformIO cho ESP32-S3.
- `include/config.h`: device UID, interval, mode demo.
- `include/types.h`: struct telemetry va runtime state.
- `src/main.cpp`: loop chinh 1 giay, state machine, serial command de doi mode.
- `src/random_telemetry.*`: sinh du lieu random co kiem soat, co dao dong mem.
- `src/telemetry_format.*`: tao JSON payload tu telemetry frame.
- `src/telemetry_sender.*`: Wi-Fi connect, HTTP POST, FIFO buffer 300 frame, retry/backoff.
- `src/state_machine.*`: state transition co ban.

## Chay nhanh

1. Cai `PlatformIO` trong VS Code.
2. Mo thu muc `hardware/esp32_s3_supermini/firmware`.
3. Build:
   - `pio run`
4. Flash:
   - `pio run -t upload`
5. Mo serial monitor:
   - `pio device monitor -b 115200`

## Ghi chu

- Day la demo phase 1-3, da co khung ket noi Wi-Fi/backend.
- `systolic_bp` va `diastolic_bp` dang de `null`.
- ESP32 khong tu ket luan AI score hay risk level.
- Cau hinh `Wi-Fi`, endpoint, token dat trong `include/config.h`.
- Khong commit token that vao repo.
- Firmware gui them header `X-Device-Mac` (lay tu `WiFi.macAddress()`), backend co the map MAC -> benh nhan.

## Serial commands

- `help`: hien danh sach lenh.
- `status`: in state, mode, sequence hien tai.
- `mode normal`
- `mode occasional`
- `mode critical`
- `mode poor_signal`
- `mode offline`
