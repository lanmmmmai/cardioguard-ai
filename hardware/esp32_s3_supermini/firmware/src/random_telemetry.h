#pragma once

#include <Arduino.h>

#include "config.h"
#include "types.h"

TelemetryFrame GenerateRandomTelemetry(unsigned long sequence, DemoMode mode);
const char *ModeToString(DemoMode mode);
DemoMode ParseModeFromText(const String &text, DemoMode fallback_mode);
