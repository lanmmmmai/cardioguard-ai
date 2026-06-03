#pragma once

// Các trạng thái thời gian chạy của thiết bị trong máy trạng thái
enum class RuntimeState {
  boot,                 // Khởi động hệ thống
  wifi_connecting,      // Đang kết nối WiFi
  time_syncing,         // Đang đồng bộ thời gian (NTP)
  paired_ready,         // Đã ghép nối và sẵn sàng
  measuring,            // Đang thu thập dữ liệu đo
  sending,              // Đang gửi dữ liệu telemetry
  wifi_disconnected,    // Mất kết nối WiFi
  auth_failed,          // Xác thực thất bại
  backend_unavailable,  // Máy chủ backend không khả dụng
  low_battery,          // Pin yếu
  poor_signal,          // Tín hiệu cảm biến kém
  sensor_error,         // Lỗi cảm biến
  offline_buffering     // Đang lưu trữ dữ liệu offline trong bộ đệm
};

// Cấu trúc đánh giá chất lượng tín hiệu cảm biến
struct SignalQuality {
  const char *ppg_quality;    // Chất lượng tín hiệu PPG (good/poor)
  const char *ecg_quality;    // Chất lượng tín hiệu ECG (good/poor)
  bool leads_off;             // Các điện cực có bị tuột hay không
  bool motion_detected;       // Có phát hiện chuyển động nhiễu hay không
};

// Cấu trúc trạng thái thiết bị
struct DeviceStatus {
  int battery;                // Mức pin (0-100)
  int rssi;                   // Cường độ tín hiệu WiFi (dBm)
  const char *firmware_version;  // Phiên bản firmware
  unsigned long uptime_ms;    // Thời gian hoạt động kể từ khi khởi động (ms)
};

// Cấu trúc chứa các giá trị đo lường từ cảm biến
struct TelemetryReadings {
  int heart_rate;             // Nhịp tim (BPM)
  int spo2;                   // Độ bão hòa oxy trong máu (SpO2)
  bool has_bp;                // Có dữ liệu huyết áp hay không
  int systolic_bp;            // Huyết áp tâm thu
  int diastolic_bp;           // Huyết áp tâm trương
  float ecg_value;            // Giá trị tín hiệu ECG
  bool has_body_temperature;  // Có dữ liệu nhiệt độ cơ thể hay không
  float body_temperature;     // Nhiệt độ cơ thể (°C)
  bool has_motion_value;      // Có dữ liệu chuyển động hay không
  float motion_value;         // Giá trị cảm biến chuyển động
};

// Cấu trúc khung telemetry hoàn chỉnh gửi lên máy chủ
struct TelemetryFrame {
  const char *device_uid;     // Định danh thiết bị
  unsigned long sequence;     // Số thứ tự khung telemetry
  const char *mode;           // Chế độ demo hiện tại
  TelemetryReadings readings; // Dữ liệu đo lường
  SignalQuality signal;       // Chất lượng tín hiệu
  DeviceStatus device;        // Trạng thái thiết bị
};
