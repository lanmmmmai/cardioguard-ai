#pragma once

#include <Arduino.h>

#include "config.h"
#include "types.h"

// Sinh một khung telemetry ngẫu nhiên dựa trên số thứ tự và chế độ demo
TelemetryFrame GenerateRandomTelemetry(unsigned long sequence, DemoMode mode);
// Chuyển đổi giá trị DemoMode thành chuỗi ký tự
const char *ModeToString(DemoMode mode);
// Phân tích chuỗi văn bản thành giá trị DemoMode, trả về fallback nếu không khớp
DemoMode ParseModeFromText(const String &text, DemoMode fallback_mode);
