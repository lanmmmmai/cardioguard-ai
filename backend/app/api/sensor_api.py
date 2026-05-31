from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from app.schemas.sensor_schema import IotTelemetryPayload, SensorDataCreate
from app.core.database import database
from app.core.config import settings
from app.api.auth_api import get_user_from_token
from app.ai.heart_ai import detect_abnormal
from app.websocket.connection_manager import manager

router = APIRouter()


def normalize_device_identifier(value: str) -> str:
    return value.strip().lower().replace(":", "").replace("-", "")


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


async def ensure_device_access(user: dict[str, Any], device_uid: str) -> dict[str, Any]:
    device_key = normalize_device_identifier(device_uid)
    device_row = await database.fetch_one(
        """
        SELECT
            id::text AS id,
            patient_id::text AS patient_id,
            name,
            status,
            battery,
            last_seen_at,
            device_type,
            updated_at
        FROM devices
        WHERE lower(replace(replace(name, ':', ''), '-', '')) = :device_key
           OR lower(name) = :device_uid_lower
        LIMIT 1
        """,
        {"device_key": device_key, "device_uid_lower": device_uid.lower()},
    )
    if not device_row:
        raise HTTPException(status_code=404, detail="Device not found")

    patient_id = device_row["patient_id"]
    if not patient_id:
        raise HTTPException(status_code=404, detail="Device does not have assigned patient")

    await ensure_patient_access(user, patient_id)
    return device_row


def detect_abnormal_iot(readings: Any) -> list[dict[str, str]]:
    data = type(
        "TelemetryForAI",
        (),
        {
            "heart_rate": readings.heart_rate,
            "spo2": readings.spo2,
            "systolic_bp": readings.systolic_bp if readings.systolic_bp is not None else 0,
            "diastolic_bp": readings.diastolic_bp if readings.diastolic_bp is not None else 0,
            "ecg_value": readings.ecg_value,
        },
    )()
    alerts = detect_abnormal(data)
    if readings.systolic_bp is None or readings.diastolic_bp is None:
        alerts = [a for a in alerts if a["alert_type"] != "HIGH_BLOOD_PRESSURE"]
    return alerts


@router.post("/sensor-data")
async def create_sensor_data(data: SensorDataCreate, authorization: Optional[str] = Header(default=None)):
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


@router.post("/iot/telemetry")
async def create_iot_telemetry(
    data: IotTelemetryPayload,
    x_device_uid: str = Header(..., alias="X-Device-Uid"),
    x_device_mac: str = Header(..., alias="X-Device-Mac"),
    x_device_token: str = Header(..., alias="X-Device-Token"),
):
    shared_token = settings.IOT_DEVICE_SHARED_TOKEN.strip()
    if not shared_token:
        raise HTTPException(status_code=503, detail="IOT token is not configured")
    if x_device_token != shared_token:
        raise HTTPException(status_code=401, detail="Invalid device token")

    device_key = normalize_device_identifier(x_device_mac)
    if len(device_key) != 12:
        raise HTTPException(status_code=400, detail="Invalid device MAC address")

    device_row = await database.fetch_one(
        """
        SELECT id::text AS id, patient_id::text AS patient_id, status
        FROM devices
        WHERE lower(replace(replace(name, ':', ''), '-', '')) = :device_key
        LIMIT 1
        """,
        {"device_key": device_key},
    )
    if not device_row:
        raise HTTPException(status_code=404, detail="Device not paired")

    device_status = (device_row["status"] or "").lower()
    if device_status in {"revoked", "inactive", "blocked"}:
        raise HTTPException(status_code=403, detail="Device is not allowed to send telemetry")

    patient_id = device_row["patient_id"]
    if not patient_id:
        raise HTTPException(status_code=404, detail="Device does not have assigned patient")

    await database.execute(
        """
        UPDATE devices
        SET status = :status,
            battery = COALESCE(:battery, battery),
            last_seen_at = :last_seen_at,
            updated_at = :updated_at
        WHERE id::text = :device_id
        """,
        {
            "status": "online",
            "battery": data.device.battery if data.device else None,
            "last_seen_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "device_id": device_row["id"],
        },
    )

    await database.execute(
        """
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
        """,
        {
            "patient_id": patient_id,
            "heart_rate": data.readings.heart_rate,
            "spo2": data.readings.spo2,
            "systolic_bp": data.readings.systolic_bp,
            "diastolic_bp": data.readings.diastolic_bp,
            "ecg_value": data.readings.ecg_value,
        },
    )

    alerts = detect_abnormal_iot(data.readings)

    for alert in alerts:
        await database.execute(
            """
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
            """,
            {
                "patient_id": patient_id,
                "alert_type": alert["alert_type"],
                "message": alert["message"],
                "severity": alert["severity"],
            },
        )

    broadcast_data = {
        "patient_id": patient_id,
        "heart_rate": data.readings.heart_rate,
        "spo2": data.readings.spo2,
        "systolic_bp": data.readings.systolic_bp,
        "diastolic_bp": data.readings.diastolic_bp,
        "ecg_value": data.readings.ecg_value,
        "is_abnormal": len(alerts) > 0,
        "alerts": alerts,
    }
    await manager.broadcast_sensor_data(patient_id, broadcast_data)

    for alert in alerts:
        await manager.broadcast_alert(
            patient_id,
            {
                "patient_id": patient_id,
                "alert_type": alert["alert_type"],
                "message": alert["message"],
                "severity": alert["severity"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    return {
        "message": "Telemetry accepted",
        "patient_id": patient_id,
        "device_uid": x_device_uid,
        "device_mac": x_device_mac,
        "is_abnormal": len(alerts) > 0,
        "alerts": alerts,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/iot/devices/{device_uid}/status")
async def get_iot_device_status(device_uid: str, authorization: Optional[str] = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    device_row = await ensure_device_access(current_user, device_uid)
    return {
        "device_uid": device_uid,
        "device_id": device_row["id"],
        "patient_id": device_row["patient_id"],
        "status": device_row["status"],
        "battery": device_row["battery"],
        "last_seen_at": to_jsonable(device_row["last_seen_at"]),
        "device_type": device_row["device_type"],
        "updated_at": to_jsonable(device_row["updated_at"]),
    }


@router.get("/sensor-data")
async def get_sensor_data(
    authorization: Optional[str] = Header(default=None),
    patient_id: Optional[str] = Query(default=None),
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
    authorization: Optional[str] = Header(default=None),
    patient_id: Optional[str] = Query(default=None),
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
