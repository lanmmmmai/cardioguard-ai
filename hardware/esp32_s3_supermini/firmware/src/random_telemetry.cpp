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

int ClampInt(int value, int min_value, int max_value) {
  if (value < min_value) {
    return min_value;
  }
  if (value > max_value) {
    return max_value;
  }
  return value;
}

float ClampFloat(float value, float min_value, float max_value) {
  if (value < min_value) {
    return min_value;
  }
  if (value > max_value) {
    return max_value;
  }
  return value;
}

/* Thực hiện một bước random walk.
   Luu ý: step_min phải <= 0 và step_max phải >= 0 để đảm bảo bước đi không thiên lệch. */
float RandomWalk(float current_value, float step_min, float step_max, float out_min, float out_max) {
  const float step = RandomRangeFloat(step_min, step_max);
  return ClampFloat(current_value + step, out_min, out_max);
}
}  // Kết thúc namespace ẩn danh

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

DemoMode ParseModeFromText(const String &text, DemoMode fallback_mode) {
  String normalized = text;
  normalized.trim();
  normalized.toLowerCase();

  if (normalized == "normal") {
    return DemoMode::normal;
  }
  if (normalized == "occasional_abnormal" || normalized == "occasional") {
    return DemoMode::occasional_abnormal;
  }
  if (normalized == "critical_demo" || normalized == "critical") {
    return DemoMode::critical_demo;
  }
  if (normalized == "poor_signal_demo" || normalized == "poor_signal") {
    return DemoMode::poor_signal_demo;
  }
  if (normalized == "offline_demo" || normalized == "offline") {
    return DemoMode::offline_demo;
  }
  return fallback_mode;
}

TelemetryFrame GenerateRandomTelemetry(unsigned long sequence, DemoMode mode) {
  static DemoMode last_mode = DemoMode::normal;   // Chế độ demo của lần sinh dữ liệu trước
  static int hr_base = 78;                         // Giá trị cơ sở của nhịp tim
  static int spo2_base = 98;                       // Giá trị cơ sở của SpO2
  static float ecg_base = 0.02f;                   // Giá trị cơ sở của tín hiệu ECG
  static float motion_base = 0.08f;                // Giá trị cơ sở của cảm biến chuyển động
  static float temp_base = 36.9f;                  // Giá trị cơ sở của nhiệt độ cơ thể

  if (mode != last_mode) {
    Serial.print("[CardioGuard] Demo mode reset: ");
    Serial.println(ModeToString(mode));
    hr_base = 78;
    spo2_base = 98;
    ecg_base = 0.02f;
    motion_base = 0.08f;
    temp_base = 36.9f;
    last_mode = mode;
  }

  hr_base = ClampInt(hr_base + RandomRange(-2, 2), 62, 98);
  spo2_base = ClampInt(spo2_base + RandomRange(-1, 1), 95, 100);
  ecg_base = RandomWalk(ecg_base, -0.07f, 0.07f, -0.32f, 0.32f);
  motion_base = RandomWalk(motion_base, -0.03f, 0.03f, 0.02f, 0.35f);
  temp_base = RandomWalk(temp_base, -0.02f, 0.02f, 36.4f, 37.3f);

  TelemetryFrame frame{};
  frame.device_uid = kDeviceUid;
  frame.sequence = sequence;
  frame.mode = ModeToString(mode);

  frame.readings.heart_rate = hr_base;
  frame.readings.spo2 = spo2_base;
  frame.readings.has_bp = false;
  frame.readings.systolic_bp = 0;
  frame.readings.diastolic_bp = 0;
  frame.readings.ecg_value = ecg_base;
  frame.readings.has_body_temperature = false;
  frame.readings.body_temperature = temp_base;
  frame.readings.has_motion_value = false;
  frame.readings.motion_value = motion_base;

  frame.signal.ppg_quality = "good";
  frame.signal.ecg_quality = "good";
  frame.signal.leads_off = false;
  frame.signal.motion_detected = false;

  if (mode == DemoMode::critical_demo) {
    frame.readings.heart_rate = RandomRange(125, 150);
    frame.readings.spo2 = RandomRange(85, 91);
    frame.readings.ecg_value = RandomRangeFloat(0.88f, 1.20f);
    frame.signal.motion_detected = true;
    frame.readings.motion_value = RandomRangeFloat(0.65f, 0.95f);
  } else if (mode == DemoMode::occasional_abnormal) {
    if (sequence % 12UL == 0UL) {
      frame.readings.heart_rate = RandomRange(121, 135);
    } else if (sequence % 16UL == 0UL) {
      frame.readings.spo2 = RandomRange(88, 91);
    } else if (sequence % 20UL == 0UL) {
      frame.readings.ecg_value = RandomRangeFloat(-1.0f, -0.85f);
    }
  } else if (mode == DemoMode::poor_signal_demo) {
    frame.signal.ppg_quality = "poor";
    frame.signal.ecg_quality = "poor";
    frame.signal.leads_off = (sequence % 3UL == 0UL);
    frame.signal.motion_detected = true;
    frame.readings.motion_value = RandomRangeFloat(0.70f, 0.98f);
    frame.readings.ecg_value = RandomRangeFloat(-0.75f, 0.75f);
  }

  const int battery_calc = 100 - static_cast<int>((sequence % 3825UL) / 45UL);
  frame.device.battery = ClampInt(battery_calc, 15, 100);
  if (frame.device.battery <= 15 && (sequence % 45UL == 0UL)) {
    Serial.println("[CardioGuard] WARNING: Device battery low (15%).");
  }
  frame.device.rssi = ClampInt(-58 + RandomRange(-10, 6), -78, -45);
  frame.device.firmware_version = kFirmwareVersion;
  frame.device.uptime_ms = millis();

  return frame;
}
