# ESP32-S3 SuperMini Wearable Prototype

## Purpose

Build a wearable-style health monitor that behaves like a basic health watch for one patient.

The device should:

- Read heart rate and SpO2 from MAX30102.
- Read a single-lead ECG signal from AD8232.
- Track device status such as battery, Wi-Fi strength, sensor contact, and firmware version.
- Send telemetry as the assigned patient's live vitals source.
- Never decide the patient identity locally; pairing is managed by the backend/system.

## Planned Folder Layout

- `firmware/`: future ESP32-S3 firmware project.
- `docs/`: wiring, protocol, calibration, and operating notes.
- `provisioning/`: future setup notes for device UID, token, and Wi-Fi onboarding.
- `test_notes/`: bench test logs and manual validation notes.

## Prototype Phases

1. Bring up ESP32-S3, Wi-Fi, serial logs, and time sync.
2. Read MAX30102 and validate heart rate/SpO2 signal quality.
3. Read AD8232 through ADC and validate ECG signal stability.
4. Define stable telemetry frame fields and device status fields.
5. Pair one device to one patient in the backend.
6. Verify dashboard realtime display and abnormal alert flow.

