---
name: cardioguard-telemetry-optimization
description: Performance optimization guidelines for handling high-frequency telemetry, WebSockets, and real-time ECG/3D heart rendering in CardioGuard AI.
---

# CardioGuard Telemetry & Performance Optimization Skill

## Scope
Use this skill when modifying WebSocket services, real-time message handlers, custom painter canvases, or vital sign charts in:
- `backend`: Sensor routers, telemetry dispatchers, and IoT payload validation.
- `web_frontend` & `mobile_app`: WebSocket hooks, ECG charts, 3D heart simulations, and dashboard metric grids.

## Rules

### 1. High-Frequency State Update Throttling
- **Avoid Frequent setState**: Telemetry events arrive at a very high frequency (60Hz+ for raw ECG). Do not trigger a full React or Flutter component state update for every single raw packet.
- **Throttling & Buffering**:
  - In Frontend: Use `useRef` to hold the latest telemetry data and read from it in animation loops (e.g., using `requestAnimationFrame` for ECG drawing).
  - In Flutter: Use specialized stream controllers or rebuild-limiting widgets (like `ValueNotifier` or `AnimatedBuilder`) to narrow down the rebuild scope.

### 2. Efficient Data Buffers
- **No Costly Array Operations**: Do not use costly array manipulations (like `Array.prototype.shift()` in JavaScript or `List.removeAt(0)` in Dart) at 60fps, as they are $O(n)$ operations and will degrade performance.
- **Circular/Ring Buffers**: Implement ring buffers (circular buffers) or fixed-size queues (`ListQueue` in Dart) with pointer indexes to manage historical ECG chart points.

### 3. Connection Lifecycles & Resource Cleanups
- **Explicit Disconnects**: Ensure WebSockets are cleanly disconnected on component unmounting. Clear any active `setInterval`, `setTimeout`, or animation loops to prevent memory leaks and "set state on unmounted component" warnings.
- **Backoff Reconnections**: Reconnection logic must implement exponential backoff (e.g., waiting 2s, 4s, 8s...) instead of a static short interval (e.g., 3s infinitely) to prevent server flooding and device battery drainage.

### 4. Telemetry Schema Validation
- **Strict Bounds Verification**: Telemetry inputs must be verified before processing (e.g., reject negative heart rates, or oxygen saturation values above 100%).
- **Fail-Safe Value Mocking**: If telemetry fails, display a clear disconnected/stale state in the UI instead of rendering incorrect simulated flatlines.
