# ESP32-S3 SuperMini Firmware (Phase 1)

Muc tieu phase nay:

- Khoi dong ESP32-S3 va in trang thai state machine.
- Tao random telemetry moi 1 giay.
- In frame dang JSON len Serial de test luong truoc khi noi backend.

## Cau truc

- `platformio.ini`: cau hinh PlatformIO cho ESP32-S3.
- `include/config.h`: device UID, interval, mode demo.
- `include/types.h`: struct telemetry va runtime state.
- `src/main.cpp`: loop chinh 1 giay, state machine, print telemetry.
- `src/random_telemetry.*`: sinh du lieu random co kiem soat.
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

- Day la demo phase 1, chua ket noi Wi-Fi/backend that.
- `systolic_bp` va `diastolic_bp` dang de `null`.
- De test abnormal nhanh, doi `kDefaultMode` trong `include/config.h`.
