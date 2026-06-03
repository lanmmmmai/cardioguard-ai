#pragma once

#include "types.h"

// Xác định trạng thái tiếp theo dựa trên trạng thái hiện tại của máy trạng thái
RuntimeState NextState(RuntimeState current_state);
// Chuyển đổi trạng thái RuntimeState thành chuỗi để hiển thị
const char *StateToString(RuntimeState state);
