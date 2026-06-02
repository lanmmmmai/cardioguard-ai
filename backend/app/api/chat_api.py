from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.services.ai_service import ai_service
from datetime import datetime, timezone
import json

router = APIRouter()
VALID_CHAT_ROLES = {"patient", "doctor"}
CHAT_SESSIONS_TABLE = "chat_sessions"
CHAT_MESSAGES_TABLE = "chatbot_messages"

class ChatMessageRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    session_id: Optional[str] = None
    role: str = "patient" # 'patient' or 'doctor'
    context_data: Optional[Dict[str, Any]] = None

class ChatSessionResponse(BaseModel):
    id: str
    title: Optional[str]
    created_at: datetime

class ChatMessageResponse(BaseModel):
    id: str
    sender: str
    message: str
    created_at: datetime


def normalize_chat_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in VALID_CHAT_ROLES:
        raise HTTPException(status_code=422, detail="Role must be patient or doctor")
    return normalized


def enforce_chat_role(current_user: dict[str, Any], chat_role: str) -> None:
    if current_user["role"] == "admin":
        return
    if current_user["role"] != chat_role:
        raise HTTPException(status_code=403, detail="Bạn không có quyền dùng chatbot với vai trò này")


async def ensure_session_owner(session_id: str, user_id: str, role: Optional[str] = None) -> None:
    query = f"""
    SELECT 1
    FROM {CHAT_SESSIONS_TABLE}
    WHERE id::text = :session_id AND user_id::text = :user_id
    """
    values = {"session_id": session_id, "user_id": user_id}
    if role:
        query += " AND role = :role"
        values["role"] = role
    row = await database.fetch_one(query=query, values=values)
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")


async def ensure_doctor_patient_access(doctor_id: str, patient_id: str) -> None:
    assigned = await database.fetch_one(
        """
        SELECT 1
        FROM doctor_patient
        WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id
        """,
        {"doctor_id": doctor_id, "patient_id": patient_id},
    )
    if not assigned:
        raise HTTPException(status_code=403, detail="Bác sĩ chưa được phân công quản lý bệnh nhân này")


@router.post("/send")
async def send_chat_message(
    request: ChatMessageRequest,
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    session_id = request.session_id
    chat_role = normalize_chat_role(request.role)
    enforce_chat_role(current_user, chat_role)
    
    # 1. Create or get session
    if not session_id:
        title = request.message[:30] + "..." if len(request.message) > 30 else request.message
        query = f"INSERT INTO {CHAT_SESSIONS_TABLE} (user_id, role, title) VALUES (:user_id, :role, :title) RETURNING id"
        session_id = await database.execute(query=query, values={"user_id": user_id, "role": chat_role, "title": title})
        session_id = str(session_id)
    else:
        await ensure_session_owner(session_id, user_id, chat_role)

    # 2. Save user message
    query_msg = f"INSERT INTO {CHAT_MESSAGES_TABLE} (session_id, sender, message, context) VALUES (:session_id, 'user', :message, :context)"
    await database.execute(query=query_msg, values={
        "session_id": session_id,
        "message": request.message,
        "context": json.dumps(request.context_data) if request.context_data else None
    })
    await database.execute(
        f"UPDATE {CHAT_SESSIONS_TABLE} SET updated_at = NOW() WHERE id::text = :session_id",
        {"session_id": session_id},
    )
    
    # 3. Get history for context (Lấy 10 tin nhắn mới nhất và đảo ngược về thứ tự ASC)
    query_history = f"SELECT sender, message FROM {CHAT_MESSAGES_TABLE} WHERE session_id::text = :session_id ORDER BY created_at DESC LIMIT 10"
    history_res = await database.fetch_all(query=query_history, values={"session_id": session_id})
    history = [{"sender": row["sender"], "message": row["message"]} for row in reversed(history_res)]

    # 4. Generate AI response
    ai_response_text = await ai_service.generate_chat_response(
        role=chat_role,
        user_message=request.message,
        context_data=request.context_data,
        chat_history=history[:-1] # Exclude the current message as it's passed directly
    )

    # 5. Save AI response
    query_ai_msg = f"INSERT INTO {CHAT_MESSAGES_TABLE} (session_id, sender, message) VALUES (:session_id, 'ai', :message) RETURNING id, created_at"
    ai_msg_id = await database.execute(query=query_ai_msg, values={"session_id": session_id, "message": ai_response_text})
    await database.execute(
        f"UPDATE {CHAT_SESSIONS_TABLE} SET updated_at = NOW() WHERE id::text = :session_id",
        {"session_id": session_id},
    )
    
    # fetch the exact row since execute for insert returning id only returns the ID scalar (in databases)
    # wait, databases returning might just give the ID. 
    # let's just return a new timestamp instead of fetching
    
    return {
        "session_id": session_id,
        "ai_message": {
            "id": str(ai_msg_id),
            "sender": "ai",
            "message": ai_response_text,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    }

@router.get("/sessions")
async def get_chat_sessions(
    role: str = "patient",
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    role = normalize_chat_role(role)
    enforce_chat_role(current_user, role)
    query = f"SELECT id, title, created_at FROM {CHAT_SESSIONS_TABLE} WHERE user_id = :user_id AND role = :role ORDER BY updated_at DESC LIMIT 20"
    res = await database.fetch_all(query=query, values={"user_id": current_user["id"], "role": role})
    return [ChatSessionResponse(id=str(row["id"]), title=row["title"], created_at=row["created_at"]) for row in res]

@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    await ensure_session_owner(session_id, current_user["id"])
    query = f"""
    SELECT id, sender, message, created_at
    FROM {CHAT_MESSAGES_TABLE}
    WHERE session_id::text = :session_id
    ORDER BY created_at ASC
    """
    res = await database.fetch_all(query=query, values={"session_id": session_id})
    return [ChatMessageResponse(id=str(row["id"]), sender=row["sender"], message=row["message"], created_at=row["created_at"]) for row in res]

@router.post("/analyze-patient")
async def analyze_patient(
    patient_id: str,
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    # Only doctors/admins can analyze specific patients
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user["role"] == "doctor":
        await ensure_doctor_patient_access(current_user["id"], patient_id)

    # Fetch 5 recent sensor data
    query_sensor = """
    SELECT heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
    FROM sensor_data
    WHERE patient_id::text = :pid
    ORDER BY created_at DESC
    LIMIT 5
    """
    sensor_res = await database.fetch_all(query=query_sensor, values={"pid": patient_id})
    sensor_data = [dict(row) for row in sensor_res]

    # Fetch 3 recent alerts
    query_alert = "SELECT severity, message, created_at FROM alerts WHERE patient_id::text = :pid ORDER BY created_at DESC LIMIT 3"
    alert_res = await database.fetch_all(query=query_alert, values={"pid": patient_id})
    alerts = [dict(row) for row in alert_res]

    insight = await ai_service.analyze_patient_data(patient_id, sensor_data, alerts)
    return {"insight": insight}

@router.get("/recommendations")
async def get_recommendations(
    patient_id: Optional[str] = None,
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    query = "SELECT id, severity, recommendation, created_at FROM ai_recommendations WHERE is_resolved = FALSE "
    params = {}
    if current_user["role"] == "patient":
        if patient_id and patient_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem gợi ý của bệnh nhân khác")
        query += "AND patient_id::text = :pid "
        params["pid"] = current_user["id"]
    elif current_user["role"] == "doctor":
        if patient_id:
            await ensure_doctor_patient_access(current_user["id"], patient_id)
            query += "AND patient_id::text = :pid "
            params["pid"] = patient_id
        else:
            query += """
            AND EXISTS (
                SELECT 1 FROM doctor_patient dp
                WHERE dp.doctor_id::text = :doctor_id
                AND dp.patient_id::text = ai_recommendations.patient_id::text
            )
            """
            params["doctor_id"] = current_user["id"]
    elif patient_id:
        query += "AND patient_id::text = :pid "
        params["pid"] = patient_id

    query += "ORDER BY created_at DESC LIMIT 10"
    res = await database.fetch_all(query=query, values=params)
    return [dict(row) for row in res]
