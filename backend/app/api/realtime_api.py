from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from app.websocket.connection_manager import manager
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter()


@router.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    # Fetch token from query parameters: ws://.../ws/realtime?token=JWT_TOKEN
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        
        if not user_id or not role:
            await websocket.close(code=1008, reason="Invalid token payload")
            return
            
        user_info = {
            "id": user_id,
            "email": email,
            "role": role.strip().lower()
        }
    except JWTError:
        await websocket.close(code=1008, reason="Expired or invalid token")
        return

    # Accept connection and register user details
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
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket connection error for {email}: {e}")
        manager.disconnect(websocket)
