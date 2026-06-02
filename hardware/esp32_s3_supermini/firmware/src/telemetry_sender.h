#pragma once

#include <Arduino.h>

struct SendResult {
  bool sent;
  int status_code;
  bool auth_failed;
  bool should_backoff;
  bool buffered;
  uint16_t buffer_size;
  bool buffer_overwritten;
};

void InitializeTelemetrySender();
void MaintainConnectivity();
bool IsWifiConnected();
uint16_t PendingBufferSize();
SendResult SendTelemetryFrame(const String &payload);
