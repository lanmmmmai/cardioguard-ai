# WebSocket Protocol

CardioGuard sử dụng WebSocket để gửi realtime events từ backend tới client (web dashboard, mobile app).

## Connection

### Endpoint

```
ws://<host>:8000/api/ws/realtime
wss://<host>/api/ws/realtime  (production)
```

### Authentication

JWT được gửi qua `Sec-WebSocket-Protocol` header:

```
Sec-WebSocket-Protocol: cardioguard.jwt.<access_token>
```

Hoặc qua JSON message đầu tiên sau khi connect:

```json
{"type": "auth", "token": "<access_token>"}
```

Server chờ auth tối đa 8 giây. Hết thời gian → close (1008).

### Response khi auth thành công

```json
{"type": "connected", "message": "CardioGuard AI realtime socket connected for user@example.com", "timestamp": "2026-06-04T10:00:00Z"}
```

## Keepalive

Client gửi `ping` (plain text, không phải JSON) mỗi 25 giây. Server trả `pong`:

```json
{"type": "pong", "timestamp": "2026-06-04T10:00:25Z"}
```

## Server → Client Events

### `health_metrics`

Dữ liệu cảm biến mới. Gửi tới patient sở hữu, doctor được phân công, và admin.

```json
{
  "type": "health_metrics",
  "patient_id": "uuid",
  "data": {
    "patient_id": "uuid",
    "heart_rate": 72,
    "spo2": 98,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "ecg_value": 0.15,
    "is_abnormal": false,
    "alerts": []
  }
}
```

### `emergency_alerts`

Cảnh báo bất thường hoặc SOS. Gửi tới patient sở hữu, doctor được phân công, và admin.

```json
{
  "type": "emergency_alerts",
  "patient_id": "uuid",
  "data": {
    "alert_type": "HIGH_HEART_RATE",
    "severity": "critical",
    "message": "Nhịp tim cao: 145 bpm"
  }
}
```

### `chat`

Tin nhắn chat AI hoặc doctor-patient. Gửi tới sender + recipient.

```json
{
  "type": "chat",
  "data": {
    "session_id": "uuid",
    "sender": "user",
    "message": "Nội dung tin nhắn"
  }
}
```

### `appointments`

Cập nhật lịch hẹn. Gửi tới patient + doctor liên quan.

```json
{
  "type": "appointments",
  "data": {
    "id": "uuid",
    "patient_id": "uuid",
    "doctor_id": "uuid",
    "title": "Tái khám",
    "status": "scheduled"
  }
}
```

### `notifications`

Thông báo chung. Gửi tới user đích.

```json
{
  "type": "notifications",
  "data": {
    "title": "Cập nhật hồ sơ",
    "message": "Hồ sơ của bạn đã được cập nhật"
  }
}
```

## Client → Server

| Message | Format | Mục đích |
|---------|--------|----------|
| Auth | `{"type": "auth", "token": "..."}` (JSON) | Xác thực (fallback) |
| Ping | `"ping"` (plain text) | Keepalive |

## Role-based Filtering

| Event | Patient | Doctor (assigned) | Admin |
|-------|---------|-------------------|-------|
| `health_metrics` | Chỉ mình | Bệnh nhân được phân công | Tất cả |
| `emergency_alerts` | Chỉ mình | Bệnh nhân được phân công | Tất cả |
| `chat` | Nếu là sender/recipient | Nếu là sender/recipient | Nếu là sender/recipient |
| `appointments` | Nếu là patient | Nếu là doctor | Không |
| `notifications` | Nếu là user đích | Nếu là user đích | Nếu là user đích |

## Reconnection (Client)

Frontend áp dụng exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 5s |
| 2 | 7.5s |
| 3 | 11.25s |
| ... | ×1.5 each, max 30s |
