#include "random_telemetry.h"

#include <Arduino.h>

#include "config.h"

namespace {
int RandomRange(int min_value, int max_value) {
  return random(min_value, max_value + 1);
}

float RandomRangeFloat(float min_value, float max_value) {
  const float scale = 1000.0f;
  const long min_scaled = static_cast<long>(min_value * scale);
  const long max_scaled = static_cast<long>(max_value * scale);
  return static_cast<float>(random(min_scaled, max_scaled + 1)) / scale;
}
}  // namespace

const char *ModeToString(DemoMode mode) {
  switch (mode) {
    case DemoMode::normal:
      return "normal";
    case DemoMode::occasional_abnormal:
      return "occasional_abnormal";
    case DemoMode::critical_demo:
      return "critical_demo";
    case DemoMode::poor_signal_demo:
      return "poor_signal_demo";
    case DemoMode::offline_demo:
      return "offline_demo";
  }
  return "normal";
}

TelemetryFrame GenerateRandomTelemetry(unsigned long sequence, DemoMode mode) {
  TelemetryFrame frame{};
  frame.device_uid = kDeviceUid;
  frame.sequence = sequence;
  frame.mode = ModeToString(mode);

  frame.readings.heart_rate = RandomRange(60, 100);
  frame.readings.spo2 = RandomRange(95, 100);
  frame.readings.has_bp = false;
  frame.readings.systolic_bp = 0;
  frame.readings.diastolic_bp = 0;
  frame.readings.ecg_value = RandomRangeFloat(-0.3f, 0.3f);

  frame.signal.ppg_quality = "good";
  frame.signal.ecg_quality = "good";
  frame.signal.leads_off = false;
  frame.signal.motion_detected = false;

  if (mode == DemoMode::critical_demo) {
    frame.readings.heart_rate = RandomRange(125, 150);
    frame.readings.spo2 = RandomRange(85, 91);
    frame.readings.ecg_value = RandomRangeFloat(0.9f, 1.2f);
  } else if (mode == DemoMode::occasional_abnormal && (sequence % 8UL == 0UL)) {
    frame.readings.heart_rate = RandomRange(121, 135);
  } else if (mode == DemoMode::poor_signal_demo) {
    frame.signal.ppg_quality = "poor";
    frame.signal.ecg_quality = "poor";
    frame.signal.motion_detected = true;
  }

  frame.device.battery = 100 - static_cast<int>((sequence / 60UL) % 20UL);
  frame.device.rssi = RandomRange(-70, -50);
  frame.device.firmware_version = kFirmwareVersion;
  frame.device.uptime_ms = millis();

  return frame;
}
