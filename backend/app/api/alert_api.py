from typing import Optional
from fastapi import APIRouter, Header
from app.core.database import database
from app.api.auth_api import get_user_from_token

router = APIRouter()


@router.get("/alerts")
async def get_alerts(
    limit: int = 100,
    offset: int = 0,
    authorization: Optional[str] = Header(default=None)
):
    current_user = await get_user_from_token(authorization)
    role = current_user["role"]
    where_sql = ""
    values = {}

    if role == "patient":
        where_sql = "WHERE alerts.patient_id::text = :user_id"
        values["user_id"] = current_user["id"]
    elif role == "doctor":
        where_sql = """
        WHERE EXISTS (
            SELECT 1 FROM doctor_patient dp
            WHERE dp.doctor_id::text = :user_id
            AND dp.patient_id::text = alerts.patient_id::text
        )
        """
        values["user_id"] = current_user["id"]

    limit = max(1, min(limit, 500))
    offset = max(0, offset)

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

    return alerts


@router.get("/alerts/stats/last-7-days")
async def get_alert_stats_last_7_days(
    authorization: Optional[str] = Header(default=None),
):
    current_user = await get_user_from_token(authorization)
    role = current_user["role"]
    where_sql = ""
    values = {}

    if role == "patient":
        where_sql = "WHERE alerts.patient_id::text = :user_id"
        values["user_id"] = current_user["id"]
    elif role == "doctor":
        where_sql = """
        WHERE EXISTS (
            SELECT 1 FROM doctor_patient dp
            WHERE dp.doctor_id::text = :user_id
              AND dp.patient_id::text = alerts.patient_id::text
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
    current_user = await get_user_from_token(authorization)
    role = current_user["role"]
    
    # Verify alert exists
    alert = await database.fetch_one(
        "SELECT patient_id::text FROM alerts WHERE id::text = :alert_id",
        {"alert_id": alert_id}
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    patient_id = alert["patient_id"]
    if role == "patient" and patient_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xử lý cảnh báo của bệnh nhân khác")
    elif role == "doctor":
        assigned = await database.fetch_one(
            "SELECT 1 FROM doctor_patient WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id",
            {"doctor_id": current_user["id"], "patient_id": patient_id}
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Bác sĩ chưa được phân công quản lý bệnh nhân này")

    # Update is_resolved
    await database.execute(
        "UPDATE alerts SET is_resolved = TRUE WHERE id::text = :alert_id",
        {"alert_id": alert_id}
    )
    
    # Fetch complete updated alert to broadcast
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
        WHERE alerts.id::text = :alert_id
        """,
        {"alert_id": alert_id}
    )
    
    alert_dict = {key: updated_alert[key] for key in updated_alert.keys()}
    from app.api.crud_api import to_jsonable
    alert_dict = to_jsonable(alert_dict)
    
    from app.websocket.connection_manager import manager
    await manager.broadcast_alert(patient_id, alert_dict)
    
    return {"message": "Cảnh báo đã được xác nhận xử lý thành công", "alert_id": alert_id}


from pydantic import BaseModel

class AlertCreate(BaseModel):
    message: str = "Yêu cầu hỗ trợ khẩn cấp (SOS)"

@router.post("/alerts")
async def create_sos_alert(payload: AlertCreate, authorization: Optional[str] = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có thể gửi cảnh báo SOS")
        
    import uuid
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
        WHERE alerts.id::text = :alert_id
        """,
        {"alert_id": alert_id}
    )
    
    alert_dict = {key: updated_alert[key] for key in updated_alert.keys()}
    from app.api.crud_api import to_jsonable
    alert_dict = to_jsonable(alert_dict)
    
    from app.websocket.connection_manager import manager
    await manager.broadcast_alert(current_user["id"], alert_dict)
    
    return alert_dict
