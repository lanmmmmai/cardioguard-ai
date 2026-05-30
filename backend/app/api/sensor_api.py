from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from app.schemas.sensor_schema import SensorDataCreate
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.ai.heart_ai import detect_abnormal
from app.websocket.connection_manager import manager

router = APIRouter()


def to_jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def row_to_dict(row: Any) -> dict[str, Any]:
    return {key: to_jsonable(row[key]) for key in row.keys()}


async def ensure_patient_access(user: dict[str, Any], patient_id: str) -> None:
    role = user["role"]
    if role == "admin":
        return
    if role == "patient":
        if patient_id != user["id"]:
            raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập dữ liệu bệnh nhân khác")
        return
    if role == "doctor":
        assigned = await database.fetch_one(
            """
            SELECT 1
            FROM doctor_patient
            WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id
            """,
            {"doctor_id": user["id"], "patient_id": patient_id},
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Bác sĩ chưa được phân công quản lý bệnh nhân này")
        return
    raise HTTPException(status_code=403, detail="Vai trò không hợp lệ")


@router.post("/sensor-data")
async def create_sensor_data(data: SensorDataCreate, authorization: str | None = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    await ensure_patient_access(current_user, data.patient_id)

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
async def get_sensor_data(
    authorization: str | None = Header(default=None),
    patient_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    current_user = await get_user_from_token(authorization)
    where_parts = []
    values: dict[str, Any] = {"limit": limit, "offset": offset}

    if current_user["role"] == "patient":
        where_parts.append("patient_id::text = :current_user_id")
        values["current_user_id"] = current_user["id"]
    elif current_user["role"] == "doctor":
        where_parts.append(
            """
            EXISTS (
                SELECT 1 FROM doctor_patient dp
                WHERE dp.doctor_id::text = :current_user_id
                AND dp.patient_id::text = sensor_data.patient_id::text
            )
            """
        )
        values["current_user_id"] = current_user["id"]

    if patient_id:
        await ensure_patient_access(current_user, patient_id)
        where_parts.append("patient_id::text = :patient_id")
        values["patient_id"] = patient_id

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    query = """
    SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
    FROM sensor_data
    {where_sql}
    ORDER BY created_at DESC
    LIMIT :limit OFFSET :offset
    """

    data = await database.fetch_all(query.format(where_sql=where_sql), values)

    return [row_to_dict(row) for row in data]


@router.get("/api/sensors/history")
async def get_sensor_history(
    authorization: str | None = Header(default=None),
    patient_id: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    items = await get_sensor_data(
        authorization=authorization,
        patient_id=patient_id,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "limit": limit, "offset": offset}
