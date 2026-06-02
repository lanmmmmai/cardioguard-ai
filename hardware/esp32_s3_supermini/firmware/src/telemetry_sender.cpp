#include "telemetry_sender.h"

#include <HTTPClient.h>
#include <WiFi.h>

#include "config.h"

namespace {
String g_buffer[kOfflineBufferMaxFrames];
uint16_t g_buffer_head = 0;
uint16_t g_buffer_count = 0;
unsigned long g_last_wifi_attempt_ms = 0UL;
unsigned long g_backoff_until_ms = 0UL;
uint16_t g_backoff_ms = kBackoffMinMs;
String g_device_mac;

void PushBufferedPayload(const String &payload) {
  if (g_buffer_count < kOfflineBufferMaxFrames) {
    const uint16_t tail = (g_buffer_head + g_buffer_count) % kOfflineBufferMaxFrames;
    g_buffer[tail] = payload;
    g_buffer_count++;
    return;
  }

  Serial.println("[CardioGuard] WARNING: Buffer full! Oldest frame overwritten.");
  g_buffer[g_buffer_head] = payload;
  g_buffer_head = (g_buffer_head + 1) % kOfflineBufferMaxFrames;
}

bool PopBufferedPayload(String &payload) {
  if (g_buffer_count == 0) {
    return false;
  }
  payload = g_buffer[g_buffer_head];
  g_buffer[g_buffer_head] = "";
  g_buffer_head = (g_buffer_head + 1) % kOfflineBufferMaxFrames;
  g_buffer_count--;
  return true;
}

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
  const int status_code = http.POST(reinterpret_cast<const uint8_t *>(payload.c_str()), payload.length());
  http.end();
  return status_code;
}

bool IsRetryableStatus(int status_code) {
  return status_code == 429 || status_code == 500 || status_code == 502 || status_code == 503;
}
}  // namespace

void InitializeTelemetrySender() {
  WiFi.mode(WIFI_STA);
  g_device_mac = WiFi.macAddress();
  WiFi.begin(kWifiSsid, kWifiPassword);
  g_last_wifi_attempt_ms = millis();
}

void MaintainConnectivity() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - g_last_wifi_attempt_ms < kReconnectIntervalMs) {
    return;
  }

  g_last_wifi_attempt_ms = now;
  WiFi.disconnect();
  WiFi.begin(kWifiSsid, kWifiPassword);
}

bool IsWifiConnected() {
  if (g_device_mac.length() == 0) {
    g_device_mac = WiFi.macAddress();
  }
  return WiFi.status() == WL_CONNECTED;
}

uint16_t PendingBufferSize() {
  return g_buffer_count;
}

SendResult SendTelemetryFrame(const String &payload) {
  SendResult result{};
  result.sent = false;
  result.status_code = 0;
  result.auth_failed = false;
  result.should_backoff = false;
  result.buffered = false;

  const unsigned long now = millis();

  if (!IsWifiConnected()) {
    PushBufferedPayload(payload);
    result.buffered = true;
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (now < g_backoff_until_ms) {
    PushBufferedPayload(payload);
    result.should_backoff = true;
    result.buffered = true;
    result.buffer_size = PendingBufferSize();
    return result;
  }

  String send_payload = payload;
  if (g_buffer_count > 0) {
    PopBufferedPayload(send_payload);
  }

  result.status_code = PostPayload(send_payload);

  if (result.status_code >= 200 && result.status_code < 300) {
    result.sent = true;
    result.buffer_size = PendingBufferSize();
    g_backoff_ms = kBackoffMinMs;
    g_backoff_until_ms = 0UL;

    if (send_payload != payload) {
      PushBufferedPayload(payload);
      result.buffered = true;
      result.buffer_size = PendingBufferSize();
    }
    return result;
  }

  if (result.status_code == 401 || result.status_code == 403) {
    result.auth_failed = true;
    if (send_payload != payload) {
      PushBufferedPayload(send_payload);
    }
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (result.status_code == 400 || result.status_code == 404) {
    if (send_payload != payload) {
      PushBufferedPayload(send_payload);
      result.buffered = true;
    }
    result.buffer_size = PendingBufferSize();
    return result;
  }

  if (send_payload != payload) {
    PushBufferedPayload(send_payload);
  }
  PushBufferedPayload(payload);
  result.buffered = true;
  result.buffer_size = PendingBufferSize();

  if (IsRetryableStatus(result.status_code) || result.status_code <= 0) {
    result.should_backoff = true;
    g_backoff_until_ms = now + g_backoff_ms;
    g_backoff_ms = static_cast<uint16_t>(min(static_cast<unsigned long>(kBackoffMaxMs), static_cast<unsigned long>(g_backoff_ms) * 2UL));
  }

  return result;
}
