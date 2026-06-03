"""Trình quản lý kết nối WebSocket cho giao tiếp thời gian thực.

Mục đích:
  Quản lý các kết nối WebSocket đang hoạt động được lập chỉ mục theo siêu dữ liệu người dùng
  và cung cấp các phương thức phát sóng nhận biết vai trò cho dữ liệu cảm biến,
  cảnh báo, tin nhắn trò chuyện, cuộc hẹn và thông báo.

Luồng công việc:
  1. Máy khách xác thực và thiết lập WebSocket; thông tin người dùng (id,
     email, vai trò) được lưu trữ cùng với kết nối.
  2. Mỗi phương thức phát sóng tra cứu người nhận chính xác dựa trên loại
     tin nhắn (ví dụ: dữ liệu cảm biến đến bệnh nhân + bác sĩ được chỉ định +
     quản trị viên; trò chuyện đến người gửi + người nhận).
  3. Các kết nối cũ gây ra ngoại lệ được thu thập và loại bỏ.

Quan hệ:
  - app.core.database — tìm nạp chỉ định bác sĩ–bệnh nhân từ
    bảng ``doctor_patient``.
  - FastAPI / Starlette WebSocket — lớp vận chuyển.
"""

import asyncio
import logging
import time

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from app.core.database import database

logger = logging.getLogger(__name__)

_DOCTOR_CACHE_TTL = 60  # 60 seconds
_doctor_cache: dict[str, tuple[list[str], float]] = {}
_doctor_cache_lock = asyncio.Lock()

class ConnectionManager:
    """Duy trì tập hợp các kết nối WebSocket đang hoạt động và điều phối
    các sự kiện thời gian thực đến người nhận được ủy quyền."""

    def __init__(self):
        # Ánh xạ kết nối WebSocket -> dict thông tin người dùng::
        #   {websocket: {"id": str, "email": str, "role": str}}
        self.active_connections: dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, user_info: dict):
        """Đăng ký một WebSocket mới được chấp nhận với thông tin người dùng liên quan.

        Args:
            websocket: Kết nối WebSocket đã được chấp nhận.
            user_info: Dictionary chứa ``id``, ``email`` và ``role``.
        """
        self.active_connections[websocket] = user_info
        logger.info("WebSocket connected: user_id=%s role=%s", user_info.get("id"), user_info.get("role"))

    def disconnect(self, websocket: WebSocket):
        """Loại bỏ một WebSocket khỏi nhóm hoạt động và ghi nhật ký sự kiện.

        Args:
            websocket: Kết nối cần loại bỏ.
        """
        user_info = self.active_connections.pop(websocket, None)
        if user_info:
            logger.info("WebSocket disconnected: user_id=%s role=%s", user_info.get("id"), user_info.get("role"))

    async def get_assigned_doctors(self, patient_id: str) -> list[str]:
        """Tìm nạp ID của các bác sĩ được chỉ định cho bệnh nhân cụ thể (có cache).

        Args:
            patient_id: Chuỗi UUID của bệnh nhân.

        Trả về:
            Danh sách các chuỗi UUID bác sĩ hoặc danh sách rỗng khi có lỗi.
        """
        async with _doctor_cache_lock:
            if patient_id in _doctor_cache:
                doctors, cached_at = _doctor_cache[patient_id]
                if time.monotonic() - cached_at < _DOCTOR_CACHE_TTL:
                    return doctors

        try:
            rows = await database.fetch_all(
                "SELECT doctor_id::text FROM doctor_patient WHERE patient_id = :patient_id::uuid",
                {"patient_id": patient_id}
            )
            doctors = [row["doctor_id"] for row in rows]
            async with _doctor_cache_lock:
                _doctor_cache[patient_id] = (doctors, time.monotonic())
            return doctors
        except Exception as e:
            logger.exception("Error fetching assigned doctors for patient_id=%s", patient_id)
            return []

    async def broadcast_sensor_data(self, patient_id: str, data: dict):
        """Gửi dữ liệu sinh tồn trực tiếp chỉ đến bệnh nhân, bác sĩ được chỉ định và quản trị viên.

        Args:
            patient_id: Bệnh nhân có dữ liệu cảm biến đang được phát sóng.
            data: Dictionary các chỉ số cảm biến.
        """
        assigned_doctors = await self.get_assigned_doctors(patient_id)
        payload = {
            "type": "health_metrics",
            "patient_id": patient_id,
            "data": data
        }

        # Thu thập các kết nối cũ để tránh sửa đổi dict trong khi lặp
        disconnected = []
        for connection, user in list(self.active_connections.items()):
            try:
                role = user["role"]
                uid = user["id"]
                # Chỉ bệnh nhân, bác sĩ được chỉ định hoặc quản trị viên mới nhận được dữ liệu cảm biến
                if role == "admin" or uid == patient_id or uid in assigned_doctors:
                    await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)
        if disconnected:
            logger.warning("Sensor data broadcast: %d stale connections cleaned for patient_id=%s", len(disconnected), patient_id)

    async def broadcast_alert(self, patient_id: str, alert_data: dict):
        """Gửi cảnh báo/SOS đến bệnh nhân, bác sĩ được chỉ định và tất cả quản trị viên.

        Args:
            patient_id: Bệnh nhân kích hoạt cảnh báo.
            alert_data: Dictionary với loại cảnh báo, mức độ nghiêm trọng và tin nhắn.
        """
        assigned_doctors = await self.get_assigned_doctors(patient_id)
        payload = {
            "type": "emergency_alerts",
            "patient_id": patient_id,
            "data": alert_data
        }

        disconnected = []
        for connection, user in list(self.active_connections.items()):
            try:
                role = user["role"]
                uid = user["id"]
                if role == "admin" or uid == patient_id or uid in assigned_doctors:
                    await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)
        if disconnected:
            logger.warning("Alert broadcast: %d stale connections cleaned for patient_id=%s", len(disconnected), patient_id)

    async def broadcast_chat_message(self, sender_id: str, recipient_id: str, message_data: dict):
        """Gửi tin nhắn trò chuyện thời gian thực đến cả người gửi và người nhận.

        Args:
            sender_id: UUID của người dùng đã gửi tin nhắn.
            recipient_id: UUID của người nhận dự kiến.
            message_data: Dictionary với nội dung trò chuyện và siêu dữ liệu.
        """
        payload = {
            "type": "chat",
            "data": message_data
        }

        disconnected = []
        for connection, user in list(self.active_connections.items()):
            try:
                uid = user["id"]
                if uid == sender_id or uid == recipient_id:
                    await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_appointment(self, patient_id: str, doctor_id: str, appointment_data: dict):
        """Gửi cập nhật cuộc hẹn thời gian thực đến bệnh nhân và bác sĩ.

        Args:
            patient_id: UUID của bệnh nhân liên quan.
            doctor_id: UUID của bác sĩ liên quan.
            appointment_data: Dictionary với chi tiết cuộc hẹn.
        """
        payload = {
            "type": "appointments",
            "data": appointment_data
        }

        disconnected = []
        for connection, user in list(self.active_connections.items()):
            try:
                uid = user["id"]
                if uid == patient_id or uid == doctor_id:
                    await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_notification(self, user_id: str, notification_data: dict):
        """Gửi thông báo trực tiếp đến người dùng mục tiêu.

        Args:
            user_id: UUID của người dùng cần thông báo.
            notification_data: Dictionary với tiêu đề thông báo, tin nhắn, v.v.
        """
        payload = {
            "type": "notifications",
            "data": notification_data
        }

        disconnected = []
        for connection, user in list(self.active_connections.items()):
            try:
                uid = user["id"]
                if uid == user_id:
                    await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast(self, data: dict):
        """Gửi một tải trọng chung đến mọi máy khách được kết nối.

        Đây là phương pháp kế thừa; ưu tiên sử dụng các phương pháp phát sóng
        theo loại cụ thể để kiểm soát truy cập phù hợp.

        Args:
            data: Dictionary tải trọng để chuyển tiếp đến tất cả máy khách.
        """
        disconnected = []
        for connection in list(self.active_connections.keys()):
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()
