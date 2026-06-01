#pragma once

#include "types.h"

RuntimeState NextState(RuntimeState current_state);
const char *StateToString(RuntimeState state);
