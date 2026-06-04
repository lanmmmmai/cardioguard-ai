"""API Trò chuyện AI và Phân tích Bệnh nhân.

Mục đích:
    Cung cấp chức năng trò chuyện được hỗ trợ bởi AI cho bệnh nhân và bác sĩ,
    cùng với phân tích dữ liệu sức khỏe bệnh nhân. Quản lý các phiên trò chuyện,
    lịch sử tin nhắn và các khuyến nghị sức khỏe do AI tạo ra.

Luồng xử lý:
    Tin nhắn được gửi qua POST /send, tạo hoặc tái sử dụng một phiên,
    lưu trữ tin nhắn người dùng, truy xuất lịch sử gần đây, gọi dịch vụ AI
    để tạo phản hồi, lưu lại và trả về cả hai. Bác sĩ/admin
    có thể phân tích dữ liệu cảm biến và cảnh báo gần đây của một bệnh nhân cụ thể qua
    POST /analyze-patient. Các khuyến nghị được tìm nạp từ cơ sở dữ liệu
    với phạm vi dựa trên vai trò.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Phụ thuộc vào: services.ai_service để tạo phản hồi AI
    - Phụ thuộc vào: core.database để lưu trữ phiên/tin nhắn
    - Bảng: chat_sessions, chatbot_messages, ai_recommendations
"""

import logging
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.services.ai_service import ai_service
from datetime import datetime, timezone
import json

logger = logging.getLogger(__name__)
router = APIRouter()
VALID_CHAT_ROLES = {"patient", "doctor"}
CHAT_SESSIONS_TABLE = "chat_sessions"
CHAT_MESSAGES_TABLE = "chatbot_messages"


def chat_table_name(table: str) -> str:
    """Xác thực tên bảng trò chuyện nội bộ trước khi nội suy vào SQL."""
    if table not in {CHAT_SESSIONS_TABLE, CHAT_MESSAGES_TABLE}:
        raise RuntimeError(f"Unexpected chat table: {table}")
    return table


def to_utc_isoformat(value: datetime) -> str:
    """Chuẩn hóa datetime DB sang ISO UTC an toàn."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()

class ChatMessageRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    session_id: Optional[str] = None
    role: str = "patient"
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
    """Xác thực và chuẩn hóa chuỗi vai trò trò chuyện.

    Args:
        role: Chuỗi vai trò thô (ví dụ: 'Patient', 'DOCTOR').

    Returns:
        Vai trò đã được chuẩn hóa thành chữ thường.

    Raises:
        HTTPException 422: Nếu vai trò không phải 'patient' hoặc 'doctor'.
    """
    normalized = role.strip().lower()
    if normalized not in VALID_CHAT_ROLES:
        raise HTTPException(status_code=422, detail="Role must be patient or doctor")
    return normalized


def enforce_chat_role(current_user: dict[str, Any], chat_role: str) -> None:
    """Đảm bảo người dùng có thể mượn vai trò trò chuyện đã yêu cầu.

    Admin có thể sử dụng bất kỳ vai trò nào; người dùng khác phải khớp
    chính xác chat_role để ngăn chặn giả mạo vai trò.

    Args:
        current_user: Dict người dùng đã xác thực.
        chat_role: Vai trò trò chuyện được yêu cầu ('patient' hoặc 'doctor').

    Raises:
        HTTPException 403: Nếu vai trò người dùng không khớp với vai trò trò chuyện.
    """
    if current_user["role"] == "admin":
        return
    if current_user["role"] != chat_role:
        raise HTTPException(status_code=403, detail="Bạn không có quyền dùng chatbot với vai trò này")


async def ensure_session_owner(session_id: str, user_id: str, role: Optional[str] = None) -> None:
    """Xác minh rằng một phiên trò chuyện thuộc về người dùng đã cho.

    Args:
        session_id: UUID của phiên trò chuyện.
        user_id: UUID của người dùng xác nhận quyền sở hữu.
        role: Bộ lọc vai trò tùy chọn cho phiên.

    Raises:
        HTTPException 404: Nếu phiên không thuộc về người dùng.
    """
    query = f"""
    SELECT 1
    FROM {chat_table_name(CHAT_SESSIONS_TABLE)}
    WHERE id = CAST(:session_id AS uuid) AND user_id = CAST(:user_id AS uuid)
    """
    values = {"session_id": session_id, "user_id": user_id}
    if role:
        query += " AND role = :role"
        values["role"] = role
    row = await database.fetch_one(query=query, values=values)
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")


async def ensure_doctor_patient_access(doctor_id: str, patient_id: str) -> None:
    """Xác minh rằng một bác sĩ được phân công cho một bệnh nhân cụ thể.

    Args:
        doctor_id: UUID của bác sĩ.
        patient_id: UUID của bệnh nhân.

    Raises:
        HTTPException 403: Nếu bác sĩ không được phân công cho bệnh nhân.
    """
    assigned = await database.fetch_one(
        """
        SELECT 1
        FROM doctor_patient
        WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)
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
    """Gửi một tin nhắn trò chuyện và nhận phản hồi do AI tạo ra.

    Tạo phiên mới nếu session_id là None. Lưu tin nhắn người dùng,
    tìm nạp lịch sử gần đây (10 tin nhắn cuối được đảo ngược theo thứ tự thời gian),
    gọi dịch vụ AI và lưu trữ phản hồi của AI.

    Args:
        request: ChatMessageRequest với nội dung tin nhắn, session_id tùy chọn,
            role và context_data.
        authorization: Token Bearer.

    Returns:
        Dict chứa session_id và ai_message (id, sender, message, created_at).
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    session_id = request.session_id
    chat_role = normalize_chat_role(request.role)
    enforce_chat_role(current_user, chat_role)
    
    logger.info("Tin nhắn trò chuyện: user_id=%s role=%s session=%s message_len=%d", user_id, chat_role, session_id or "new", len(request.message))

    # Bước 1: Tạo hoặc lấy phiên
    if not session_id:
        title = request.message[:30] + "..." if len(request.message) > 30 else request.message
        row = await database.fetch_one(
            query=f"INSERT INTO {chat_table_name(CHAT_SESSIONS_TABLE)} (user_id, role, title) VALUES (:user_id, :role, :title) RETURNING id",
            values={"user_id": user_id, "role": chat_role, "title": title},
        )
        if not row:
            raise HTTPException(status_code=500, detail="Unable to create chat session")
        session_id = str(row["id"])
    else:
        await ensure_session_owner(session_id, user_id, chat_role)

    # Bước 2: Lưu tin nhắn người dùng + update session timestamp (batch)
    async with database.transaction():
        query_msg = f"INSERT INTO {chat_table_name(CHAT_MESSAGES_TABLE)} (session_id, sender, message, context) VALUES (:session_id, 'user', :message, :context)"
        await database.execute(query=query_msg, values={
            "session_id": session_id,
            "message": request.message,
            "context": json.dumps(request.context_data) if request.context_data else None
        })
        await database.execute(
            f"UPDATE {chat_table_name(CHAT_SESSIONS_TABLE)} SET updated_at = NOW() WHERE id = CAST(:session_id AS uuid)",
            {"session_id": session_id},
        )
    
    # Bước 3: Lấy lịch sử để làm ngữ cảnh (lấy 10 tin nhắn mới nhất và đảo ngược về thứ tự ASC)
    query_history = f"SELECT sender, message FROM {chat_table_name(CHAT_MESSAGES_TABLE)} WHERE session_id = CAST(:session_id AS uuid) ORDER BY created_at DESC LIMIT 10"
    history_res = await database.fetch_all(query=query_history, values={"session_id": session_id})
    history = [{"sender": row["sender"], "message": row["message"]} for row in reversed(history_res)]

    # Bước 4: Tạo phản hồi AI
    ai_response_text = await ai_service.generate_chat_response(
        role=chat_role,
        user_message=request.message,
        context_data=request.context_data,
        chat_history=history[:-1]
    )

    # Bước 5: Lưu phản hồi AI + update session timestamp (batch)
    async with database.transaction():
        query_ai_msg = f"INSERT INTO {chat_table_name(CHAT_MESSAGES_TABLE)} (session_id, sender, message) VALUES (:session_id, 'ai', :message) RETURNING id, created_at"
        ai_message_row = await database.fetch_one(query=query_ai_msg, values={"session_id": session_id, "message": ai_response_text})
        await database.execute(
            f"UPDATE {chat_table_name(CHAT_SESSIONS_TABLE)} SET updated_at = NOW() WHERE id = CAST(:session_id AS uuid)",
            {"session_id": session_id},
        )
    if not ai_message_row:
        raise HTTPException(status_code=500, detail="Unable to persist AI response")
    
    return {
        "session_id": session_id,
        "ai_message": {
            "id": str(ai_message_row["id"]),
            "sender": "ai",
            "message": ai_response_text,
            "created_at": to_utc_isoformat(ai_message_row["created_at"]),
        }
    }

@router.get("/sessions")
async def get_chat_sessions(
    role: str = "patient",
    authorization: Optional[str] = Header(default=None)
):
    """Liệt kê các phiên trò chuyện của người dùng đã xác thực (20 phiên gần nhất).

    Args:
        role: Bộ lọc vai trò trò chuyện ('patient' hoặc 'doctor').
        authorization: Token Bearer.

    Returns:
        Danh sách các đối tượng ChatSessionResponse.
    """
    current_user = await get_user_from_token(authorization)
    role = normalize_chat_role(role)
    enforce_chat_role(current_user, role)
    query = f"SELECT id, title, created_at FROM {chat_table_name(CHAT_SESSIONS_TABLE)} WHERE user_id = :user_id AND role = :role ORDER BY updated_at DESC LIMIT 20"
    res = await database.fetch_all(query=query, values={"user_id": current_user["id"], "role": role})
    return [ChatSessionResponse(id=str(row["id"]), title=row["title"], created_at=row["created_at"]) for row in res]

@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    authorization: Optional[str] = Header(default=None)
):
    """Lấy toàn bộ lịch sử tin nhắn cho một phiên trò chuyện.

    Các tin nhắn được trả về theo thứ tự thời gian (cũ nhất trước).

    Args:
        session_id: UUID của phiên trò chuyện.
        authorization: Token Bearer.

    Returns:
        Danh sách các đối tượng ChatMessageResponse.
    """
    current_user = await get_user_from_token(authorization)
    await ensure_session_owner(session_id, current_user["id"])
    query = f"""
    SELECT id, sender, message, created_at
    FROM {chat_table_name(CHAT_MESSAGES_TABLE)}
    WHERE session_id = CAST(:session_id AS uuid)
    ORDER BY created_at ASC
    """
    res = await database.fetch_all(query=query, values={"session_id": session_id})
    return [ChatMessageResponse(id=str(row["id"]), sender=row["sender"], message=row["message"], created_at=row["created_at"]) for row in res]

@router.post("/analyze-patient")
async def analyze_patient(
    patient_id: str,
    authorization: Optional[str] = Header(default=None)
):
    """Phân tích dữ liệu sức khỏe gần đây của bệnh nhân và tạo thông tin chi tiết.

    Lấy 5 lần đọc cảm biến gần nhất và 3 cảnh báo gần nhất cho bệnh nhân,
    sau đó gọi dịch vụ AI để phân tích toàn diện. Bác sĩ
    phải được phân công cho bệnh nhân; admin có thể phân tích bất kỳ bệnh nhân nào.

    Args:
        patient_id: UUID của bệnh nhân cần phân tích.
        authorization: Token Bearer.

    Returns:
        Dict chứa chuỗi thông tin chi tiết do AI tạo ra.

    Raises:
        HTTPException 403: Nếu người dùng không phải bác sĩ/admin hoặc không được phân công.
    """
    current_user = await get_user_from_token(authorization)
    # Chỉ bác sĩ/admin mới có thể phân tích bệnh nhân cụ thể
    if current_user["role"] not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user["role"] == "doctor":
        await ensure_doctor_patient_access(current_user["id"], patient_id)

    # Lấy 5 dữ liệu cảm biến gần đây
    query_sensor = """
    SELECT heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
    FROM sensor_data
    WHERE patient_id = CAST(:pid AS uuid)
    ORDER BY created_at DESC
    LIMIT 5
    """
    sensor_res = await database.fetch_all(query=query_sensor, values={"pid": patient_id})
    sensor_data = [dict(row) for row in sensor_res]

    # Lấy 3 cảnh báo gần đây
    query_alert = "SELECT severity, message, created_at FROM alerts WHERE patient_id = CAST(:pid AS uuid) ORDER BY created_at DESC LIMIT 3"
    alert_res = await database.fetch_all(query=query_alert, values={"pid": patient_id})
    alerts = [dict(row) for row in alert_res]

    insight = await ai_service.analyze_patient_data(patient_id, sensor_data, alerts)
    logger.info("Bệnh nhân đã được phân tích: doctor_id=%s patient_id=%s", current_user["id"], patient_id)
    return {"insight": insight}

@router.get("/recommendations")
async def get_recommendations(
    patient_id: Optional[str] = None,
    authorization: Optional[str] = Header(default=None)
):
    """Lấy các khuyến nghị AI chưa được giải quyết, theo phạm vi vai trò người dùng.

    Bệnh nhân thấy các khuyến nghị của chính họ. Bác sĩ thấy các khuyến nghị
    cho bệnh nhân được phân công của họ (tùy chọn lọc theo patient_id).
    Admin có thể xem tất cả hoặc lọc theo patient_id.

    Args:
        patient_id: UUID bệnh nhân tùy chọn để lọc.
        authorization: Token Bearer.

    Returns:
        Danh sách các bản ghi khuyến nghị chưa được giải quyết.
    """
    current_user = await get_user_from_token(authorization)
    query = "SELECT id, severity, recommendation, created_at FROM ai_recommendations WHERE is_resolved = FALSE "
    params = {}
    if current_user["role"] == "patient":
        if patient_id and patient_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem gợi ý của bệnh nhân khác")
        query += "AND patient_id = CAST(:pid AS uuid) "
        params["pid"] = current_user["id"]
    elif current_user["role"] == "doctor":
        if patient_id:
            await ensure_doctor_patient_access(current_user["id"], patient_id)
            query += "AND patient_id = CAST(:pid AS uuid) "
            params["pid"] = patient_id
        else:
            query += """
            AND EXISTS (
                SELECT 1 FROM doctor_patient dp
                WHERE dp.doctor_id = CAST(:doctor_id AS uuid)
                AND dp.patient_id = ai_recommendations.patient_id
            )
            """
            params["doctor_id"] = current_user["id"]
    elif patient_id:
        query += "AND patient_id = CAST(:pid AS uuid) "
        params["pid"] = patient_id

    query += "ORDER BY created_at DESC LIMIT 10"
    res = await database.fetch_all(query=query, values=params)
    return [dict(row) for row in res]
