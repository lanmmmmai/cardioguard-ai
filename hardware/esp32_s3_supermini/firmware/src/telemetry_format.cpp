#include "telemetry_format.h"

namespace {
void AppendNullableInt(String &json, bool has_value, int value) {
  if (has_value) {
    json += String(value);
  } else {
    json += "null";
  }
}

void AppendNullableFloat(String &json, bool has_value, float value, int precision) {
  if (has_value) {
    json += String(value, precision);
  } else {
    json += "null";
  }
}
}  // namespace

String BuildTelemetryJson(const TelemetryFrame &frame) {
  String json;
  json.reserve(512);

  json += "{\"device_uid\":\"";
  json += frame.device_uid;
  json += "\",\"sequence\":";
  json += String(frame.sequence);
  json += ",\"mode\":\"";
  json += frame.mode;
  json += "\",\"readings\":{\"heart_rate\":";
  json += String(frame.readings.heart_rate);
  json += ",\"spo2\":";
  json += String(frame.readings.spo2);
  json += ",\"systolic_bp\":";
  AppendNullableInt(json, frame.readings.has_bp, frame.readings.systolic_bp);
  json += ",\"diastolic_bp\":";
  AppendNullableInt(json, frame.readings.has_bp, frame.readings.diastolic_bp);
  json += ",\"ecg_value\":";
  json += String(frame.readings.ecg_value, 3);
  json += ",\"body_temperature\":";
  AppendNullableFloat(json, frame.readings.has_body_temperature, frame.readings.body_temperature, 2);
  json += ",\"motion_value\":";
  AppendNullableFloat(json, frame.readings.has_motion_value, frame.readings.motion_value, 3);
  json += "},\"signal\":{\"ppg_quality\":\"";
  json += frame.signal.ppg_quality;
  json += "\",\"ecg_quality\":\"";
  json += frame.signal.ecg_quality;
  json += "\",\"leads_off\":";
  json += frame.signal.leads_off ? "true" : "false";
  json += ",\"motion_detected\":";
  json += frame.signal.motion_detected ? "true" : "false";
  json += "},\"device\":{\"battery\":";
  json += String(frame.device.battery);
  json += ",\"rssi\":";
  json += String(frame.device.rssi);
  json += ",\"firmware_version\":\"";
  json += frame.device.firmware_version;
  json += "\",\"uptime_ms\":";
  json += String(frame.device.uptime_ms);
  json += "}}";

  return json;
}
