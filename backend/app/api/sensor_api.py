from fastapi import APIRouter
from app.schemas.sensor_schema import SensorDataCreate
from app.core.database import database
from app.ai.heart_ai import detect_abnormal
from app.websocket.connection_manager import manager

router = APIRouter()


@router.post("/sensor-data")
async def create_sensor_data(data: SensorDataCreate):

    insert_sensor_query = """
    INSERT INTO sensor_data(
        patient_id,
        heart_rate,
        spo2,
        systolic_bp,
        diastolic_bp,
        ecg_value
    )
    VALUES (
        :patient_id,
        :heart_rate,
        :spo2,
        :systolic_bp,
        :diastolic_bp,
        :ecg_value
    )
    """

    await database.execute(
        query=insert_sensor_query,
        values={
            "patient_id": data.patient_id,
            "heart_rate": data.heart_rate,
            "spo2": data.spo2,
            "systolic_bp": data.systolic_bp,
            "diastolic_bp": data.diastolic_bp,
            "ecg_value": data.ecg_value
        }
    )

    alerts = detect_abnormal(data)

    for alert in alerts:
        insert_alert_query = """
        INSERT INTO alerts(
            patient_id,
            alert_type,
            message,
            severity
        )
        VALUES (
            :patient_id,
            :alert_type,
            :message,
            :severity
        )
        """

        await database.execute(
            query=insert_alert_query,
            values={
                "patient_id": data.patient_id,
                "alert_type": alert["alert_type"],
                "message": alert["message"],
                "severity": alert["severity"]
            }
        )
    broadcast_data = {
        "patient_id": str(data.patient_id),
        "heart_rate": data.heart_rate,
        "spo2": data.spo2,
        "systolic_bp": data.systolic_bp,
        "diastolic_bp": data.diastolic_bp,
        "ecg_value": data.ecg_value,
        "is_abnormal": len(alerts) > 0,
        "alerts": alerts
    }
    await manager.broadcast_sensor_data(str(data.patient_id), broadcast_data)
    
    from datetime import datetime, timezone
    for alert in alerts:
        await manager.broadcast_alert(str(data.patient_id), {
            "patient_id": str(data.patient_id),
            "alert_type": alert["alert_type"],
            "message": alert["message"],
            "severity": alert["severity"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    return {
        "message": "Sensor data saved successfully",
        "is_abnormal": len(alerts) > 0,
        "alerts": alerts
    }


@router.get("/sensor-data")
async def get_sensor_data():

    query = """
    SELECT * FROM sensor_data
    ORDER BY created_at DESC
    """

    data = await database.fetch_all(query)

    return data