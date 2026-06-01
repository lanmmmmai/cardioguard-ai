#pragma once

#include <Arduino.h>

#include "types.h"

String BuildTelemetryJson(const TelemetryFrame &frame);
