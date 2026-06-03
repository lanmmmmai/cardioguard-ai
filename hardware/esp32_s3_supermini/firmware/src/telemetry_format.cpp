#include "telemetry_format.h"

namespace {
// Thêm giá trị số nguyên vào chuỗi JSON, nếu không có giá trị thì thêm null
void AppendNullableInt(String &json, bool has_value, int value) {
  if (has_value) {
    json += String(value);
  } else {
    json += "null";
  }
}

// Thêm giá trị số thực vào chuỗi JSON với độ chính xác cho trước, nếu không có thì thêm null
void AppendNullableFloat(String &json, bool has_value, float value, int precision) {
  if (has_value) {
    json += String(value, precision);
  } else {
    json += "null";
  }
}

// Thoát các ký tự đặc biệt trong chuỗi để đảm bảo JSON hợp lệ
String EscapeJsonString(const String &input) {
  String output;
  output.reserve(input.length() + 8);
  for (size_t i = 0; i < input.length(); i++) {
    char c = input[i];
    switch (c) {
      case '"':  output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\b': output += "\\b";  break;
      case '\f': output += "\\f";  break;
      case '\n': output += "\\n";  break;
      case '\r': output += "\\r";  break;
      case '\t': output += "\\t";  break;
      default:
        if (c < 32) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", c);
          output += buf;
        } else {
          output += c;
        }
        break;
    }
  }
  return output;
}
}  // Kết thúc namespace ẩn danh

// Xây dựng chuỗi JSON hoàn chỉnh từ cấu trúc TelemetryFrame
String BuildTelemetryJson(const TelemetryFrame &frame) {
  String json;
  json.reserve(1024);

  json += "{\"device_uid\":\"";
  json += EscapeJsonString(frame.device_uid);
  json += "\",\"sequence\":";
  json += String(frame.sequence);
  json += ",\"mode\":\"";
  json += EscapeJsonString(frame.mode);
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
  json += EscapeJsonString(frame.signal.ppg_quality);
  json += "\",\"ecg_quality\":\"";
  json += EscapeJsonString(frame.signal.ecg_quality);
  json += "\",\"leads_off\":";
  json += frame.signal.leads_off ? "true" : "false";
  json += ",\"motion_detected\":";
  json += frame.signal.motion_detected ? "true" : "false";
  json += "},\"device\":{\"battery\":";
  json += String(frame.device.battery);
  json += ",\"rssi\":";
  json += String(frame.device.rssi);
  json += ",\"firmware_version\":\"";
  json += EscapeJsonString(frame.device.firmware_version);
  json += "\",\"uptime_ms\":";
  json += String(frame.device.uptime_ms);
  json += "}}";

  return json;
}
