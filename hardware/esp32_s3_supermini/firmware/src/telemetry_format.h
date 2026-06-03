#pragma once

#include <Arduino.h>

#include "types.h"

// Xây dựng chuỗi JSON từ cấu trúc TelemetryFrame
String BuildTelemetryJson(const TelemetryFrame &frame);
