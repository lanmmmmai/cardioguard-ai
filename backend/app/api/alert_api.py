from fastapi import APIRouter
from app.core.database import database

router = APIRouter()


@router.get("/alerts")
async def get_alerts():
    query = """
    SELECT 
        alerts.id,
        alerts.patient_id,
        patients.full_name,
        alerts.alert_type,
        alerts.message,
        alerts.severity,
        alerts.is_resolved,
        alerts.created_at
    FROM alerts
    JOIN patients ON alerts.patient_id = patients.id
    ORDER BY alerts.created_at DESC
    """

    alerts = await database.fetch_all(query)

    return alerts