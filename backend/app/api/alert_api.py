"""API Quản lý Cảnh báo.

Mục đích:
    Xử lý việc tạo, truy xuất và giải quyết các cảnh báo y tế / sự kiện
    nghiêm trọng. Hỗ trợ cảnh báo SOS từ bệnh nhân, truy vấn cảnh báo dựa
    trên vai trò và thống kê 7 ngày.

Luồng xử lý:
    Truy vấn cảnh báo được phân chia theo vai trò: bệnh nhân chỉ thấy cảnh
    báo của mình, bác sĩ thấy cảnh báo của bệnh nhân được phân công, admin
    thấy tất cả. Endpoint SOS tạo cảnh báo mức độ nghiêm trọng. Tất cả các
    thay đổi cảnh báo đều được phát qua WebSocket để cập nhật thời gian thực.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Phụ thuộc vào: core.database để truy cập DB
    - Phụ thuộc vào: websocket.connection_manager để phát sóng thời gian thực
    - Tích hợp với: sensor_api để phát hiện cảnh báo bất thường tự động
"""

import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Header
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.api.crud_api import to_jsonable
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/alerts")
async def get_alerts(
    limit: int = 100,
    offset: int = 0,
    authorization: Optional[str] = Header(default=None)
):
    """Truy xuất cảnh báo với phạm vi truy cập dựa trên vai trò.

    Bệnh nhân chỉ thấy cảnh báo của mình. Bác sĩ thấy cảnh báo cho bệnh nhân
    được phân công cho họ. Admin thấy tất cả cảnh báo. Kết quả được sắp xếp
    theo thời gian tạo giảm dần.

    Args:
        limit: Số lượng cảnh báo tối đa trả về (giới hạn 1-500).
        offset: Số lượng cảnh báo bỏ qua để phân trang.
        authorization: Token Bearer.

    Returns:
        Danh sách bản ghi cảnh báo kèm tên bệnh nhân.
    """
    current_user = await get_user_from_token(authorization, allow_uncompleted=True)
    role = current_user["role"]
    where_sql = ""
    values = {}

    if role == "patient":
        where_sql = "WHERE alerts.patient_id = CAST(:user_id AS uuid)"
        values["user_id"] = current_user["id"]
    elif role == "doctor":
        where_sql = """
        WHERE EXISTS (
            SELECT 1 FROM doctor_patient dp
            WHERE dp.doctor_id = CAST(:user_id AS uuid)
            AND dp.patient_id = alerts.patient_id
        )
        """
        values["user_id"] = current_user["id"]

    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    count_query = f"SELECT COUNT(*)::int AS total FROM alerts {where_sql}"
    total = await database.fetch_val(count_query, values)

    query = f"""
    SELECT 
        alerts.id,
        alerts.patient_id::text as patient_id,
        users.full_name,
        alerts.alert_type,
        alerts.message,
        alerts.severity,
        alerts.is_resolved,
        alerts.created_at
    FROM alerts
    JOIN users ON alerts.patient_id::text = users.id::text AND lower(users.role) = 'patient'
    {where_sql}
    ORDER BY alerts.created_at DESC
    LIMIT :limit OFFSET :offset
    """

    values["limit"] = limit
    values["offset"] = offset

    alerts = await database.fetch_all(query, values)
    logger.info("Đã tìm nạp cảnh báo: role=%s user_id=%s count=%d", role, current_user["id"], len(alerts))

    return {"items": alerts, "total": total, "limit": limit, "offset": offset}


@router.get("/alerts/stats/last-7-days")
async def get_alert_stats_last_7_days(
    authorization: Optional[str] = Header(default=None),
):
    """Lấy số lượng cảnh báo hàng ngày trong 7 ngày qua.

    Sử dụng generate_series để đảm bảo mỗi ngày đều có mục nhập (kể cả số không).
    Dữ liệu được phân chia theo vai trò người dùng tương tự GET /alerts.

    Args:
        authorization: Token Bearer.

    Returns:
        Danh sách {"label": "DD/MM", "count": int} cho mỗi ngày trong 7 ngày qua.
    """
    current_user = await get_user_from_token(authorization, allow_uncompleted=True)
    role = current_user["role"]
    where_sql = ""
    values = {}

    if role == "patient":
        where_sql = "WHERE alerts.patient_id = CAST(:user_id AS uuid)"
        values["user_id"] = current_user["id"]
    elif role == "doctor":
        where_sql = """
        WHERE EXISTS (
            SELECT 1 FROM doctor_patient dp
            WHERE dp.doctor_id = CAST(:user_id AS uuid)
              AND dp.patient_id = alerts.patient_id
        )
        """
        values["user_id"] = current_user["id"]

    query = f"""
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now()) - interval '6 day',
        date_trunc('day', now()),
        interval '1 day'
      )::date AS day
    ),
    scoped AS (
      SELECT date_trunc('day', alerts.created_at)::date AS day
      FROM alerts
      {where_sql}
    )
    SELECT
      to_char(days.day, 'DD/MM') AS label,
      COALESCE(COUNT(scoped.day), 0)::int AS count
    FROM days
    LEFT JOIN scoped ON scoped.day = days.day
    GROUP BY days.day
    ORDER BY days.day ASC
    """
    rows = await database.fetch_all(query, values)
    return [{"label": row["label"], "count": row["count"]} for row in rows]


from fastapi import HTTPException

@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, authorization: Optional[str] = Header(default=None)):
    """Đánh dấu một cảnh báo là đã được xử lý.

    Xác thực rằng người yêu cầu có quyền: bệnh nhân có thể xử lý cảnh báo
    của chính mình; bác sĩ có thể xử lý cảnh báo cho bệnh nhân được phân công.
    Sau khi xử lý, phát sóng cảnh báo đã cập nhật qua WebSocket.

    Args:
        alert_id: UUID của cảnh báo cần xử lý.
        authorization: Token Bearer.

    Returns:
        Tin nhắn xác nhận kèm ID cảnh báo.

    Raises:
        HTTPException 404: Nếu không tìm thấy cảnh báo.
        HTTPException 403: Nếu người dùng thiếu quyền.
    """
    current_user = await get_user_from_token(authorization, allow_uncompleted=True)
    role = current_user["role"]
    
    # Xác minh cảnh báo tồn tại
    alert = await database.fetch_one(
        "SELECT patient_id::text FROM alerts WHERE id = CAST(:alert_id AS uuid)",
        {"alert_id": alert_id}
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    patient_id = alert["patient_id"]
    if role == "patient" and patient_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xử lý cảnh báo của bệnh nhân khác")
    elif role == "doctor":
        assigned = await database.fetch_one(
            "SELECT 1 FROM doctor_patient WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)",
            {"doctor_id": current_user["id"], "patient_id": patient_id}
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Bác sĩ chưa được phân công quản lý bệnh nhân này")

    await database.execute(
        "UPDATE alerts SET is_resolved = TRUE WHERE id = CAST(:alert_id AS uuid)",
        {"alert_id": alert_id}
    )
    logger.info("Cảnh báo đã được xử lý: alert_id=%s resolved_by=%s role=%s", alert_id, current_user["id"], role)
    
    # Lấy cảnh báo đã cập nhật đầy đủ để phát sóng
    updated_alert = await database.fetch_one(
        """
        SELECT 
            alerts.id,
            alerts.patient_id::text as patient_id,
            users.full_name,
            alerts.alert_type,
            alerts.message,
            alerts.severity,
            alerts.is_resolved,
            alerts.created_at
        FROM alerts
        JOIN users ON alerts.patient_id::text = users.id::text AND lower(users.role) = 'patient'
        WHERE alerts.id = CAST(:alert_id AS uuid)
        """,
        {"alert_id": alert_id}
    )
    
    alert_dict = {key: updated_alert[key] for key in updated_alert.keys()}
    alert_dict = to_jsonable(alert_dict)
    await manager.broadcast_alert(patient_id, alert_dict)
    
    # Gửi thông báo tới bệnh nhân
    from app.services import notification_service
    await notification_service.notify_patient(
        patient_id=patient_id,
        title="Cảnh báo đã được xử lý",
        message=f"Cảnh báo '{alert_dict.get('message')}' của bạn đã được xác nhận xử lý thành công.",
        type="alert_resolved",
        category="health",
        severity="success",
        actor_id=current_user["id"],
        source_table="alerts",
        source_id=alert_id,
        action_url="/patient/health"
    )
    
    return {"message": "Cảnh báo đã được xác nhận xử lý thành công", "alert_id": alert_id}


from pydantic import BaseModel

class AlertCreate(BaseModel):
    message: str = "Yêu cầu hỗ trợ khẩn cấp (SOS)"

@router.post("/alerts")
async def create_sos_alert(payload: AlertCreate, authorization: Optional[str] = Header(default=None)):
    """Tạo cảnh báo SOS (yêu cầu khẩn cấp chỉ dành cho bệnh nhân).

    Tạo UUID, chèn cảnh báo mức độ nghiêm trọng, và phát sóng
    theo thời gian thực qua WebSocket đến bác sĩ được phân công của bệnh nhân.

    Args:
        payload: Tin nhắn cảnh báo (mặc định là yêu cầu khẩn cấp).
        authorization: Token Bearer.

    Returns:
        Đối tượng cảnh báo đầy đủ vừa được tạo.

    Raises:
        HTTPException 403: Nếu người gọi không phải là bệnh nhân.
    """
    current_user = await get_user_from_token(authorization, allow_uncompleted=True)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có thể gửi cảnh báo SOS")
        
    alert_id = str(uuid.uuid4())
    insert_query = """
    INSERT INTO alerts (id, patient_id, alert_type, message, severity, is_resolved)
    VALUES (:id, :patient_id, :alert_type, :message, :severity, FALSE)
    """
    
    await database.execute(
        insert_query,
        {
            "id": alert_id,
            "patient_id": current_user["id"],
            "alert_type": "SOS",
            "message": payload.message,
            "severity": "critical"
        }
    )
    logger.warning("Cảnh báo SOS đã được tạo: alert_id=%s patient_id=%s message=%s", alert_id, current_user["id"], payload.message)
    
    updated_alert = await database.fetch_one(
        """
        SELECT 
            alerts.id,
            alerts.patient_id::text as patient_id,
            users.full_name,
            alerts.alert_type,
            alerts.message,
            alerts.severity,
            alerts.is_resolved,
            alerts.created_at
        FROM alerts
        JOIN users ON alerts.patient_id::text = users.id::text AND lower(users.role) = 'patient'
        WHERE alerts.id = CAST(:alert_id AS uuid)
        """,
        {"alert_id": alert_id}
    )
    
    alert_dict = {key: updated_alert[key] for key in updated_alert.keys()}
    alert_dict = to_jsonable(alert_dict)
    await manager.broadcast_alert(current_user["id"], alert_dict)
    
    # Gửi thông báo
    from app.services import notification_service
    patient_name = alert_dict.get("full_name") or "Bệnh nhân"
    # 1. Xác nhận cho bệnh nhân
    await notification_service.notify_patient(
        patient_id=current_user["id"],
        title="Yêu cầu khẩn cấp SOS đã gửi",
        message="Yêu cầu hỗ trợ khẩn cấp (SOS) của bạn đã được gửi thành công. Bác sĩ và hệ thống đã được báo động.",
        type="sos_sent",
        category="health",
        severity="critical",
        actor_id=current_user["id"],
        source_table="alerts",
        source_id=alert_id,
        action_url="/patient/sos"
    )
    # 2. Báo động bác sĩ phụ trách
    await notification_service.notify_assigned_doctors(
        patient_id=current_user["id"],
        title="CẢNH BÁO SOS KHẨN CẤP",
        message=f"Bệnh nhân {patient_name} đã kích hoạt yêu cầu SOS khẩn cấp: '{payload.message}'",
        type="sos_triggered",
        category="health",
        severity="critical",
        actor_id=current_user["id"],
        source_table="alerts",
        source_id=alert_id,
        action_url="/doctor/alerts"
    )
    # 3. Báo động admin
    await notification_service.notify_admins(
        title="CẢNH BÁO SOS TOÀN HỆ THỐNG",
        message=f"Bệnh nhân {patient_name} đã kích hoạt SOS: '{payload.message}'",
        type="sos_triggered",
        category="health",
        severity="critical",
        patient_id=current_user["id"],
        actor_id=current_user["id"],
        source_table="alerts",
        source_id=alert_id,
        action_url="/admin/alerts"
    )
    
    return alert_dict
