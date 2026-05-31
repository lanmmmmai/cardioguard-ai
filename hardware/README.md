# CardioGuard AI Hardware

This folder contains hardware planning and future firmware work for CardioGuard AI wearable devices.

Initial target:

- Board: ESP32-S3 SuperMini
- Heart rate and SpO2: MAX30102
- ECG signal: AD8232
- Device model: one physical device is paired to one patient
- Network model: device telemetry is sent to the CardioGuard backend, then dashboard updates through backend realtime events

No firmware code is included yet. Use `esp32_s3_supermini/` for the first prototype.

