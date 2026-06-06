// C++
// CardioGuard AI — Telemetry Sender Module
//
// File Purpose:
//   Manages WiFi connectivity, offline telemetry buffering, and HTTP transmission
//   of health metrics data frames from the ESP32 to the backend.
//
// Overall Workflow/Logic:
//   1. Maintain WiFi connection in station mode.
//   2. Attempt to POST new telemetry frames to the backend.
//   3. If offline or server is busy, queue telemetry in a circular buffer (FIFO).
//   4. Drain the buffer when the connection is restored, applying exponential backoff on errors.
//
// System Component Relationships:
//   - Relies on config.h for endpoints and constants.
//   - Interfaces with the FastAPI backend via POST /api/iot/telemetry.

#include "telemetry_sender.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>

#include "config.h"

// Biến theo dõi trạng thái backoff để ghi log khi kết thúc backoff
static bool g_was_in_backoff = false;

namespace {
Preferences preferences;
String g_ssid;
String g_password;

DNSServer dnsServer;
WebServer webServer(80);
const byte DNS_PORT = 53;
bool g_ap_mode_active = false;
unsigned long g_connection_start_ms = 0;

const char kPortalHtml[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CardioGuard WiFi Setup</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #fff;
    }
    .container {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      box-sizing: border-box;
    }
    h2 {
      margin-top: 0;
      text-align: center;
      color: #00d2ff;
      font-size: 24px;
      letter-spacing: 1px;
    }
    p {
      text-align: center;
      color: #ccc;
      font-size: 14px;
      margin-bottom: 25px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #00d2ff;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-size: 16px;
      box-sizing: border-box;
      transition: all 0.3s ease;
      outline: none;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #00d2ff;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
    }
    button {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(90deg, #00d2ff, #0066ff);
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 102, 255, 0.4);
    }
    button:hover {
      background: linear-gradient(90deg, #00e5ff, #0077ff);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 102, 255, 0.6);
    }
    button:active {
      transform: translateY(1px);
    }
    .footer {
      margin-top: 25px;
      font-size: 10px;
      text-align: center;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>CardioGuard AI</h2>
    <p>WiFi Configuration Portal</p>
    <form action="/save" method="POST">
      <div class="form-group">
        <label for="ssid">WiFi Network (SSID)</label>
        <input type="text" id="ssid" name="ssid" placeholder="Enter WiFi SSID" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter Password">
      </div>
      <button type="submit">Connect Device</button>
    </form>
    <div class="footer">
      CardioGuard Wearable v0.2.0 &bull; ESP32-S3 SuperMini
    </div>
  </div>
</body>
</html>
)rawliteral";

void LoadWifiCredentials() {
  preferences.begin("wifi-config", true); // Read-only mode
  g_ssid = preferences.getString("ssid", "");
  g_password = preferences.getString("password", "");
  preferences.end();
}

void SaveWifiCredentials(const String &ssid, const String &password) {
  preferences.begin("wifi-config", false); // Read-write mode
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
  g_ssid = ssid;
  g_password = password;
}

String g_buffer[kOfflineBufferMaxFrames];  // Bộ đệm vòng lưu trữ các khung telemetry khi mất kết nối
uint16_t g_buffer_head = 0;                // Chỉ số đầu của bộ đệm vòng
uint16_t g_buffer_count = 0;               // Số lượng khung đang có trong bộ đệm
unsigned long g_last_wifi_attempt_ms = 0UL;// Thời điểm lần cuối thử kết nối WiFi
unsigned long g_backoff_until_ms = 0UL;    // Thời điểm kết thúc thời gian chờ backoff
uint16_t g_backoff_ms = kBackoffMinMs;     // Thời gian backoff hiện tại (tăng dần khi lỗi liên tiếp)
String g_device_mac;                       // Địa chỉ MAC của thiết bị

// Đẩy một khung telemetry vào bộ đệm vòng, trả về true nếu thành công
bool PushBufferedPayload(const String &payload) {
  if (g_buffer_count < kOfflineBufferMaxFrames) {
    const uint16_t tail = (g_buffer_head + g_buffer_count) % kOfflineBufferMaxFrames;
    g_buffer[tail] = payload;
    g_buffer_count++;
    Serial.print("[CardioGuard] Buffer push OK, count=");
    Serial.println(g_buffer_count);
    return true;
  }

  Serial.println("[CardioGuard] WARNING: Buffer full! Oldest frame overwritten.");
  g_buffer[g_buffer_head] = payload;
  g_buffer_head = (g_buffer_head + 1) % kOfflineBufferMaxFrames;
  return false;
}

// Lấy một khung telemetry từ bộ đệm vòng, trả về true nếu có dữ liệu
bool PopBufferedPayload(String &payload) {
  if (g_buffer_count == 0) {
    return false;
  }
  const uint16_t count_before = g_buffer_count;
  payload = g_buffer[g_buffer_head];
  g_buffer[g_buffer_head] = "";
  g_buffer_head = (g_buffer_head + 1) % kOfflineBufferMaxFrames;
  g_buffer_count--;
  Serial.print("[CardioGuard] Buffer pop: count before=");
  Serial.print(count_before);
  Serial.print(" after=");
  Serial.println(g_buffer_count);
  return true;
}

// Gửi một payload HTTP POST đến endpoint telemetry, trả về mã trạng thái HTTP
int PostPayload(const String &payload) {
  HTTPClient http;
  http.setTimeout(kHttpTimeoutMs);
  http.begin(kTelemetryEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Uid", kDeviceUid);
  if (g_device_mac.length() > 0) {
    http.addHeader("X-Device-Mac", g_device_mac);
  }
  http.addHeader("X-Device-Token", kDeviceToken);
  const unsigned long post_start = millis();
  Serial.print("[CardioGuard] HTTP POST ");
  Serial.print(kTelemetryEndpoint);
  Serial.print(" payload_size=");
  Serial.println(payload.length());
  // Use http.POST(String) to avoid const cast issue on Espressif SDK HTTPClient
  const int status_code = http.POST(payload);
  const unsigned long post_duration = millis() - post_start;
  Serial.print("[CardioGuard] HTTP response status=");
  Serial.print(status_code);
  Serial.print(" duration=");
  Serial.println(post_duration);
  http.end();
  return status_code;
}

// Kiểm tra xem mã trạng thái HTTP có thể thử lại hay không
bool IsRetryableStatus(int status_code) {
  return status_code == 429 || status_code == 500 || status_code == 502 || status_code == 503;
}
}  // Kết thúc namespace ẩn danh

// Khởi chạy cổng thông tin Web AP
void StartWiFiPortal() {
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);
  WiFi.softAP("CardioGuard-Setup");

  // Khởi động DNS Server để tự động chuyển hướng truy cập (Captive Portal)
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  // Định nghĩa các handler cho Web Server
  webServer.on("/", HTTP_GET, []() {
    webServer.send(200, "text/html", kPortalHtml);
  });

  webServer.on("/save", HTTP_POST, []() {
    String ssid = webServer.arg("ssid");
    String password = webServer.arg("password");
    if (ssid.length() > 0) {
      String successHtml = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'>"
                           "<style>body{background:#0f2027;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;text-align:center;}h2{color:#00d2ff;}</style></head>"
                           "<body><h2>Configuration Saved!</h2><p>Connecting to WiFi: " + ssid + "...</p><p>You can close this window now.</p></body></html>";
      webServer.send(200, "text/html", successHtml);
      delay(1000);
      UpdateWifiConfig(ssid, password);
      StopWiFiPortal();
    } else {
      webServer.send(400, "text/plain", "SSID cannot be empty");
    }
  });

  webServer.onNotFound([]() {
    String host = webServer.hostHeader();
    if (host != "192.168.4.1") {
      webServer.sendHeader("Location", "http://192.168.4.1/", true);
      webServer.send(302, "text/plain", "");
    } else {
      webServer.send(404, "text/plain", "Not Found");
    }
  });

  webServer.begin();
  g_ap_mode_active = true;
  Serial.println("[CardioGuard] WiFi Access Point Portal started: 'CardioGuard-Setup' (192.168.4.1)");
}

// Dừng cổng thông tin Web AP
void StopWiFiPortal() {
  webServer.stop();
  dnsServer.stop();
  g_ap_mode_active = false;
  WiFi.mode(WIFI_STA);
  Serial.println("[CardioGuard] WiFi Access Point Portal stopped.");
}

// Kiểm tra xem cổng Web AP có đang hoạt động hay không
bool IsWiFiPortalActive() {
  return g_ap_mode_active;
}

// Xử lý các yêu cầu DNS/Web (gọi liên tục trong loop)
void HandleWiFiPortal() {
  if (g_ap_mode_active) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }
}

// Khởi tạo bộ gửi telemetry: cấu hình WiFi ở chế độ station và bắt đầu kết nối
void InitializeTelemetrySender() {
  WiFi.mode(WIFI_STA);
  g_device_mac = WiFi.macAddress();
  LoadWifiCredentials();
  if (g_ssid.length() > 0) {
    Serial.println("[CardioGuard] WiFi configured, SSID: " + g_ssid);
    WiFi.begin(g_ssid.c_str(), g_password.c_str());
    g_connection_start_ms = millis();
  } else {
    Serial.println("[CardioGuard] WiFi not configured. Initializing AP Web Portal.");
    StartWiFiPortal();
  }
  g_last_wifi_attempt_ms = millis();
}

// Duy trì kết nối WiFi, tự động thử kết nối lại hoặc chuyển sang AP Mode
void MaintainConnectivity() {
  if (g_ap_mode_active) {
    return;
  }

  if (g_ssid.length() == 0) {
    StartWiFiPortal();
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();

  // Nếu đã cố gắng kết nối quá 15 giây mà thất bại -> chuyển sang AP Portal
  if (now - g_connection_start_ms > 15000) {
    Serial.println("[CardioGuard] WiFi connection timeout. Falling back to AP Portal.");
    StartWiFiPortal();
    return;
  }

  if (now - g_last_wifi_attempt_ms < kReconnectIntervalMs) {
    return;
  }

  g_last_wifi_attempt_ms = now;
  Serial.println("[CardioGuard] Reconnecting to SSID: " + g_ssid);
}

void UpdateWifiConfig(const String &ssid, const String &password) {
  SaveWifiCredentials(ssid, password);
  WiFi.disconnect();
  if (ssid.length() > 0) {
    Serial.println("[CardioGuard] Saving new WiFi config. Connecting to: " + ssid);
    WiFi.begin(ssid.c_str(), password.c_str());
    g_connection_start_ms = millis();
  } else {
    Serial.println("[CardioGuard] WiFi config cleared.");
  }
  g_last_wifi_attempt_ms = millis();
}

bool IsWifiConfigured() {
  return g_ssid.length() > 0;
}

// Kiểm tra xem WiFi đã kết nối hay chưa
bool IsWifiConnected() {
  if (g_device_mac.length() == 0) {
    g_device_mac = WiFi.macAddress();
  }
  return WiFi.status() == WL_CONNECTED;
}

// Trả về số lượng khung telemetry đang chờ trong bộ đệm
uint16_t PendingBufferSize() {
  return g_buffer_count;
}

// Gửi một khung telemetry, xử lý backoff, bộ đệm offline và các lỗi xác thực
SendResult SendTelemetryFrame(const String &payload) {
  SendResult result{};
  result.sent = false;
  result.status_code = 0;
  result.auth_failed = false;
  result.should_backoff = false;
  result.buffered = false;
  result.buffer_overwritten = false;

  const unsigned long now = millis();

  if (!IsWifiConnected()) {
    result.buffer_overwritten = !PushBufferedPayload(payload);
    result.buffered = true;
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (now < g_backoff_until_ms) {
    if (!g_was_in_backoff) {
      Serial.print("[CardioGuard] Backoff in progress, delay=");
      Serial.print(g_backoff_ms);
      Serial.println("ms");
      g_was_in_backoff = true;
    }
    result.buffer_overwritten = !PushBufferedPayload(payload);
    result.should_backoff = true;
    result.buffered = true;
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (g_was_in_backoff) {
    Serial.println("[CardioGuard] Backoff ended, resuming");
    g_was_in_backoff = false;
  }

  String send_payload = payload;
  bool is_buffered_frame = false;
  if (g_buffer_count > 0) {
    PopBufferedPayload(send_payload);
    is_buffered_frame = true;
  }

  result.status_code = PostPayload(send_payload);

  if (result.status_code >= 200 && result.status_code < 300) {
    result.sent = true;
    result.buffer_size = PendingBufferSize();
    if (g_buffer_count == 0 && is_buffered_frame) {
      Serial.println("[CardioGuard] Buffer drained, all pending frames sent");
    }
    g_backoff_ms = kBackoffMinMs;
    g_backoff_until_ms = 0UL;

    if (is_buffered_frame) {
      result.buffer_overwritten = !PushBufferedPayload(payload);
      result.buffered = true;
      result.buffer_size = PendingBufferSize();
    }
    return result;
  }

  if (result.status_code == 401 || result.status_code == 403) {
    result.auth_failed = true;
    Serial.println("[CardioGuard] Auth failure: HTTP " + String(result.status_code));
    if (is_buffered_frame) {
      result.buffer_overwritten = !PushBufferedPayload(send_payload);
    }
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (result.status_code == 400 || result.status_code == 404) {
    if (is_buffered_frame) {
      result.buffer_overwritten = !PushBufferedPayload(send_payload);
      result.buffered = true;
    }
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (is_buffered_frame) {
    result.buffer_overwritten = !PushBufferedPayload(send_payload);
  }
  const bool over = !PushBufferedPayload(payload);
  result.buffer_overwritten = result.buffer_overwritten || over;
  result.buffered = true;
  result.buffer_size = PendingBufferSize();

  if (IsRetryableStatus(result.status_code) || result.status_code <= 0) {
    result.should_backoff = true;
    g_backoff_until_ms = now + g_backoff_ms;
    Serial.print("[CardioGuard] Backoff started, delay=");
    Serial.print(g_backoff_ms);
    Serial.println("ms");
    g_backoff_ms = static_cast<uint16_t>(min(static_cast<unsigned long>(kBackoffMaxMs), static_cast<unsigned long>(g_backoff_ms) * 2UL));
  }

  return result;
}
