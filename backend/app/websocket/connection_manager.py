import logging

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from app.core.database import database

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps WebSocket connection to user info dictionary: {websocket: {"id": str, "email": str, "role": str}}
        self.active_connections: dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, user_info: dict):
        self.active_connections[websocket] = user_info
        logger.info("WebSocket connected: user_id=%s role=%s", user_info.get("id"), user_info.get("role"))

    def disconnect(self, websocket: WebSocket):
        user_info = self.active_connections.pop(websocket, None)
        if user_info:
            logger.info("WebSocket disconnected: user_id=%s role=%s", user_info.get("id"), user_info.get("role"))

    async def get_assigned_doctors(self, patient_id: str) -> list[str]:
        """Fetch IDs of doctors assigned to the given patient."""
        try:
            rows = await database.fetch_all(
                "SELECT doctor_id::text FROM doctor_patient WHERE patient_id::text = :patient_id",
                {"patient_id": patient_id}
            )
            return [row["doctor_id"] for row in rows]
        except Exception as e:
            logger.exception("Error fetching assigned doctors for patient_id=%s", patient_id)
            return []

    async def broadcast_sensor_data(self, patient_id: str, data: dict):
        """Send live vitals only to the patient, their assigned doctors, and admins."""
        assigned_doctors = await self.get_assigned_doctors(patient_id)
        payload = {
            "type": "health_metrics",
            "patient_id": patient_id,
            "data": data
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

    async def broadcast_alert(self, patient_id: str, alert_data: dict):
        """Send warning/SOS alerts to the patient, assigned doctors, and all admins."""
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

    async def broadcast_chat_message(self, sender_id: str, recipient_id: str, message_data: dict):
        """Send a real-time chat message to both the sender and recipient."""
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
        """Send real-time appointment updates to the patient and doctor."""
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
        """Send notification directly to the target user."""
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
        """Legacy broadcast method to send events to all connected clients."""
        disconnected = []
        for connection in list(self.active_connections.keys()):
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)
                
        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()
