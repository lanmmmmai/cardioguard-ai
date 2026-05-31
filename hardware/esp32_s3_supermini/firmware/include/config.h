#pragma once

// Phase 1 demo config: keep static values for quick bring-up.
static const char *kDeviceUid = "CG-ESP32S3-0001";
static const char *kFirmwareVersion = "0.1.0-random";
static const unsigned long kTelemetryIntervalMs = 1000UL;

enum class DemoMode {
  normal,
  occasional_abnormal,
  critical_demo,
  poor_signal_demo,
  offline_demo
};

static const DemoMode kDefaultMode = DemoMode::normal;
