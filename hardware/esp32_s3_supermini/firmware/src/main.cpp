#include <Arduino.h>

#include "config.h"
#include "random_telemetry.h"
#include "state_machine.h"

namespace {
RuntimeState g_state = RuntimeState::boot;
DemoMode g_mode = kDefaultMode;
unsigned long g_last_tick_ms = 0UL;
unsigned long g_sequence = 0UL;

void PrintTelemetry(const TelemetryFrame &frame) {
  Serial.print("{\"device_uid\":\"");
  Serial.print(frame.device_uid);
  Serial.print("\",\"sequence\":");
  Serial.print(frame.sequence);
  Serial.print(",\"mode\":\"");
  Serial.print(frame.mode);
  Serial.print("\",\"readings\":{\"heart_rate\":");
  Serial.print(frame.readings.heart_rate);
  Serial.print(",\"spo2\":");
  Serial.print(frame.readings.spo2);
  Serial.print(",\"systolic_bp\":");
  if (frame.readings.has_bp) {
    Serial.print(frame.readings.systolic_bp);
  } else {
    Serial.print("null");
  }
  Serial.print(",\"diastolic_bp\":");
  if (frame.readings.has_bp) {
    Serial.print(frame.readings.diastolic_bp);
  } else {
    Serial.print("null");
  }
  Serial.print(",\"ecg_value\":");
  Serial.print(frame.readings.ecg_value, 3);
  Serial.print("},\"signal\":{\"ppg_quality\":\"");
  Serial.print(frame.signal.ppg_quality);
  Serial.print("\",\"ecg_quality\":\"");
  Serial.print(frame.signal.ecg_quality);
  Serial.print("\",\"leads_off\":");
  Serial.print(frame.signal.leads_off ? "true" : "false");
  Serial.print(",\"motion_detected\":");
  Serial.print(frame.signal.motion_detected ? "true" : "false");
  Serial.print("},\"device\":{\"battery\":");
  Serial.print(frame.device.battery);
  Serial.print(",\"rssi\":");
  Serial.print(frame.device.rssi);
  Serial.print(",\"firmware_version\":\"");
  Serial.print(frame.device.firmware_version);
  Serial.print("\",\"uptime_ms\":");
  Serial.print(frame.device.uptime_ms);
  Serial.println("}}");
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(400);
  randomSeed(esp_random());

  Serial.println("[CardioGuard] ESP32-S3 demo boot");
  Serial.print("[CardioGuard] Device UID: ");
  Serial.println(kDeviceUid);
  Serial.print("[CardioGuard] Initial state: ");
  Serial.println(StateToString(g_state));
}

void loop() {
  const unsigned long now_ms = millis();
  if (now_ms - g_last_tick_ms < kTelemetryIntervalMs) {
    return;
  }
  g_last_tick_ms = now_ms;

  if (g_state == RuntimeState::boot || g_state == RuntimeState::wifi_connecting ||
      g_state == RuntimeState::time_syncing || g_state == RuntimeState::paired_ready) {
    g_state = NextState(g_state);
    Serial.print("[CardioGuard] Transition -> ");
    Serial.println(StateToString(g_state));
    return;
  }

  if (g_mode == DemoMode::offline_demo) {
    g_state = RuntimeState::offline_buffering;
    Serial.println("[CardioGuard] OFFLINE_DEMO: telemetry paused");
    return;
  }

  g_state = RuntimeState::measuring;
  g_sequence++;
  const TelemetryFrame frame = GenerateRandomTelemetry(g_sequence, g_mode);
  g_state = RuntimeState::sending;

  PrintTelemetry(frame);

  g_state = RuntimeState::measuring;
}
