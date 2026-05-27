from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.connection_manager import manager

router = APIRouter()


@router.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_json({
        "type": "connected",
        "message": "CardioGuard AI realtime socket connected",
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
