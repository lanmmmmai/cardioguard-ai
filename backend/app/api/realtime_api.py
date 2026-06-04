"""API WebSocket Thời gian thực.

Mục đích:
    Cung cấp điểm cuối WebSocket an toàn (/ws/realtime) cho giao tiếp
    thời gian thực giữa máy chủ và máy khách (bệnh nhân, bác sĩ,
    admin). Hỗ trợ xác thực qua tiêu đề sub-protocol hoặc
    gửi token JSON trong tin nhắn đầu tiên.

Luồng xử lý:
    Khi kết nối, máy chủ trích xuất JWT từ tiêu đề Sec-WebSocket-Protocol
    (định dạng: cardioguard.jwt.<token>) hoặc đợi tin nhắn xác thực JSON
    đầu tiên. Nó xác thực token, xác minh người dùng tồn tại và đang hoạt động,
    sau đó đăng ký kết nối với ConnectionManager. Kết nối
    duy trì mở cho giao tiếp hai chiều (hiện tại chỉ là ping/pong
    giữ kết nối). Ngắt kết nối được dọn dẹp tự động.

Quan hệ:
    - Phụ thuộc vào: websocket.connection_manager để quản lý kết nối
    - Phụ thuộc vào: core.security để xác thực JWT
    - Phụ thuộc vào: core.database để xác thực người dùng
    - Được sử dụng bởi: Tất cả các tính năng thời gian thực (cảnh báo, dữ liệu cảm biến, trò chuyện, v.v.)
"""

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
    """Trích xuất JWT từ tiêu đề Sec-WebSocket-Protocol.

    Tìm kiếm mục nhập giao thức khớp với định dạng
    "cardioguard.jwt.<token>".

    Args:
        protocols_header: Giá trị tiêu đề Sec-WebSocket-Protocol thô.

    Returns:
        Tuple gồm (token, selected_subprotocol) hoặc (None, None) nếu không tìm thấy.
    """
    for proto in [p.strip() for p in protocols_header.split(",") if p.strip()]:
        if proto.startswith("cardioguard.jwt."):
            return proto[len("cardioguard.jwt.") :], proto
    return None, None


async def _receive_auth_token(websocket: WebSocket, timeout_seconds: float = 8.0) -> str | None:
    """Đợi token xác thực được gửi dưới dạng tin nhắn WebSocket đầu tiên.

    Mong đợi một tin nhắn JSON với {"type": "auth", "token": "<jwt>"}.
    Hết thời gian sau timeout_seconds nếu không nhận được tin nhắn.

    Args:
        websocket: Kết nối WebSocket.
        timeout_seconds: Số giây tối đa để đợi tin nhắn xác thực.

    Returns:
        Chuỗi token hoặc None nếu không nhận được trong thời gian chờ.
    """
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
    """Điểm cuối WebSocket cho giao tiếp thời gian thực.

    Luồng xác thực:
    1. Thử trích xuất JWT từ tiêu đề Sec-WebSocket-Protocol.
    2. Nếu không có, đợi tin nhắn xác thực JSON (thời gian chờ 8s).
    3. Xác thực JWT, xác minh người dùng tồn tại và đang hoạt động.
    4. Đăng ký kết nối với ConnectionManager.
    Duy trì kết nối cho ping/pong giữ kết nối cho đến khi ngắt.

    Args:
        websocket: Phiên bản kết nối WebSocket.
    """
    token = None
    protocols_header = websocket.headers.get("sec-websocket-protocol", "")
    token, selected_subprotocol = _extract_protocol_token(protocols_header)

    await websocket.accept(subprotocol=selected_subprotocol)

    if not token:
        token = await _receive_auth_token(websocket)

    if not token:
        logger.warning("WS bị từ chối: thiếu token xác thực")
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        jti = payload.get("jti")

        if jti:
            revoked = await database.fetch_val("SELECT 1 FROM revoked_tokens WHERE jti = :jti", {"jti": jti})
            if revoked:
                logger.warning("WS bị từ chối: token đã bị thu hồi (revoked)")
                await websocket.close(code=1008, reason="Token has been revoked")
                return

        if not user_id:
            logger.warning("WS bị từ chối: payload token thiếu chủ thể")
            await websocket.close(code=1008, reason="Invalid token payload")
            return

        user_row = await database.fetch_one(
            """
            SELECT email, role, status
            FROM users
            WHERE id = CAST(:user_id AS uuid)
            """,
            {"user_id": user_id},
        )
        if not user_row:
            logger.warning("WS bị từ chối: không tìm thấy người dùng cho phiên websocket")
            await websocket.close(code=1008, reason="User not found")
            return
        if (user_row["status"] or "").strip().lower() == "inactive":
            logger.warning("WS bị từ chối: tài khoản không hoạt động cho phiên websocket")
            await websocket.close(code=1008, reason="Account inactive")
            return

        email = user_row["email"]
        role = (user_row["role"] or "").strip().lower()
        if role not in {"admin", "doctor", "patient"}:
            logger.warning("WS bị từ chối: vai trò không hợp lệ cho phiên websocket")
            await websocket.close(code=1008, reason="Invalid user role")
            return

        user_info = {
            "id": user_id,
            "email": email,
            "role": role
        }
    except JWTError as je:
        logger.warning("WS bị từ chối: token không hợp lệ hoặc hết hạn")
        await websocket.close(code=1008, reason="Expired or invalid token")
        return

    logger.info("WS đã kết nối: user_id=%s role=%s", user_id, role)
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
        logger.info("WS đã ngắt kết nối: user_id=%s role=%s", user_id, role)
        manager.disconnect(websocket)
    except Exception as e:
        logger.exception("Lỗi WS cho user_id=%s role=%s", user_id, role)
        manager.disconnect(websocket)
