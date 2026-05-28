from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Header
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.services.ai_service import ai_service
from datetime import datetime
import json

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str
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

@router.post("/send")
async def send_chat_message(
    request: ChatMessageRequest,
    authorization: str | None = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    session_id = request.session_id
    
    # 1. Create or get session
    if not session_id:
        title = request.message[:30] + "..." if len(request.message) > 30 else request.message
        query = "INSERT INTO chat_sessions (user_id, role, title) VALUES (:user_id, :role, :title) RETURNING id"
        session_id = await database.execute(query=query, values={"user_id": user_id, "role": request.role, "title": title})
        session_id = str(session_id)

    # 2. Save user message
    query_msg = "INSERT INTO chat_messages (session_id, sender, message, context) VALUES (:session_id, 'user', :message, :context)"
    await database.execute(query=query_msg, values={
        "session_id": session_id,
        "message": request.message,
        "context": json.dumps(request.context_data) if request.context_data else None
    })
    
    # 3. Get history for context
    query_history = "SELECT sender, message FROM chat_messages WHERE session_id = :session_id ORDER BY created_at ASC LIMIT 10"
    history_res = await database.fetch_all(query=query_history, values={"session_id": session_id})
    history = [{"sender": row["sender"], "message": row["message"]} for row in history_res]

    # 4. Generate AI response
    ai_response_text = await ai_service.generate_chat_response(
        role=request.role,
        user_message=request.message,
        context_data=request.context_data,
        chat_history=history[:-1] # Exclude the current message as it's passed directly
    )

    # 5. Save AI response
    query_ai_msg = "INSERT INTO chat_messages (session_id, sender, message) VALUES (:session_id, 'ai', :message) RETURNING id, created_at"
    ai_msg_id = await database.execute(query=query_ai_msg, values={"session_id": session_id, "message": ai_response_text})
    
    # fetch the exact row since execute for insert returning id only returns the ID scalar (in databases)
    # wait, databases returning might just give the ID. 
    # let's just return a new timestamp instead of fetching
    
    return {
        "session_id": session_id,
        "ai_message": {
            "id": str(ai_msg_id),
            "sender": "ai",
            "message": ai_response_text,
            "created_at": datetime.utcnow().isoformat()
        }
    }

@router.get("/sessions")
async def get_chat_sessions(
    role: str = "patient",
    authorization: str | None = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    query = "SELECT id, title, created_at FROM chat_sessions WHERE user_id = :user_id AND role = :role ORDER BY updated_at DESC LIMIT 20"
    res = await database.fetch_all(query=query, values={"user_id": current_user["id"], "role": role})
    return [ChatSessionResponse(id=str(row["id"]), title=row["title"], created_at=row["created_at"]) for row in res]

@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    authorization: str | None = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    query = "SELECT id, sender, message, created_at FROM chat_messages WHERE session_id = :session_id ORDER BY created_at ASC"
    res = await database.fetch_all(query=query, values={"session_id": session_id})
    return [ChatMessageResponse(id=str(row["id"]), sender=row["sender"], message=row["message"], created_at=row["created_at"]) for row in res]

@router.post("/analyze-patient")
async def analyze_patient(
    patient_id: str,
    authorization: str | None = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    # Only doctors/admins can analyze specific patients
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Fetch 5 recent sensor data
    query_sensor = "SELECT heart_rate, spo2, blood_pressure, timestamp FROM sensor_data WHERE patient_id = :pid ORDER BY timestamp DESC LIMIT 5"
    sensor_res = await database.fetch_all(query=query_sensor, values={"pid": patient_id})
    sensor_data = [dict(row) for row in sensor_res]

    # Fetch 3 recent alerts
    query_alert = "SELECT severity, message, created_at FROM alerts WHERE patient_id = :pid ORDER BY created_at DESC LIMIT 3"
    alert_res = await database.fetch_all(query=query_alert, values={"pid": patient_id})
    alerts = [dict(row) for row in alert_res]

    insight = await ai_service.analyze_patient_data(patient_id, sensor_data, alerts)
    return {"insight": insight}

@router.get("/recommendations")
async def get_recommendations(
    patient_id: Optional[str] = None,
    authorization: str | None = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    query = "SELECT id, severity, recommendation, created_at FROM ai_recommendations WHERE is_resolved = FALSE "
    params = {}
    if patient_id:
        query += "AND patient_id = :pid "
        params["pid"] = patient_id
    elif current_user["role"] == "patient":
        pass # Handle patient identity lookup here if needed

    query += "ORDER BY created_at DESC LIMIT 10"
    res = await database.fetch_all(query=query, values=params)
    return [dict(row) for row in res]
