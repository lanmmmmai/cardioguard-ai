#pragma once

// Phase 1 demo config: keep static values for quick bring-up.
inline constexpr const char* kDeviceUid = "CG-ESP32S3-0001";
inline constexpr const char* kFirmwareVersion = "0.2.0-random";
inline constexpr unsigned long kTelemetryIntervalMs = 1000UL;
inline constexpr const char* kWifiSsid = "REPLACE_WIFI_SSID";
inline constexpr const char* kWifiPassword = "REPLACE_WIFI_PASSWORD";
inline constexpr const char* kTelemetryEndpoint = "https://192.168.1.10:8000/api/iot/telemetry";
inline constexpr const char* kDeviceToken = "REPLACE_DEVICE_TOKEN";
inline constexpr uint16_t kHttpTimeoutMs = 2500;
inline constexpr uint16_t kOfflineBufferMaxFrames = 300;
inline constexpr uint16_t kReconnectIntervalMs = 5000;
inline constexpr uint16_t kBackoffMinMs = 1000;
inline constexpr uint16_t kBackoffMaxMs = 30000;

enum class DemoMode {
  normal,
  occasional_abnormal,
  critical_demo,
  poor_signal_demo,
  offline_demo
};

inline constexpr DemoMode kDefaultMode = DemoMode::normal;
