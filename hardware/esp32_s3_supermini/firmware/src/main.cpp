#include <Arduino.h>

#include "config.h"
#include "random_telemetry.h"
#include "state_machine.h"
#include "telemetry_format.h"
#include "telemetry_sender.h"

namespace {
RuntimeState g_state = RuntimeState::boot;          // Trạng thái thời gian chạy hiện tại của thiết bị
DemoMode g_mode = kDefaultMode;                      // Chế độ demo hiện tại, mặc định là normal
unsigned long g_last_tick_ms = 0UL;                  // Mốc thời gian (ms) lần cuối xử lý telemetry
unsigned long g_sequence = 0UL;                      // Số thứ tự của khung telemetry hiện tại
String g_serial_line;                                // Bộ đệm dòng lệnh nhận từ cổng Serial

void PrintTelemetry(const TelemetryFrame &frame) {
  const String json = BuildTelemetryJson(frame);
  Serial.println(json);
}

void HandleSerialCommand(const String &command) {
  if (command.startsWith("mode ")) {
    const String value = command.substring(5);
    const DemoMode previous_mode = g_mode;
    g_mode = ParseModeFromText(value, g_mode);
    if (g_mode != previous_mode) {
      Serial.print("[CardioGuard] Mode -> ");
      Serial.println(ModeToString(g_mode));
    } else {
      Serial.print("[CardioGuard] Mode unchanged: ");
      Serial.println(ModeToString(g_mode));
    }
    return;
  }

  if (command.startsWith("wifi ")) {
    String body = command.substring(5);
    body.trim();

    String ssid, password;
    if (body.startsWith("\"")) {
      int next_quote = body.indexOf("\"", 1);
      if (next_quote != -1) {
        ssid = body.substring(1, next_quote);
        String rest = body.substring(next_quote + 1);
        rest.trim();
        if (rest.startsWith("\"") && rest.endsWith("\"") && rest.length() >= 2) {
          password = rest.substring(1, rest.length() - 1);
        } else {
          password = rest;
        }
      }
    } else {
      int space_idx = body.indexOf(" ");
      if (space_idx != -1) {
        ssid = body.substring(0, space_idx);
        password = body.substring(space_idx + 1);
        password.trim();
      } else {
        ssid = body;
        password = "";
      }
    }

    if (ssid.length() > 0) {
      UpdateWifiConfig(ssid, password);
    } else {
      Serial.println("[CardioGuard] Invalid wifi command syntax. Use: wifi <ssid> <password> or wifi \"ssid\" \"password\"");
    }
    return;
  }

  if (command == "status") {
    Serial.print("[CardioGuard] State=");
    Serial.print(StateToString(g_state));
    Serial.print(", Mode=");
    Serial.print(ModeToString(g_mode));
    Serial.print(", Sequence=");
    Serial.print(g_sequence);
    Serial.print(", WiFi=");
    Serial.print(IsWifiConnected() ? "connected" : "disconnected");
    Serial.print(", Buffer=");
    Serial.println(PendingBufferSize());
    return;
  }

  if (command == "help") {
    Serial.println("[CardioGuard] Commands:");
    Serial.println("  mode normal");
    Serial.println("  mode occasional");
    Serial.println("  mode critical");
    Serial.println("  mode poor_signal");
    Serial.println("  mode offline");
    Serial.println("  wifi <ssid> <password>  Configure WiFi credentials");
    Serial.println("  status");
    return;
  }

  if (command.length() > 0) {
    Serial.print("[CardioGuard] Unknown command: ");
    Serial.println(command);
  }
}

void PollSerialCommands() {
  while (Serial.available() > 0) {
    const char ch = static_cast<char>(Serial.read());
    if (ch == '\n' || ch == '\r') {
      if (g_serial_line.length() > 0) {
        HandleSerialCommand(g_serial_line);
        g_serial_line = "";
      }
      continue;
    }

    if (g_serial_line.length() < 80) {
      g_serial_line += ch;
    } else {
      Serial.println("[CardioGuard] WARNING: Serial command buffer overflow! Clearing.");
      g_serial_line = "";
    }
  }
}
}  // Kết thúc namespace ẩn danh

void setup() {
  Serial.begin(115200);
  delay(400);
  randomSeed(esp_random());
  InitializeTelemetrySender();

  Serial.println("[CardioGuard] ESP32-S3 demo boot");
  Serial.print("[CardioGuard] Device UID: ");
  Serial.println(kDeviceUid);
  Serial.print("[CardioGuard] Initial state: ");
  Serial.println(StateToString(g_state));
  Serial.println("[CardioGuard] Type 'help' for serial commands");
}

void loop() {
  HandleWiFiPortal();
  PollSerialCommands();
  MaintainConnectivity();

  const unsigned long now_ms = millis();
  if (now_ms - g_last_tick_ms < kTelemetryIntervalMs) {
    return;
  }
  g_last_tick_ms = now_ms;

  if (g_state == RuntimeState::boot) {
    g_state = RuntimeState::wifi_connecting;
    g_last_tick_ms = now_ms;
    Serial.println("[CardioGuard] State: BOOT -> WIFI_CONNECTING");
    return;
  }

  if (g_state == RuntimeState::wifi_connecting) {
    if (IsWifiConnected()) {
      g_state = RuntimeState::time_syncing;
      g_last_tick_ms = now_ms;
      Serial.println("[CardioGuard] WiFi connected! Transition -> TIME_SYNCING");
    } else {
      static unsigned long last_conn_print = 0;
      if (now_ms - last_conn_print > 5000) {
        if (!IsWifiConfigured()) {
          Serial.println("[CardioGuard] WiFi not configured. Please enter command: wifi <ssid> <password>");
        } else {
          Serial.println("[CardioGuard] Connecting to WiFi...");
        }
        last_conn_print = now_ms;
      }
    }
    return;
  }

  if (g_state == RuntimeState::time_syncing) {
    if (now_ms - g_last_tick_ms >= 2000UL) {
      g_state = RuntimeState::paired_ready;
      g_last_tick_ms = now_ms;
      Serial.println("[CardioGuard] Time synced (NTP)! Transition -> PAIRED_READY");
    }
    return;
  }

  if (g_state == RuntimeState::paired_ready) {
    if (now_ms - g_last_tick_ms >= 1000UL) {
      g_state = RuntimeState::measuring;
      Serial.println("[CardioGuard] Device paired & ready! Transition -> MEASURING");
    }
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

  const String payload = BuildTelemetryJson(frame);
  const SendResult send_result = SendTelemetryFrame(payload);
  PrintTelemetry(frame);
  if (send_result.auth_failed) {
    g_state = RuntimeState::auth_failed;
    Serial.println("[CardioGuard] AUTH_FAILED: token rejected");
    return;
  }

  if (!IsWifiConnected()) {
    g_state = RuntimeState::wifi_disconnected;
  } else if (send_result.should_backoff) {
    g_state = RuntimeState::backend_unavailable;
  } else if (send_result.buffered) {
    g_state = RuntimeState::offline_buffering;
  } else {
    g_state = RuntimeState::measuring;
  }

  Serial.print("[CardioGuard] send status=");
  Serial.print(send_result.status_code);
  Serial.print(", buffered=");
  Serial.print(send_result.buffered ? "true" : "false");
  Serial.print(", pending=");
  Serial.println(send_result.buffer_size);


}
