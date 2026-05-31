#pragma once

enum class RuntimeState {
  boot,
  wifi_connecting,
  time_syncing,
  paired_ready,
  measuring,
  sending,
  wifi_disconnected,
  auth_failed,
  backend_unavailable,
  low_battery,
  poor_signal,
  sensor_error,
  offline_buffering
};

struct SignalQuality {
  const char *ppg_quality;
  const char *ecg_quality;
  bool leads_off;
  bool motion_detected;
};

struct DeviceStatus {
  int battery;
  int rssi;
  const char *firmware_version;
  unsigned long uptime_ms;
};

struct TelemetryReadings {
  int heart_rate;
  int spo2;
  bool has_bp;
  int systolic_bp;
  int diastolic_bp;
  float ecg_value;
};

struct TelemetryFrame {
  const char *device_uid;
  unsigned long sequence;
  const char *mode;
  TelemetryReadings readings;
  SignalQuality signal;
  DeviceStatus device;
};
