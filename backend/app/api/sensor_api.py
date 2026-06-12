"""API Dữ liệu Cảm biến và Đo xa IoT.

Mục đích:
    Xử lý việc tiếp nhận dữ liệu cảm biến y tế từ hai nguồn:
    (1) Nhập thủ công bởi người dùng đã xác thực (bệnh nhân/bác sĩ/admin) qua
    POST /sensor-data và (2) đo xa thiết bị IoT qua POST /iot/telemetry
    với xác thực cấp thiết bị. Cả hai đường dẫn đều bao gồm phát hiện
    giá trị bất thường qua AI và phát sóng WebSocket thời gian thực.

Luồng xử lý:
    Dữ liệu cảm biến thủ công: người dùng đã xác thực gửi chỉ số → lưu vào
    sensor_data → detect_abnormal() kiểm tra dấu hiệu sinh tồn → cảnh báo được tạo
    nếu bất thường → kết quả được phát sóng qua WebSocket.
    Đo xa IoT: thiết bị xác thực qua MAC và token → trạng thái thiết bị
    được cập nhật thành online → chỉ số được lưu → cùng luồng phát hiện bất thường
    và phát sóng. Tất cả các thay đổi đều được ghi nhật ký kiểm toán.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực (đường dẫn thủ công)
    - Phụ thuộc vào: ai.heart_ai.detect_abnormal để phát hiện bất thường
    - Phụ thuộc vào: websocket.connection_manager để phát sóng thời gian thực
    - Phụ thuộc vào: services.audit_service để ghi nhật ký hoạt động
    - Phụ thuộc vào: core.rate_limit để giới hạn tốc độ IoT
    - Bảng: sensor_data, alerts, devices
"""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
import asyncio
import logging
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from app.schemas.sensor_schema import IotTelemetryPayload, SensorDataCreate, DeviceClaim, DeviceUnclaim
from app.core.database import database
from app.core.config import settings
from app.api.auth_api import get_user_from_token
from app.ai.heart_ai import detect_abnormal
from app.core.security import hash_password, verify_password
from app.websocket.connection_manager import manager
from app.services.audit_service import log_activity
from app.api.crud_api import to_jsonable
import secrets

router = APIRouter()
logger = logging.getLogger(__name__)

_DEVICES_COLUMN_CACHE_TTL = 3600  # 1 hour
_devices_columns_cache: Optional[tuple[set[str], float]] = None
_devices_columns_lock = asyncio.Lock()


def patient_display_name(row: Any) -> str:
    """Extract a safe patient display name from an optional database row.

    Args:
        row: Database row or dict-like object that may contain ``full_name``.

    Returns:
        Patient display name when available; otherwise a generic Vietnamese label.
    """
    if not row:
        return "Bệnh nhân"
    try:
        full_name = row["full_name"] if "full_name" in row else None
    except (KeyError, TypeError):
        full_name = None
    return str(full_name) if full_name else "Bệnh nhân"


def normalize_device_identifier(value: str) -> str:
    """Chuẩn hóa định danh thiết bị bằng cách loại bỏ dấu phân cách và chuyển sang chữ thường.

    Args:
        value: Định danh thiết bị thô (ví dụ: địa chỉ MAC có dấu hai chấm).

    Returns:
        Chuỗi chữ thường đã chuẩn hóa, không có dấu phân cách.
    """
    return value.strip().lower().replace(":", "").replace("-", "")


def to_jsonable(value: Any) -> Any:
    """Chuyển đổi các kiểu không thể tuần tự hóa thành giá trị an toàn JSON.

    Args:
        value: Bất kỳ giá trị Python nào.

    Returns:
        Chuỗi định dạng ISO cho ngày tháng, float cho Decimal hoặc chính giá trị đó.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def row_to_dict(row: Any) -> dict[str, Any]:
    """Chuyển đổi một hàng cơ sở dữ liệu thành dict an toàn JSON.

    Args:
        row: Đối tượng hàng cơ sở dữ liệu.

    Returns:
        Dict với tất cả giá trị được truyền qua to_jsonable.
    """
    return {key: to_jsonable(row[key]) for key in row.keys()}


async def get_devices_table_columns() -> set[str]:
    """Lấy tập hợp tên cột cho bảng devices, có bộ nhớ đệm với TTL.

    Returns:
        Tập hợp các chuỗi tên cột.
    """
    global _devices_columns_cache
    async with _devices_columns_lock:
        if _devices_columns_cache is not None:
            columns, cached_at = _devices_columns_cache
            if time.monotonic() - cached_at < _DEVICES_COLUMN_CACHE_TTL:
                return columns

    rows = await database.fetch_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices'
        """
    )
    columns = {row["column_name"] for row in rows}
    async with _devices_columns_lock:
        _devices_columns_cache = (columns, time.monotonic())
    return columns
async def ensure_patient_access(user: dict[str, Any], patient_id: str) -> None:
    """Xác minh rằng người dùng có quyền truy cập dữ liệu của bệnh nhân.

    Admin có thể truy cập tất cả bệnh nhân. Bệnh nhân chỉ có thể truy cập
    dữ liệu của chính họ. Bác sĩ chỉ có thể truy cập bệnh nhân được phân công.

    Args:
        user: Dict người dùng đã xác thực.
        patient_id: UUID của bệnh nhân cần truy cập.

    Raises:
        HTTPException 403: Nếu người dùng không có quyền truy cập.
    """
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
            WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)
            """,
            {"doctor_id": user["id"], "patient_id": patient_id},
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Bác sĩ chưa được phân công quản lý bệnh nhân này")
        return
    raise HTTPException(status_code=403, detail="Vai trò không hợp lệ")


async def ensure_device_access(user: dict[str, Any], device_uid: str) -> dict[str, Any]:
    """Tra cứu thiết bị theo UID và xác minh người dùng có quyền truy cập.

    Khớp thiết bị theo MAC hoặc tên đã chuẩn hóa. Xác thực quyền truy cập
    bệnh nhân nếu thiết bị được gán cho một bệnh nhân.

    Args:
        user: Dict người dùng đã xác thực.
        device_uid: Chuỗi UID thiết bị (MAC hoặc tên).

    Returns:
        Dict hàng thiết bị.

    Raises:
        HTTPException 404: Nếu không tìm thấy thiết bị hoặc không có bệnh nhân.
        HTTPException 403: Nếu người dùng thiếu quyền truy cập.
    """
    columns = await get_devices_table_columns()
    device_key = normalize_device_identifier(device_uid)
    uses_device_mac = "device_mac" in columns

    if uses_device_mac:
        if "device_name" in columns:
            query = """
                SELECT * FROM devices
                WHERE lower(replace(replace(device_mac, ':', ''), '-', '')) = :device_key
                   OR lower(device_name) = :device_uid_lower
                LIMIT 1
            """
        else:
            query = """
                SELECT * FROM devices
                WHERE lower(replace(replace(device_mac, ':', ''), '-', '')) = :device_key
                   OR lower(name) = :device_uid_lower
                LIMIT 1
            """
    else:
        if "device_name" in columns:
            query = """
                SELECT * FROM devices
                WHERE lower(replace(replace(device_name, ':', ''), '-', '')) = :device_key
                   OR lower(device_name) = :device_uid_lower
                LIMIT 1
            """
        else:
            query = """
                SELECT * FROM devices
                WHERE lower(replace(replace(name, ':', ''), '-', '')) = :device_key
                   OR lower(name) = :device_uid_lower
                LIMIT 1
            """

    device_row_raw = await database.fetch_one(
        query,
        {"device_key": device_key, "device_uid_lower": device_uid.lower()},
    )
    if not device_row_raw:
        raise HTTPException(status_code=404, detail="Device not found")

    row_dict = dict(device_row_raw)
    
    # Map database row to expected output dictionary structure
    device_row = {
        "id": str(row_dict.get("id")),
        "patient_id": str(row_dict.get("patient_id")) if row_dict.get("patient_id") else None,
        "status": row_dict.get("status"),
        "device_type": row_dict.get("device_type"),
    }
    
    # Map name
    if "device_name" in row_dict:
        device_row["name"] = row_dict["device_name"]
    else:
        device_row["name"] = row_dict.get("name")
        
    # Map device_mac
    device_row["device_mac"] = row_dict.get("device_mac")
    
    # Map battery
    if "battery_level" in row_dict:
        device_row["battery"] = row_dict["battery_level"]
    else:
        device_row["battery"] = row_dict.get("battery")
        
    # Map last_seen
    if "last_seen" in row_dict:
        device_row["last_seen_at"] = row_dict["last_seen"]
    else:
        device_row["last_seen_at"] = row_dict.get("last_seen_at")
        
    # Map firmware_version
    device_row["firmware_version"] = row_dict.get("firmware_version")
    
    # Map updated_at
    device_row["updated_at"] = row_dict.get("updated_at")

    patient_id = device_row["patient_id"]
    if not patient_id:
        raise HTTPException(status_code=404, detail="Device does not have assigned patient")

    await ensure_patient_access(user, patient_id)
    return device_row


async def get_device_by_mac(device_mac: str) -> dict[str, Any] | None:
    """Tìm thiết bị theo địa chỉ MAC (hoặc tên nếu thiếu cột device_mac).

    Thích ứng động truy vấn dựa trên lược đồ bảng devices.
    Trả về các trường đã chọn bao gồm device_token_hash để xác thực.

    Args:
        device_mac: Địa chỉ MAC thiết bị thô.

    Returns:
        Dict hàng thiết bị hoặc None nếu không tìm thấy.
    """
    columns = await get_devices_table_columns()
    device_key = normalize_device_identifier(device_mac)
    uses_device_mac = "device_mac" in columns
    
    if uses_device_mac:
        query = """
            SELECT * FROM devices
            WHERE lower(replace(replace(device_mac, ':', ''), '-', '')) = :device_key
            LIMIT 1
        """
    else:
        query = """
            SELECT * FROM devices
            WHERE lower(replace(replace(name, ':', ''), '-', '')) = :device_key
            LIMIT 1
        """
        
    device_row_raw = await database.fetch_one(query, {"device_key": device_key})
    if not device_row_raw:
        return None
        
    row_dict = dict(device_row_raw)
    
    # Map database row to expected output dictionary structure
    device_row = {
        "id": str(row_dict.get("id")),
        "patient_id": str(row_dict.get("patient_id")) if row_dict.get("patient_id") else None,
        "status": row_dict.get("status"),
        "device_mac": row_dict.get("device_mac"),
        "device_token_hash": row_dict.get("device_token_hash"),
        "token_last_rotated_at": row_dict.get("token_last_rotated_at"),
        "firmware_version": row_dict.get("firmware_version"),
    }
    
    return device_row


def verify_iot_device_token(device_row: dict[str, Any], device_token: str) -> bool:
    """Xác thực token thiết bị IoT với hàm băm đã lưu hoặc token chia sẻ.

    Ưu tiên hàm băm token từng thiết bị; dự phòng sang token chia sẻ toàn cục.

    Args:
        device_row: Hàng cơ sở dữ liệu thiết bị chứa device_token_hash.
        device_token: Chuỗi token thô từ tiêu đề X-Device-Token.

    Returns:
        True nếu token hợp lệ, False nếu không.
    """
    token_hash = device_row["device_token_hash"]
    if token_hash:
        return verify_password(device_token, token_hash)
    shared_token = settings.IOT_DEVICE_SHARED_TOKEN.strip()
    return bool(shared_token and device_token == shared_token)


def has_any_iot_token_config(device_row: dict[str, Any]) -> bool:
    """Kiểm tra xem có bất kỳ cơ chế xác thực token nào được cấu hình không.

    Args:
        device_row: Hàng cơ sở dữ liệu thiết bị.

    Returns:
        True nếu có hàm băm từng thiết bị hoặc token chia sẻ được cấu hình.
    """
    if device_row["device_token_hash"]:
        return True
    return bool(settings.IOT_DEVICE_SHARED_TOKEN.strip())


@dataclass
class TelemetryForAI:
    heart_rate: float
    spo2: float
    systolic_bp: float
    diastolic_bp: float
    ecg_value: float


def detect_abnormal_iot(readings: Any) -> list[dict[str, str]]:
    """Phát hiện dấu hiệu sinh tồn bất thường từ chỉ số đo xa IoT.

    Bọc các chỉ số trong một đối tượng tương thích với
    detect_abnormal() và lọc bỏ cảnh báo huyết áp
    nếu thiếu dữ liệu BP.

    Args:
        readings: Đối tượng chỉ số với heart_rate, spo2,
            systolic_bp, diastolic_bp, ecg_value.

    Returns:
        Danh sách các dict cảnh báo (mỗi cảnh báo có alert_type, message, severity).
    """
    data = TelemetryForAI(
        heart_rate=readings.heart_rate,
        spo2=readings.spo2,
        systolic_bp=readings.systolic_bp if readings.systolic_bp is not None else 0.0,
        diastolic_bp=readings.diastolic_bp if readings.diastolic_bp is not None else 0.0,
        ecg_value=readings.ecg_value,
    )
    alerts = detect_abnormal(data)
    if readings.systolic_bp is None or readings.diastolic_bp is None:
        alerts = [a for a in alerts if a["alert_type"] != "HIGH_BLOOD_PRESSURE"]
    return alerts


@router.post("/sensor-data")
async def create_sensor_data(data: SensorDataCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Gửi chỉ số dữ liệu cảm biến thủ công cho một bệnh nhân.

    Xác thực quyền truy cập bệnh nhân, lưu chỉ số, chạy phát hiện bất thường
    (tạo cảnh báo nếu cần), phát sóng cả dữ liệu cảm biến và cảnh báo
    qua WebSocket và ghi nhật ký việc gửi.

    Args:
        data: SensorDataCreate với patient_id và các dấu hiệu sinh tồn.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Dict chứa xác nhận lưu, cờ is_abnormal và danh sách cảnh báo.
    """
    current_user = await get_user_from_token(authorization)
    await ensure_patient_access(current_user, data.patient_id)
    logger.info("Dữ liệu cảm biến thủ công nhận được: patient_id=%s sender_id=%s", data.patient_id, current_user["id"])

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
    RETURNING id
    """

    new_row = await database.fetch_one(
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
    sensor_id = str(new_row["id"]) if new_row else str(data.patient_id)

    # Ghi nhận log gửi chỉ số đo thủ công
    await log_activity(
        user_id=current_user["id"],
        action="PATIENT_MANUAL_TELEM_SUBMIT",
        entity_type="sensor_data",
        entity_id=sensor_id,
        ip_address=request.client.host if request.client else "-"
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
        # Gửi thông báo đến bác sĩ phụ trách và admin (cooldown: 5 phút để tránh spam)
        from app.services import notification_service
        patient_row = await database.fetch_one("SELECT full_name FROM users WHERE id = CAST(:id AS uuid)", {"id": str(data.patient_id)})
        patient_name = patient_display_name(patient_row)
        
        await notification_service.notify_assigned_doctors(
            patient_id=str(data.patient_id),
            title="CẢNH BÁO SỨC KHỎE BỆNH NHÂN",
            message=f"Bệnh nhân {patient_name} có chỉ số bất thường: '{alert['message']}'",
            type=f"alert_{alert['alert_type'].lower()}",
            category="health",
            severity=alert["severity"],
            actor_id=current_user["id"],
            source_table="alerts",
            action_url="/doctor/alerts",
            cooldown_mins=5
        )
        await notification_service.notify_admins(
            title="CẢNH BÁO SỨC KHỎE BỆNH NHÂN (TOÀN HỆ THỐNG)",
            message=f"Bệnh nhân {patient_name} có chỉ số bất thường: '{alert['message']}'",
            type=f"alert_{alert['alert_type'].lower()}",
            category="health",
            severity=alert["severity"],
            patient_id=str(data.patient_id),
            actor_id=current_user["id"],
            source_table="alerts",
            action_url="/admin/alerts",
            cooldown_mins=5
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

    logger.info(
        "Dữ liệu cảm biến thủ công đã lưu: patient_id=%s abnormal=%s alert_count=%s",
        data.patient_id,
        bool(alerts),
        len(alerts),
    )
    return {
        "message": "Sensor data saved successfully",
        "is_abnormal": len(alerts) > 0,
        "alerts": alerts
    }


@router.post("/iot/telemetry")
async def create_iot_telemetry(
    data: IotTelemetryPayload,
    request: Request,
    x_device_uid: str = Header(..., alias="X-Device-Uid"),
    x_device_mac: str = Header(..., alias="X-Device-Mac"),
    x_device_token: str = Header(..., alias="X-Device-Token"),
):
    """Nhận dữ liệu đo xa từ thiết bị y tế IoT.

    Luồng xác thực: tra cứu MAC → xác thực token thiết bị →
    kiểm tra trạng thái thiết bị. Cập nhật trạng thái thiết bị thành 'online',
    lưu chỉ số vào sensor_data, chạy phát hiện bất thường, tạo cảnh báo
    và phát sóng qua WebSocket. Giới hạn tốc độ 60 req/phút.

    Args:
        data: IotTelemetryPayload với các chỉ số và thông tin thiết bị tùy chọn.
        request: FastAPI Request để giới hạn tốc độ.
        x_device_uid: Tiêu đề UID thiết bị IoT.
        x_device_mac: Tiêu đề địa chỉ MAC thiết bị IoT.
        x_device_token: Tiêu đề token xác thực thiết bị IoT.

    Returns:
        Dict chứa xác nhận chấp nhận, patient_id, thông tin thiết bị,
        và các cảnh báo bất thường.

    Raises:
        HTTPException 400: Nếu MAC không hợp lệ.
        HTTPException 404: Nếu thiết bị chưa được ghép đôi hoặc không có bệnh nhân.
        HTTPException 401: Nếu token thiết bị không hợp lệ.
        HTTPException 403: Nếu trạng thái thiết bị chặn đo xa.
        HTTPException 503: Nếu không có cấu hình token.
    """
    device_key = normalize_device_identifier(x_device_mac)
    if len(device_key) != 12:
        raise HTTPException(status_code=400, detail="Invalid device MAC address")

    # Áp dụng rate limit cho IoT thiết bị (tối đa 60 requests/phút)
    from app.core.rate_limit import check_rate_limit, get_client_ip
    ip = get_client_ip(request)
    await check_rate_limit(ip, x_device_mac, "/iot/telemetry", max_requests=60, window_seconds=60)

    device_row = await get_device_by_mac(x_device_mac)
    if not device_row:
        raise HTTPException(status_code=404, detail="Device not paired")
    if not has_any_iot_token_config(device_row):
        raise HTTPException(status_code=503, detail="IOT device token is not configured")
    if not verify_iot_device_token(device_row, x_device_token):
        raise HTTPException(status_code=401, detail="Invalid device token")

    device_status = (device_row["status"] or "").lower()
    if device_status in {"revoked", "inactive", "blocked"}:
        raise HTTPException(status_code=403, detail="Device is not allowed to send telemetry")

    patient_id = device_row["patient_id"]
    if not patient_id:
        raise HTTPException(status_code=404, detail="Device does not have assigned patient")

    logger.info("Đo xa IoT nhận được: patient_id=%s device_uid=%s", patient_id, x_device_uid)

    columns = await get_devices_table_columns()
    update_parts = ["status = :status"]
    update_values = {
        "status": "online",
        "device_id": device_row["id"],
    }

    if "battery_level" in columns:
        update_parts.append("battery_level = COALESCE(:battery_level, battery_level)")
        update_values["battery_level"] = data.device.battery if data.device else None
    elif "battery" in columns:
        update_parts.append("battery = COALESCE(:battery, battery)")
        update_values["battery"] = data.device.battery if data.device else None

    if "last_seen" in columns:
        update_parts.append("last_seen = :last_seen")
        update_values["last_seen"] = datetime.now(timezone.utc).replace(tzinfo=None)
    elif "last_seen_at" in columns:
        update_parts.append("last_seen_at = :last_seen_at")
        update_values["last_seen_at"] = datetime.now(timezone.utc)

    if "updated_at" in columns:
        update_parts.append("updated_at = :updated_at")
        update_values["updated_at"] = datetime.now(timezone.utc)

    update_query = f"""
        UPDATE devices
        SET {", ".join(update_parts)}
        WHERE id = CAST(:device_id AS uuid)
    """
    await database.execute(update_query, update_values)

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
        # Gửi thông báo đến bác sĩ phụ trách và admin (cooldown: 5 phút để tránh spam)
        from app.services import notification_service
        patient_row = await database.fetch_one("SELECT full_name FROM users WHERE id = CAST(:id AS uuid)", {"id": str(patient_id)})
        patient_name = patient_display_name(patient_row)
        
        await notification_service.notify_assigned_doctors(
            patient_id=str(patient_id),
            title="CẢNH BÁO SỨC KHỎE BỆNH NHÂN (IoT)",
            message=f"Bệnh nhân {patient_name} có chỉ số bất thường: '{alert['message']}'",
            type=f"alert_{alert['alert_type'].lower()}",
            category="health",
            severity=alert["severity"],
            source_table="alerts",
            action_url="/doctor/alerts",
            cooldown_mins=5
        )
        await notification_service.notify_admins(
            title="CẢNH BÁO SỨC KHỎE BỆNH NHÂN (IoT TOÀN HỆ THỐNG)",
            message=f"Bệnh nhân {patient_name} có chỉ số bất thường: '{alert['message']}'",
            type=f"alert_{alert['alert_type'].lower()}",
            category="health",
            severity=alert["severity"],
            patient_id=str(patient_id),
            source_table="alerts",
            action_url="/admin/alerts",
            cooldown_mins=5
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

    logger.info(
        "Đo xa IoT đã lưu: patient_id=%s device_uid=%s abnormal=%s alert_count=%s",
        patient_id,
        x_device_uid,
        bool(alerts),
        len(alerts),
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
    """Lấy trạng thái hiện tại của thiết bị IoT.

    Args:
        device_uid: UID thiết bị (MAC hoặc tên).
        authorization: Token Bearer.

    Returns:
        Dict chứa trạng thái thiết bị, pin, lần cuối thấy, phần mềm cơ sở, v.v.

    Raises:
        HTTPException 404: Nếu không tìm thấy thiết bị.
        HTTPException 403: Nếu người dùng thiếu quyền truy cập.
    """
    current_user = await get_user_from_token(authorization)
    device_row = await ensure_device_access(current_user, device_uid)
    return {
        "device_uid": device_uid,
        "device_id": device_row["id"],
        "patient_id": device_row["patient_id"],
        "device_mac": device_row["device_mac"],
        "status": device_row["status"],
        "battery": device_row["battery"],
        "last_seen_at": to_jsonable(device_row["last_seen_at"]),
        "device_type": device_row["device_type"],
        "firmware_version": device_row["firmware_version"],
        "updated_at": to_jsonable(device_row["updated_at"]),
    }


@router.post("/iot/devices/{device_uid}/rotate-token")
async def rotate_iot_device_token(device_uid: str, request: Request, authorization: Optional[str] = Header(default=None)):
    """Xoay token xác thực cho thiết bị IoT.

    Tạo token thiết bị ngẫu nhiên mới, lưu hàm băm và trả về
    token văn bản thuần (chỉ hiển thị một lần). Chỉ admin hoặc bác sĩ.

    Args:
        device_uid: UID thiết bị (MAC hoặc tên).
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Dict chứa token thiết bị mới và dấu thời gian xoay.

    Raises:
        HTTPException 403: Nếu người dùng không phải admin hoặc bác sĩ.
        HTTPException 404: Nếu không tìm thấy thiết bị.
        HTTPException 409: Nếu cột device_token_hash không tồn tại.
    """
    current_user = await get_user_from_token(authorization)
    if current_user["role"] not in {"admin", "doctor"}:
        raise HTTPException(status_code=403, detail="Chỉ admin hoặc bác sĩ mới được xoay token thiết bị")
    device_row = await ensure_device_access(current_user, device_uid)
    columns = await get_devices_table_columns()
    if "device_token_hash" not in columns:
        raise HTTPException(status_code=409, detail="Database has not been migrated for per-device token")

    new_token = f"cgdt_{secrets.token_urlsafe(24)}"
    new_token_hash = hash_password(new_token)
    rotated_at = datetime.now(timezone.utc)
    await database.execute(
        """
        UPDATE devices
        SET device_token_hash = :device_token_hash,
            token_last_rotated_at = :rotated_at,
            updated_at = :updated_at
        WHERE id = CAST(:device_id AS uuid)
        """,
        {
            "device_token_hash": new_token_hash,
            "rotated_at": rotated_at,
            "updated_at": rotated_at,
            "device_id": device_row["id"],
        },
    )

    # Ghi nhận log xoay token thiết bị IoT
    await log_activity(
        user_id=current_user["id"],
        action="IOT_ROTATE_TOKEN",
        entity_type="devices",
        entity_id=device_row["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return {
        "device_uid": device_uid,
        "device_id": device_row["id"],
        "device_token": new_token,
        "token_last_rotated_at": rotated_at.isoformat(),
    }


@router.get("/sensor-data")
async def get_sensor_data(
    authorization: Optional[str] = Header(default=None),
    patient_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Lấy dữ liệu cảm biến với phạm vi truy cập dựa trên vai trò.

    Bệnh nhân thấy dữ liệu của chính họ. Bác sĩ thấy dữ liệu cho bệnh nhân
    được phân công của họ. Tùy chọn lọc theo patient_id.

    Args:
        authorization: Token Bearer.
        patient_id: UUID bệnh nhân tùy chọn để lọc.
        limit: Số bản ghi tối đa (1-500).
        offset: Độ lệch phân trang.

    Returns:
        Danh sách dict dữ liệu cảm biến với giá trị an toàn JSON.
    """
    current_user = await get_user_from_token(authorization)
    where_parts = []
    values: dict[str, Any] = {}

    if current_user["role"] == "patient":
        where_parts.append("patient_id = CAST(:current_user_id AS uuid)")
        values["current_user_id"] = current_user["id"]
    elif current_user["role"] == "doctor":
        where_parts.append(
            """
            EXISTS (
                SELECT 1 FROM doctor_patient dp
                WHERE dp.doctor_id = CAST(:current_user_id AS uuid)
                AND dp.patient_id = sensor_data.patient_id
            )
            """
        )
        values["current_user_id"] = current_user["id"]

    role = current_user["role"]
    query_values = {}
    if role == "patient":
        # Bệnh nhân chỉ thấy dữ liệu của chính mình
        query = """
            SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
            FROM sensor_data
            WHERE patient_id = CAST(:current_user_id AS uuid)
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """
        query_values["current_user_id"] = current_user["id"]
        count_query = "SELECT COUNT(*)::int AS total FROM sensor_data WHERE patient_id = CAST(:current_user_id AS uuid)"
    elif role == "doctor":
        if patient_id:
            await ensure_patient_access(current_user, patient_id)
            query = """
                SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
                FROM sensor_data
                WHERE patient_id = CAST(:patient_id AS uuid)
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """
            query_values["patient_id"] = patient_id
            count_query = "SELECT COUNT(*)::int AS total FROM sensor_data WHERE patient_id = CAST(:patient_id AS uuid)"
        else:
            query = """
                SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
                FROM sensor_data
                WHERE EXISTS (
                    SELECT 1 FROM doctor_patient dp
                    WHERE dp.doctor_id = CAST(:current_user_id AS uuid)
                      AND dp.patient_id = sensor_data.patient_id
                )
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """
            query_values["current_user_id"] = current_user["id"]
            count_query = """
                SELECT COUNT(*)::int AS total FROM sensor_data
                WHERE EXISTS (
                    SELECT 1 FROM doctor_patient dp
                    WHERE dp.doctor_id = CAST(:current_user_id AS uuid)
                      AND dp.patient_id = sensor_data.patient_id
                )
            """
    else:  # admin
        if patient_id:
            query = """
                SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
                FROM sensor_data
                WHERE patient_id = CAST(:patient_id AS uuid)
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """
            query_values["patient_id"] = patient_id
            count_query = "SELECT COUNT(*)::int AS total FROM sensor_data WHERE patient_id = CAST(:patient_id AS uuid)"
        else:
            query = """
                SELECT id::text as id, patient_id::text as patient_id, heart_rate, spo2, systolic_bp, diastolic_bp, ecg_value, created_at
                FROM sensor_data
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """
            count_query = "SELECT COUNT(*)::int AS total FROM sensor_data"

    total = await database.fetch_val(count_query, query_values)

    data = await database.fetch_all(
        query,
        {**query_values, "limit": limit, "offset": offset},
    )

    return {
        "items": [row_to_dict(row) for row in data],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/sensors/history")
async def get_sensor_history(
    authorization: Optional[str] = Header(default=None),
    patient_id: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Lấy lịch sử dữ liệu cảm biến có phân trang.

    Bao bọc get_sensor_data với định dạng phản hồi phân trang chuẩn hóa.

    Args:
        authorization: Token Bearer.
        patient_id: UUID bệnh nhân tùy chọn để lọc.
        limit: Số bản ghi tối đa (1-100).
        offset: Độ lệch phân trang.

    Returns:
        Dict chứa items, total, limit và offset.
    """
    return await get_sensor_data(
        authorization=authorization,
        patient_id=patient_id,
        limit=limit,
        offset=offset,
    )


def format_mac_address(raw_mac: str) -> str:
    """Chuẩn hóa địa chỉ MAC thành định dạng xx:xx:xx:xx:xx:xx"""
    clean = raw_mac.strip().lower().replace(":", "").replace("-", "")
    if len(clean) != 12:
        raise HTTPException(status_code=400, detail="Địa chỉ MAC phải chứa đúng 12 ký tự hex.")
    if not all(c in "0123456789abcdef" for c in clean):
        raise HTTPException(status_code=400, detail="Địa chỉ MAC chứa ký tự không hợp lệ.")
    return ":".join(clean[i:i+2] for i in range(0, 12, 2))


@router.post("/iot/devices/claim")
async def claim_device(
    payload: DeviceClaim,
    authorization: Optional[str] = Header(default=None)
):
    """Bệnh nhân liên kết thiết bị phần cứng (MAC) vào tài khoản của mình."""
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có quyền liên kết thiết bị")
    
    patient_id = current_user["id"]
    formatted_mac = format_mac_address(payload.device_mac)
        
    # Tìm kiếm thiết bị theo MAC trong DB
    device_row = await get_device_by_mac(formatted_mac)
    
    if device_row:
        # Thiết bị đã tồn tại trong DB
        db_patient_id = device_row["patient_id"]
        if db_patient_id:
            if str(db_patient_id) != str(patient_id):
                raise HTTPException(
                    status_code=400,
                    detail="Thiết bị này đã được liên kết với một bệnh nhân khác. Vui lòng liên hệ bác sĩ hoặc admin để được hỗ trợ."
                )
            # Nếu đã liên kết với chính bệnh nhân hiện tại, trả về thông tin thiết bị luôn
            full_device = await database.fetch_one("SELECT * FROM devices WHERE id = CAST(:device_id AS uuid)", {"device_id": device_row["id"]})
            return {
                "message": "Thiết bị đã được liên kết từ trước",
                "device": row_to_dict(full_device)
            }
        
        # Nếu chưa gán cho ai, tiến hành cập nhật patient_id cho thiết bị
        await database.execute(
            "UPDATE devices SET patient_id = CAST(:patient_id AS uuid), status = 'online' WHERE id = CAST(:device_id AS uuid)",
            {"patient_id": patient_id, "device_id": device_row["id"]}
        )
        updated_device = await database.fetch_one("SELECT * FROM devices WHERE id = CAST(:device_id AS uuid)", {"device_id": device_row["id"]})
        return {
            "message": "Liên kết thiết bị thành công",
            "device": row_to_dict(updated_device)
        }
    else:
        # Thiết bị chưa tồn tại, tự động tạo mới
        device_id = str(uuid.uuid4())
        device_name = payload.device_name or "CardioGuard Wearable Prototype"
        device_type = payload.device_type or "Wearable"
        
        await database.execute(
            """
            INSERT INTO devices(id, patient_id, device_name, device_type, device_mac, status, created_at)
            VALUES (CAST(:id AS uuid), CAST(:patient_id AS uuid), :device_name, :device_type, :device_mac, 'online', NOW())
            """,
            {
                "id": device_id,
                "patient_id": patient_id,
                "device_name": device_name,
                "device_type": device_type,
                "device_mac": formatted_mac
            }
        )
        
        new_device = await database.fetch_one("SELECT * FROM devices WHERE id = CAST(:id AS uuid)", {"id": device_id})
        return {
            "message": "Đã tạo mới và liên kết thiết bị thành công",
            "device": row_to_dict(new_device)
        }


@router.post("/iot/devices/unclaim")
async def unclaim_device(
    payload: DeviceUnclaim,
    authorization: Optional[str] = Header(default=None)
):
    """Bệnh nhân hủy liên kết thiết bị phần cứng ra khỏi tài khoản."""
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có quyền hủy liên kết thiết bị")
        
    patient_id = current_user["id"]
    formatted_mac = format_mac_address(payload.device_mac)
    
    device_row = await get_device_by_mac(formatted_mac)
    if not device_row:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị với địa chỉ MAC này")
        
    db_patient_id = device_row["patient_id"]
    if not db_patient_id or str(db_patient_id) != str(patient_id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý thiết bị này")
        
    await database.execute(
        "UPDATE devices SET patient_id = NULL WHERE id = CAST(:device_id AS uuid)",
        {"device_id": device_row["id"]}
    )
    
    return {"message": "Đã hủy liên kết thiết bị thành công"}


@router.post("/cameras/{camera_id}/fall-detection")
async def camera_fall_detection(
    camera_id: str,
    authorization: Optional[str] = Header(default=None)
):
    """Giả lập sự kiện phát hiện té ngã từ Camera AI."""
    # Xác thực người dùng
    current_user = await get_user_from_token(authorization)
    
    # 1. Tìm thông tin camera
    camera = await database.fetch_one(
        "SELECT * FROM cameras WHERE id = CAST(:camera_id AS uuid)",
        {"camera_id": camera_id}
    )
    if not camera:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera giám sát")
        
    patient_id = camera.get("assigned_patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Camera chưa được phân công cho bệnh nhân nào")
        
    camera_location = camera.get("location") or "Phòng bệnh"
    camera_name = camera.get("camera_name") or camera.get("name") or "Camera AI"
    
    # 2. Tạo bản ghi cảnh báo trong CSDL
    alert_id = str(uuid.uuid4())
    insert_query = """
    INSERT INTO alerts (id, patient_id, alert_type, message, severity, is_resolved)
    VALUES (:id, :patient_id, :alert_type, :message, :severity, FALSE)
    """
    
    await database.execute(
        insert_query,
        {
            "id": alert_id,
            "patient_id": patient_id,
            "alert_type": "FALL_DETECTION",
            "message": f"Phát hiện bệnh nhân té ngã tại vị trí {camera_location} qua phân tích {camera_name}",
            "severity": "critical"
        }
    )
    
    # 3. Lấy thông tin cảnh báo đầy đủ kèm theo tên bệnh nhân
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
    
    if not updated_alert:
        raise HTTPException(status_code=500, detail="Lỗi tạo cảnh báo té ngã")
        
    alert_dict = {key: updated_alert[key] for key in updated_alert.keys()}
    alert_dict = to_jsonable(alert_dict)
    
    # 4. Phát sóng thời gian thực qua WebSocket Connection Manager
    await manager.broadcast_alert(str(patient_id), alert_dict)
    
    # Ghi nhật ký kiểm toán hoạt động
    await log_activity(
        user_id=current_user["id"],
        action="FALL_DETECTION_TRIGGERED",
        entity_type="cameras",
        entity_id=camera_id,
        details={"patient_id": str(patient_id), "alert_id": alert_id, "location": camera_location}
    )
    
    return {
        "status": "success",
        "message": "Cảnh báo ngã đã được kích hoạt thành công",
        "alert": alert_dict
    }
