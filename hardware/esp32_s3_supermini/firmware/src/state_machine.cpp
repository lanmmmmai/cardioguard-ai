#include "state_machine.h"

// Trả về trạng thái tiếp theo dựa trên trạng thái hiện tại của máy trạng thái
RuntimeState NextState(RuntimeState current_state) {
  switch (current_state) {
    case RuntimeState::boot:
      return RuntimeState::wifi_connecting;
    case RuntimeState::wifi_connecting:
      return RuntimeState::time_syncing;
    case RuntimeState::time_syncing:
      return RuntimeState::paired_ready;
    case RuntimeState::paired_ready:
      return RuntimeState::measuring;
    case RuntimeState::measuring:
      return RuntimeState::sending;
    case RuntimeState::sending:
      return RuntimeState::measuring;
    default:
      return RuntimeState::measuring;
  }
}

// Chuyển đổi giá trị RuntimeState thành chuỗi ký tự để in ra màn hình
const char *StateToString(RuntimeState state) {
  switch (state) {
    case RuntimeState::boot:
      return "BOOT";
    case RuntimeState::wifi_connecting:
      return "WIFI_CONNECTING";
    case RuntimeState::time_syncing:
      return "TIME_SYNCING";
    case RuntimeState::paired_ready:
      return "PAIRED_READY";
    case RuntimeState::measuring:
      return "MEASURING";
    case RuntimeState::sending:
      return "SENDING";
    case RuntimeState::wifi_disconnected:
      return "WIFI_DISCONNECTED";
    case RuntimeState::auth_failed:
      return "AUTH_FAILED";
    case RuntimeState::backend_unavailable:
      return "BACKEND_UNAVAILABLE";
    case RuntimeState::low_battery:
      return "LOW_BATTERY";
    case RuntimeState::poor_signal:
      return "POOR_SIGNAL";
    case RuntimeState::sensor_error:
      return "SENSOR_ERROR";
    case RuntimeState::offline_buffering:
      return "OFFLINE_BUFFERING";
  }
  return "UNKNOWN";
}
