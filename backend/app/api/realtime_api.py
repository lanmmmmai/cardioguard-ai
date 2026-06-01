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
    print(f"[WS Debug] New WebSocket handshake initiated. Subprotocols: {protocols_header}")
    
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
        print("[WS Debug] Connection closed: Missing authentication token.")
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            print("[WS Debug] Connection closed: Invalid token payload (missing sub).")
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
            print(f"[WS Debug] Connection closed: User with ID {user_id} not found in database.")
            await websocket.close(code=1008, reason="User not found")
            return
        if (user_row["status"] or "").strip().lower() == "inactive":
            print(f"[WS Debug] Connection closed: Account for User {user_row['email']} is inactive.")
            await websocket.close(code=1008, reason="Account inactive")
            return

        email = user_row["email"]
        role = (user_row["role"] or "").strip().lower()
        if role not in {"admin", "doctor", "patient"}:
            print(f"[WS Debug] Connection closed: User {email} has invalid role: {role}.")
            await websocket.close(code=1008, reason="Invalid user role")
            return

        user_info = {
            "id": user_id,
            "email": email,
            "role": role
        }
    except JWTError as je:
        print(f"[WS Debug] Connection closed: Expired or invalid JWT token. Error: {je}")
        await websocket.close(code=1008, reason="Expired or invalid token")
        return

    print(f"[WS Debug] WebSocket successfully authenticated & opened: User {email} (Role: {role})")
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
                print(f"[WS Debug] Received ping from {email}")
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    except WebSocketDisconnect:
        print(f"[WS Debug] WebSocket disconnected gracefully for User {email}")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS Debug] WebSocket connection error for {email}: {e}")
        manager.disconnect(websocket)
