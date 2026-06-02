#pragma once

// Phase 1 demo config: keep static values for quick bring-up.
static const char *kDeviceUid = "CG-ESP32S3-0001";
static const char *kFirmwareVersion = "0.2.0-random";
static const unsigned long kTelemetryIntervalMs = 1000UL;
static const char *kWifiSsid = "REPLACE_WIFI_SSID";
static const char *kWifiPassword = "REPLACE_WIFI_PASSWORD";
static const char *kTelemetryEndpoint = "https://192.168.1.10:8000/api/iot/telemetry";
static const char *kDeviceToken = "REPLACE_DEVICE_TOKEN";
static const uint16_t kHttpTimeoutMs = 2500;
static const uint16_t kOfflineBufferMaxFrames = 300;
static const uint16_t kReconnectIntervalMs = 5000;
static const uint16_t kBackoffMinMs = 1000;
static const uint16_t kBackoffMaxMs = 30000;

enum class DemoMode {
  normal,
  occasional_abnormal,
  critical_demo,
  poor_signal_demo,
  offline_demo
};

static const DemoMode kDefaultMode = DemoMode::normal;
