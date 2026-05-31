#pragma once

#include "config.h"
#include "types.h"

TelemetryFrame GenerateRandomTelemetry(unsigned long sequence, DemoMode mode);
const char *ModeToString(DemoMode mode);
