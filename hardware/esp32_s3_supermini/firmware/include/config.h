#pragma once

/* Cấu hình bản demo Giai đoạn 1: giữ các giá trị tĩnh để khởi động nhanh. */
inline constexpr const char* kDeviceUid = "CG-ESP32S3-0001";             // Định danh duy nhất của thiết bị
inline constexpr const char* kFirmwareVersion = "0.2.0-random";           // Phiên bản firmware hiện tại
inline constexpr unsigned long kTelemetryIntervalMs = 1000UL;             // Khoảng thời gian giữa các lần gửi telemetry (ms)
inline constexpr const char* kTelemetryEndpointOnline = "https://cardioguard-ai-backend.onrender.com/api/iot/telemetry";  // Endpoint Online
inline constexpr const char* kTelemetryEndpointLocal = "http://192.168.1.25:8000/api/iot/telemetry";  // Endpoint Local
inline constexpr const char* kDeviceToken = "cgdt_dev_shared_token_vitals";       // Token xác thực thiết bị, cần thay thế
inline constexpr uint16_t kHttpTimeoutMs = 8000;                         // Thời gian chờ tối đa cho mỗi yêu cầu HTTP (ms)
inline constexpr uint16_t kOfflineBufferMaxFrames = 300;                  // Số khung telemetry tối đa lưu trong bộ đệm offline
inline constexpr uint16_t kReconnectIntervalMs = 5000;                   // Khoảng thời gian giữa các lần thử kết nối lại WiFi (ms)
inline constexpr uint16_t kBackoffMinMs = 1000;                          // Thời gian backoff tối thiểu (ms)
inline constexpr uint16_t kBackoffMaxMs = 30000;                         // Thời gian backoff tối đa (ms)

// Các chế độ demo mô phỏng các tình huống lâm sàng khác nhau
enum class DemoMode {
  normal,               // Chế độ bình thường, dữ liệu trong khoảng khỏe mạnh
  occasional_abnormal,  // Thỉnh thoảng có giá trị bất thường
  critical_demo,        // Mô phỏng tình trạng nguy kịch
  poor_signal_demo,     // Mô phỏng tín hiệu cảm biến kém
  offline_demo          // Mô phỏng mất kết nối mạng
};

inline constexpr DemoMode kDefaultMode = DemoMode::normal;  // Chế độ demo mặc định khi khởi động
