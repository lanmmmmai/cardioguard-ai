from datetime import datetime, timezone
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from app.websocket.connection_manager import manager
from app.core.security import SECRET_KEY, ALGORITHM
from app.core.database import database

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_protocol_token(protocols_header: str) -> tuple[str | None, str | None]:
    for proto in [p.strip() for p in protocols_header.split(",") if p.strip()]:
        if proto.startswith("cardioguard.jwt."):
            return proto[len("cardioguard.jwt.") :], proto
    return None, None


async def _receive_auth_token(websocket: WebSocket, timeout_seconds: float = 8.0) -> str | None:
    try:
        first_message = await asyncio.wait_for(websocket.receive_text(), timeout=timeout_seconds)
    except Exception:
        return None

    try:
        payload = json.loads(first_message)
    except json.JSONDecodeError:
        return None

    if payload.get("type") != "auth":
        return None

    token = payload.get("token")
    return token if isinstance(token, str) and token.strip() else None


@router.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    token = None
    protocols_header = websocket.headers.get("sec-websocket-protocol", "")
    token, selected_subprotocol = _extract_protocol_token(protocols_header)

    await websocket.accept(subprotocol=selected_subprotocol)

    if not token:
        token = await _receive_auth_token(websocket)

    if not token:
        logger.warning("WS rejected: missing authentication token")
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            logger.warning("WS rejected: token payload missing subject")
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
            logger.warning("WS rejected: user not found for websocket session")
            await websocket.close(code=1008, reason="User not found")
            return
        if (user_row["status"] or "").strip().lower() == "inactive":
            logger.warning("WS rejected: inactive account for websocket session")
            await websocket.close(code=1008, reason="Account inactive")
            return

        email = user_row["email"]
        role = (user_row["role"] or "").strip().lower()
        if role not in {"admin", "doctor", "patient"}:
            logger.warning("WS rejected: invalid role for websocket session")
            await websocket.close(code=1008, reason="Invalid user role")
            return

        user_info = {
            "id": user_id,
            "email": email,
            "role": role
        }
    except JWTError as je:
        logger.warning("WS rejected: token invalid or expired")
        await websocket.close(code=1008, reason="Expired or invalid token")
        return

    logger.info("WS connected: user_id=%s role=%s", user_id, role)
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
        logger.info("WS disconnected: user_id=%s role=%s", user_id, role)
        manager.disconnect(websocket)
    except Exception as e:
        logger.exception("WS error for user_id=%s role=%s", user_id, role)
        manager.disconnect(websocket)
