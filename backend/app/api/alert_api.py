from fastapi import APIRouter
from app.core.database import database

router = APIRouter()


@router.get("/alerts")
async def get_alerts():
    query = """
    SELECT 
        alerts.id,
        alerts.patient_id,
        users.full_name,
        alerts.alert_type,
        alerts.message,
        alerts.severity,
        alerts.is_resolved,
        alerts.created_at
    FROM alerts
    JOIN users ON alerts.patient_id::text = users.id::text AND lower(users.role) = 'patient'
    ORDER BY alerts.created_at DESC
    """

    alerts = await database.fetch_all(query)

    return alerts
