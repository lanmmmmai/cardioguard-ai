from fastapi import APIRouter, Header
from app.core.database import database
from app.api.auth_api import get_user_from_token

router = APIRouter()


@router.get("/alerts")
async def get_alerts(authorization: str | None = Header(default=None)):
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
    """

    alerts = await database.fetch_all(query, values)

    return alerts
