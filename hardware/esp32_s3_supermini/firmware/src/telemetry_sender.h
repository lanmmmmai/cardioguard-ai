#pragma once

#include <Arduino.h>

// Cấu trúc chứa kết quả gửi khung telemetry
struct SendResult {
  bool sent;                // Đã gửi thành công hay chưa
  int status_code;           // Mã trạng thái HTTP trả về từ máy chủ
  bool auth_failed;          // Xác thực thất bại (401/403)
  bool should_backoff;       // Cần chờ trước khi gửi lại (backoff)
  bool buffered;             // Dữ liệu đã được lưu vào bộ đệm offline
  uint16_t buffer_size;      // Số lượng khung đang chờ trong bộ đệm
  bool buffer_overwritten;   // Khung cũ đã bị ghi đè do bộ đệm đầy
};

// Khởi tạo bộ gửi telemetry
void InitializeTelemetrySender();
// Duy trì kết nối mạng
void MaintainConnectivity();
// Kiểm tra trạng thái kết nối WiFi
bool IsWifiConnected();
// Lấy số lượng khung đang chờ trong bộ đệm
uint16_t PendingBufferSize();
// Gửi một khung telemetry và trả về kết quả
SendResult SendTelemetryFrame(const String &payload);
// Cập nhật cấu hình WiFi động và lưu vào NVS Preferences
void UpdateWifiConfig(const String &ssid, const String &password);
// Kiểm tra xem WiFi đã có cấu hình trong NVS chưa
bool IsWifiConfigured();

