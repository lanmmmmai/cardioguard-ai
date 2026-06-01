from datetime import datetime, timezone
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from app.websocket.connection_manager import manager
from app.core.security import SECRET_KEY, ALGORITHM
from app.core.database import database

router = APIRouter()


@router.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    token = None
    selected_subprotocol = None
    protocols_header = websocket.headers.get("sec-websocket-protocol", "")
    print("🔌 [WS Handshake] Đang yêu cầu kết nối từ thiết bị...")
    print(f"   └─ Subprotocols: {protocols_header}")
    
    for proto in [p.strip() for p in protocols_header.split(",") if p.strip()]:
        if proto.startswith("cardioguard.jwt."):
            token = proto[len("cardioguard.jwt.") :]
            selected_subprotocol = proto
            break

    await websocket.accept(subprotocol=selected_subprotocol)

    # Backward compatibility fallback for older clients.
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        try:
            first_message = await asyncio.wait_for(websocket.receive_text(), timeout=8)
            payload = json.loads(first_message)
            if payload.get("type") == "auth":
                token = payload.get("token")
        except Exception:
            token = None

    if not token:
        print("🔴 [WS Rejected] Kết nối bị từ chối: Thiếu mã xác thực (Token)!")
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            print("🔴 [WS Rejected] Kết nối bị từ chối: Token không có user ID (sub)!")
            await websocket.close(code=1008, reason="Invalid token payload")
            return

        user_row = await database.fetch_one(
            """
            SELECT email, role, status
            FROM users
            WHERE id::text = :user_id
            """,
            {"user_id": user_id},
        )
        if not user_row:
            print(f"🔴 [WS Rejected] Kết nối bị từ chối: Không tìm thấy User ID {user_id} trong database!")
            await websocket.close(code=1008, reason="User not found")
            return
        if (user_row["status"] or "").strip().lower() == "inactive":
            print(f"🔴 [WS Rejected] Kết nối bị từ chối: Tài khoản {user_row['email']} đang bị khóa!")
            await websocket.close(code=1008, reason="Account inactive")
            return

        email = user_row["email"]
        role = (user_row["role"] or "").strip().lower()
        if role not in {"admin", "doctor", "patient"}:
            print(f"🔴 [WS Rejected] Kết nối bị từ chối: Tài khoản {email} có vai trò không hợp lệ: {role}!")
            await websocket.close(code=1008, reason="Invalid user role")
            return

        user_info = {
            "id": user_id,
            "email": email,
            "role": role
        }
    except JWTError as je:
        print(f"🔴 [WS Rejected] Kết nối bị từ chối: Token hết hạn hoặc không hợp lệ! (Lỗi: {je})")
        await websocket.close(code=1008, reason="Expired or invalid token")
        return

    print("🟢 [WS Connected] Thiết bị đã kết nối và xác thực thành công!")
    print(f"   ├─ Người dùng : {email}")
    print(f"   ├─ Vai trò    : {role.upper()}")
    print(f"   └─ ID Người Dùng: {user_id}")
    await manager.connect(websocket, user_info)
    
    await websocket.send_json({
        "type": "connected",
        "message": f"CardioGuard AI realtime socket connected for {email}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                print(f"⚡ [WS Heartbeat] Nhận tín hiệu giữ kết nối (ping) từ {email}")
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    except WebSocketDisconnect:
        print(f"❌ [WS Disconnected] Kết nối đóng chủ động từ phía người dùng: {email}")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"⚠️ [WS Error] Lỗi kết nối đột ngột cho {email}: {e}")
        manager.disconnect(websocket)
