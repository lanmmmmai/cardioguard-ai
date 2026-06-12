"""API CRUD tổng quát với kiểm soát truy cập dựa trên vai trò.

Mục đích:
    Cung cấp giao diện CRUD (Tạo, Đọc, Cập nhật, Xóa) tổng quát cho
    nhiều bảng cơ sở dữ liệu với đăng ký tuyến đường tự động, kiểm soát
    truy cập dựa trên vai trò (RBAC), phạm vi bảo mật cấp hàng và kích
    hoạt phát sóng WebSocket khi có thay đổi.

Luồng xử lý:
    Các tuyến đường bảng được đăng ký tại thời điểm tải module thông qua
    register_table_routes(). Mỗi thao tác CRUD thực thi: (1) quyền thao tác
    theo vai trò, (2) bộ lọc truy cập cấp hàng qua access_filter(),
    (3) thực thi phạm vi ghi qua enforce_write_scope() và (4) ghi nhật ký
    kiểm toán. Điểm cuối reports/summary cung cấp thống kê báo cáo tổng hợp
    với lọc dữ liệu dựa trên vai trò.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Phụ thuộc vào: core.database để truy cập DB
    - Phụ thuộc vào: services.audit_service để ghi nhật ký hoạt động
    - Phụ thuộc vào: schemas.crud_schema cho các model request/response
    - Phụ thuộc vào: websocket.connection_manager để phát sóng thời gian thực
    - Bảng: appointments, medical_records, prescriptions, devices,
      notifications, chat_messages, cameras, reports
"""

import asyncio
import json
import re
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
import logging

from fastapi import APIRouter, Header, HTTPException, Query, Request

from app.api.auth_api import get_user_from_token
from app.services.audit_service import log_activity
from app.core.database import database
from app.schemas.crud_schema import (
    AppointmentCreate,
    AppointmentUpdate,
    AuditLogCreate,
    AuditLogUpdate,
    CameraCreate,
    CameraUpdate,
    ChatMessageCreate,
    ChatMessageUpdate,
    DeviceCreate,
    DeviceUpdate,
    MedicalRecordCreate,
    MedicalRecordUpdate,
    NotificationCreate,
    NotificationUpdate,
    PrescriptionCreate,
    PrescriptionUpdate,
    ReportCreate,
    ReportUpdate,
    ArticleCreate,
    ArticleUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)

TABLES = {
    "appointments": {"path": "/appointments", "create": AppointmentCreate, "update": AppointmentUpdate},
    "medical_records": {"path": "/medical-records", "create": MedicalRecordCreate, "update": MedicalRecordUpdate},
    "prescriptions": {"path": "/prescriptions", "create": PrescriptionCreate, "update": PrescriptionUpdate},
    "devices": {"path": "/devices", "create": DeviceCreate, "update": DeviceUpdate},
    "chat_messages": {"path": "/chat-messages", "create": ChatMessageCreate, "update": ChatMessageUpdate},
    "cameras": {"path": "/cameras", "create": CameraCreate, "update": CameraUpdate},
    "reports": {"path": "/reports", "create": ReportCreate, "update": ReportUpdate},
    "articles": {"path": "/articles", "create": ArticleCreate, "update": ArticleUpdate},
}

ALIASES = {
    "iot-devices": "devices",
    "chat": "chat_messages",
}

WRITE_PROTECTED_COLUMNS = {"created_at", "updated_at"}
_COLUMN_CACHE_TTL = 3600  # 1 hour
_column_cache: dict[str, tuple[set[str], float]] = {}
_column_cache_lock = asyncio.Lock()
PATIENT_CREATE_BLOCKED_TABLES = {"devices", "medical_records", "prescriptions", "reports"}
PATIENT_UPDATE_BLOCKED_TABLES = {"devices", "medical_records", "prescriptions", "reports"}
PATIENT_DELETE_BLOCKED_TABLES = {"appointments", "cameras", "devices", "medical_records", "prescriptions", "reports"}
DOCTOR_DELETE_BLOCKED_TABLES = {"devices", "medical_records", "prescriptions", "reports"}


def _filter_query_values(query: str, values: dict[str, Any]) -> dict[str, Any]:
    """Lọc dict values để chỉ giữ các bind params thực sự có trong query.

    `databases`/SQLAlchemy `text()` sẽ raise nếu values chứa key không có
    placeholder tương ứng trong SQL string. Hàm này giúp các truy vấn tổng quát
    an toàn hơn khi một số filter chỉ xuất hiện ở một nhánh.
    """
    placeholders = set(re.findall(r":([A-Za-z_][A-Za-z0-9_]*)", query))
    return {key: value for key, value in values.items() if key in placeholders}


def enforce_operation_permission(table: str, role: str, operation: str) -> None:
    """Kiểm tra xem một vai trò có được phép thực hiện thao tác trên một bảng không.

    Admin có toàn quyền truy cập. Bệnh nhân và bác sĩ có các bộ thao tác
    bị hạn chế trên một số bảng nhất định (ví dụ: bệnh nhân không thể xóa
    hồ sơ y tế).

    Args:
        table: Tên bảng mục tiêu.
        role: Chuỗi vai trò người dùng.
        operation: Tên thao tác ('create', 'update', 'delete').

    Raises:
        HTTPException 403: Nếu thao tác không được phép.
    """
    if role == "admin":
        return
    if role == "patient":
        if operation == "create" and table in PATIENT_CREATE_BLOCKED_TABLES:
            raise HTTPException(status_code=403, detail=f"Patient cannot create records in {table}")
        if operation == "update" and table in PATIENT_UPDATE_BLOCKED_TABLES:
            raise HTTPException(status_code=403, detail=f"Patient cannot update records in {table}")
        if operation == "delete" and table in PATIENT_DELETE_BLOCKED_TABLES:
            raise HTTPException(status_code=403, detail=f"Patient cannot delete records in {table}")
        return
    if role == "doctor":
        if operation == "delete" and table in DOCTOR_DELETE_BLOCKED_TABLES:
            raise HTTPException(status_code=403, detail=f"Doctor cannot delete records in {table}")
        return


def quote_identifier(value: str) -> str:
    """Đặt dấu ngoặc kép an toàn cho tên bảng SQL, xác thực nó tồn tại trong TABLES.

    Args:
        value: Chuỗi tên bảng.

    Returns:
        Tên bảng được đặt trong dấu ngoặc kép.

    Raises:
        HTTPException 404: Nếu bảng không được đăng ký trong TABLES.
    """
    if value not in TABLES:
        raise HTTPException(status_code=404, detail="Unknown table")
    return f'"{value}"'


def quote_column(value: str, columns: set[str]) -> str:
    """Đặt dấu ngoặc kép an toàn cho tên cột, xác thực nó tồn tại trong tập cột.

    Args:
        value: Chuỗi tên cột.
        columns: Tập hợp các tên cột hợp lệ.

    Returns:
        Tên cột được đặt trong dấu ngoặc kép.

    Raises:
        HTTPException 400: Nếu cột không có trong tập hợp hợp lệ.
    """
    if value not in columns:
        raise HTTPException(status_code=400, detail=f"Unknown column: {value}")
    return f'"{value}"'


def to_jsonable(value: Any) -> Any:
    """Chuyển đổi đệ quy các kiểu không thể tuần tự hóa thành giá trị an toàn JSON.

    Xử lý các kiểu datetime, date, UUID, Decimal, dict và list/tuple.

    Args:
        value: Bất kỳ giá trị Python nào.

    Returns:
        Giá trị có thể tuần tự hóa JSON.
    """
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(item) for item in value]
    return value


def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa một dict payload để chèn vào cơ sở dữ liệu.

    Chuyển đổi UUID thành chuỗi và tuần tự hóa dict/list thành JSON.

    Args:
        payload: Dict đầu vào thô.

    Returns:
        Dict đã chuẩn hóa phù hợp cho truy vấn DB.
    """
    result = {}
    for key, value in payload.items():
        if isinstance(value, uuid.UUID):
            result[key] = str(value)
        elif isinstance(value, (dict, list)):
            result[key] = json.dumps(value)
        else:
            result[key] = value
    return result


async def table_columns(table: str) -> set[str]:
    """Lấy tập hợp tên cột cho một bảng, có bộ nhớ đệm với TTL.

    Args:
        table: Tên bảng.

    Returns:
        Tập hợp các chuỗi tên cột.

    Raises:
        HTTPException 500: Nếu bảng không có cột 'id'.
    """
    async with _column_cache_lock:
        if table in _column_cache:
            columns, cached_at = _column_cache[table]
            if time.monotonic() - cached_at < _COLUMN_CACHE_TTL:
                return columns

    rows = await database.fetch_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :table_name
        """,
        {"table_name": table},
    )
    columns = {row["column_name"] for row in rows}
    if "id" not in columns:
        raise HTTPException(status_code=500, detail=f"Table {table} must have UUID id column")

    async with _column_cache_lock:
        _column_cache[table] = (columns, time.monotonic())
    return columns


def row_to_dict(row: Any) -> dict[str, Any]:
    """Chuyển đổi một hàng cơ sở dữ liệu thành dict an toàn JSON.

    Args:
        row: Đối tượng hàng cơ sở dữ liệu (giống dict).

    Returns:
        Dict với tất cả giá trị được truyền qua to_jsonable.
    """
    return {key: to_jsonable(row[key]) for key in row.keys()}


def access_filter(table: str, columns: set[str], user: dict[str, str], prefix: str = "") -> tuple[str, dict[str, Any]]:
    """Xây dựng mệnh đề WHERE SQL và tham số cho kiểm soát truy cập cấp hàng.

    Tạo điều kiện phạm vi dựa trên vai trò người dùng:
    - Admin: không lọc (tất cả hàng đều có thể truy cập).
    - Bệnh nhân: hàng có patient_id khớp với ID của người dùng.
    - Bác sĩ: hàng có patient_id được phân công cho bác sĩ.
    - Xử lý đặc biệt cho: notifications, chat_messages, audit_logs.

    Args:
        table: Tên bảng mục tiêu.
        columns: Tập hợp tên cột trong bảng.
        user: Dict người dùng đã xác thực với role và id.
        prefix: Tiền tố bí danh bảng tùy chọn cho tham chiếu cột.

    Returns:
        Tuple gồm (chuỗi mệnh đề WHERE SQL, dict tham số).
    """
    role = user["role"]
    user_id = user["id"]
    col = lambda name: f"{prefix}{quote_column(name, columns)}"

    if role == "admin":
        return "", {}

    clauses = []
    if "patient_id" in columns:
        if role == "patient":
            clauses.append(f"{col('patient_id')} = CAST(:current_user_id AS uuid)")
        elif role == "doctor":
            clauses.append(
                f"""EXISTS (
                    SELECT 1 FROM doctor_patient dp
                    WHERE dp.doctor_id = CAST(:current_user_id AS uuid)
                    AND dp.patient_id = {col('patient_id')}
                )"""
            )

    if table == "notifications" and "user_id" in columns:
        clauses.append(f"{col('user_id')} = CAST(:current_user_id AS uuid)")

    if table == "chat_messages":
        for owner_column in ("sender_id", "recipient_id"):
            if owner_column in columns:
                clauses.append(f"{col(owner_column)} = CAST(:current_user_id AS uuid)")
        if role == "doctor" and "doctor_id" in columns:
            clauses.append(f"{col('doctor_id')} = CAST(:current_user_id AS uuid)")

    if table == "audit_logs" and "user_id" in columns:
        clauses.append(f"{col('user_id')} = CAST(:current_user_id AS uuid)")

    if not clauses:
        return "1 = 0", {"current_user_id": user_id}

    return f"({' OR '.join(clauses)})", {"current_user_id": user_id}


async def ensure_doctor_patient_access(doctor_id: str, patient_id: Any) -> None:
    """Xác minh một bác sĩ được phân công cho một bệnh nhân cụ thể.

    Args:
        doctor_id: UUID của bác sĩ.
        patient_id: UUID của bệnh nhân.

    Raises:
        HTTPException 403: Nếu patient_id bị thiếu hoặc bác sĩ không được phân công.
    """
    if not patient_id:
        raise HTTPException(status_code=403, detail="Doctor requests must include an assigned patient_id")
    row = await database.fetch_one(
        """
        SELECT 1
        FROM doctor_patient
        WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)
        """,
        {"doctor_id": doctor_id, "patient_id": str(patient_id)},
    )
    if not row:
        raise HTTPException(status_code=403, detail="Doctor is not assigned to this patient")


async def enforce_write_scope(table: str, columns: set[str], user: dict[str, str], payload: dict[str, Any], current: Optional[dict[str, Any]] = None) -> None:
    """Đảm bảo người dùng được phép ghi payload đã cho.

    Đối với bác sĩ: xác thực phân công bác sĩ-bệnh nhân khi ghi các trường
    patient_id. Đối với bệnh nhân: ngăn ghi các cột chủ sở hữu cho người dùng
    khác và xác thực phân công bác sĩ-bệnh nhân nếu chỉ định doctor_id.

    Args:
        table: Tên bảng mục tiêu.
        columns: Tập hợp tên cột trong bảng.
        user: Dict người dùng đã xác thực.
        payload: Dữ liệu payload đang được ghi.
        current: Bản ghi hiện tại tùy chọn cho thao tác cập nhật.

    Raises:
        HTTPException 403: Nếu phạm vi ghi bị vi phạm.
    """
    role = user["role"]
    user_id = user["id"]

    if role == "admin":
        return

    target_patient_id = payload.get("patient_id") or (current or {}).get("patient_id")
    if role == "doctor":
        if "patient_id" in columns:
            await ensure_doctor_patient_access(user_id, target_patient_id)
        for owner_column in ("doctor_id", "sender_id", "user_id"):
            if owner_column in columns and owner_column in payload and str(payload[owner_column]) != user_id:
                raise HTTPException(status_code=403, detail=f"Cannot write {owner_column} for another user")
        return

    if role == "patient":
        for owner_column in ("patient_id", "user_id", "sender_id"):
            if owner_column in columns:
                requested = payload.get(owner_column) or (current or {}).get(owner_column)
                if requested and str(requested) != user_id:
                    raise HTTPException(status_code=403, detail=f"Cannot write {owner_column} for another user")
        if "doctor_id" in columns and "doctor_id" in payload:
            await ensure_doctor_patient_access(str(payload["doctor_id"]), user_id)


def apply_write_defaults(table: str, columns: set[str], user: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    """Áp dụng giá trị mặc định khi tạo bản ghi dựa trên vai trò người dùng.

    Tự động điền id (UUID), doctor_id cho bác sĩ, sender_id/user_id cho
    bác sĩ/bệnh nhân và patient_id cho bệnh nhân.

    Args:
        table: Tên bảng mục tiêu.
        columns: Tập hợp tên cột trong bảng.
        user: Dict người dùng đã xác thực.
        payload: Dict payload đầu vào.

    Returns:
        Dict payload với các giá trị mặc định đã được áp dụng.
    """
    role = user["role"]
    user_id = user["id"]
    result = dict(payload)

    if "id" in columns and not result.get("id"):
        result["id"] = str(uuid.uuid4())

    if role == "doctor":
        if "doctor_id" in columns and not result.get("doctor_id"):
            result["doctor_id"] = user_id
        if table == "chat_messages" and "sender_id" in columns and not result.get("sender_id"):
            result["sender_id"] = user_id
        if table == "audit_logs" and "user_id" in columns and not result.get("user_id"):
            result["user_id"] = user_id

    if role == "patient":
        for owner_column in ("patient_id", "user_id", "sender_id"):
            if owner_column in columns and not result.get(owner_column):
                result[owner_column] = user_id

    return result


async def fetch_authorized_row(table: str, record_id: str, columns: set[str], user: dict[str, str]) -> dict[str, Any]:
    """Lấy một hàng duy nhất theo ID với lọc kiểm soát truy cập.

    Args:
        table: Tên bảng mục tiêu.
        record_id: UUID của bản ghi.
        columns: Tập hợp tên cột trong bảng.
        user: Dict người dùng đã xác thực.

    Returns:
        Bản ghi dưới dạng dict an toàn JSON.

    Raises:
        HTTPException 404: Nếu không tìm thấy bản ghi hoặc truy cập bị từ chối.
    """
    access_sql, values = access_filter(table, columns, user)
    where_sql = f'"id" = CAST(:record_id AS uuid)'
    if access_sql:
        where_sql = f"{where_sql} AND {access_sql}"

    row = await database.fetch_one(
        f"SELECT * FROM {quote_identifier(table)} WHERE {where_sql}",
        {**values, "record_id": record_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return row_to_dict(row)


async def list_records(table: str, authorization: Optional[str], limit: int, offset: int, patient_id: Optional[str] = None):
    """Liệt kê các bản ghi từ một bảng với phạm vi truy cập dựa trên vai trò.

    Args:
        table: Tên bảng mục tiêu.
        authorization: Token Bearer.
        limit: Số bản ghi tối đa để trả về.
        offset: Độ lệch phân trang.
        patient_id: UUID bệnh nhân tùy chọn để lọc.

    Returns:
        Dict chứa items, total, limit và offset.
    """
    user = await get_user_from_token(authorization)
    columns = await table_columns(table)
    access_sql, values = access_filter(table, columns, user)
    where_parts = [access_sql] if access_sql else []

    if patient_id:
        if "patient_id" not in columns:
            raise HTTPException(status_code=400, detail="This table does not support patient_id filtering")
        where_parts.append('"patient_id" = CAST(:patient_id AS uuid)')
        values["patient_id"] = patient_id

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    count_query = f"SELECT COUNT(*)::int AS total FROM {quote_identifier(table)} {where_sql}"
    count_values = _filter_query_values(count_query, values)
    total = await database.fetch_val(count_query, count_values)

    order_column = "created_at" if "created_at" in columns else "updated_at" if "updated_at" in columns else "id"
    rows_query = f"""
        SELECT *
        FROM {quote_identifier(table)}
        {where_sql}
        ORDER BY {quote_column(order_column, columns)} DESC
        LIMIT :limit OFFSET :offset
        """
    rows = await database.fetch_all(
        rows_query,
        _filter_query_values(rows_query, {**values, "limit": limit, "offset": offset}),
    )
    return {"items": [row_to_dict(row) for row in rows], "total": total, "limit": limit, "offset": offset}


async def trigger_websocket_broadcast(table: str, record: dict[str, Any]):
    """Phát sóng thay đổi bản ghi đến các client WebSocket liên quan.

    Hiện tại hỗ trợ: chat_messages, appointments, notifications.
    Lỗi được ghi nhật ký nhưng không truyền lên để tránh gián đoạn
    thao tác CRUD chính.

    Args:
        table: Tên bảng của bản ghi đã thay đổi.
        record: Dict bản ghi để phát sóng.
    """
    from app.websocket.connection_manager import manager
    try:
        if table == "chat_messages":
            sender_id = record.get("sender_id")
            recipient_id = record.get("recipient_id")
            if sender_id and recipient_id:
                await manager.broadcast_chat_message(str(sender_id), str(recipient_id), record)
        elif table == "appointments":
            patient_id = record.get("patient_id")
            doctor_id = record.get("doctor_id")
            if patient_id and doctor_id:
                await manager.broadcast_appointment(str(patient_id), str(doctor_id), record)
        elif table == "notifications":
            user_id = record.get("user_id")
            if user_id:
                await manager.broadcast_notification(str(user_id), record)
    except Exception as e:
        logger.exception("Lỗi khi kích hoạt phát sóng WebSocket cho table=%s", table)


async def trigger_domain_notifications(table: str, operation: str, record: dict[str, Any], current_user: dict[str, Any]):
    """Trigger notifications based on table CRUD changes.

    Args:
        table: Target table name.
        operation: Operation type ('create' or 'update').
        record: The database record dict.
        current_user: The authenticated user making the request.
    """
    from app.services import notification_service
    try:
        logger.info("trigger_domain_notifications: table=%s op=%s", table, operation)
        if table == "medical_records":
            status = record.get("status")
            patient_id = record.get("patient_id")
            doctor_id = record.get("doctor_id")
            record_id = record.get("id")
            if status == "signed" and patient_id:
                await notification_service.notify_patient(
                    patient_id=str(patient_id),
                    title="Bệnh án đã được ký xác nhận",
                    message="Bác sĩ đã ký xác nhận bệnh án mới. Bạn có thể xem trong mục Bệnh án điện tử.",
                    type="medical_record_signed",
                    category="record",
                    severity="success",
                    actor_id=str(doctor_id) if doctor_id else None,
                    source_table="medical_records",
                    source_id=str(record_id),
                    metadata={"record_id": str(record_id)},
                    action_url=f"/patient/medical-records/{record_id}"
                )
        elif table == "appointments":
            patient_id = record.get("patient_id")
            doctor_id = record.get("doctor_id")
            status = record.get("status", "pending")
            appt_id = record.get("id")
            title = record.get("title", "Lịch hẹn khám")
            
            if operation == "create":
                if patient_id:
                    await notification_service.notify_patient(
                        patient_id=str(patient_id),
                        title="Đăng ký lịch hẹn thành công",
                        message=f"Lịch hẹn '{title}' đã được đăng ký thành công và đang chờ bác sĩ xác nhận.",
                        type="appointment_created",
                        category="appointment",
                        severity="info",
                        actor_id=current_user["id"],
                        source_table="appointments",
                        source_id=str(appt_id),
                        action_url="/patient/appointments"
                    )
                if doctor_id and patient_id:
                    await notification_service.create_notification(
                        user_id=str(doctor_id),
                        title="Yêu cầu lịch hẹn mới",
                        message=f"Bạn nhận được yêu cầu hẹn khám mới: '{title}'.",
                        type="appointment_created",
                        category="appointment",
                        severity="info",
                        patient_id=str(patient_id),
                        actor_id=current_user["id"],
                        source_table="appointments",
                        source_id=str(appt_id),
                        action_url="/doctor/appointments"
                    )
            elif operation == "update":
                status_texts = {
                    "confirmed": "được xác nhận",
                    "completed": "hoàn thành",
                    "cancelled": "bị hủy"
                }
                status_text = status_texts.get(status, f"cập nhật thành '{status}'")
                
                if patient_id:
                    await notification_service.notify_patient(
                        patient_id=str(patient_id),
                        title=f"Lịch hẹn {status_text}",
                        message=f"Lịch hẹn '{title}' của bạn đã {status_text}.",
                        type=f"appointment_{status}",
                        category="appointment",
                        severity="warning" if status == "cancelled" else "success" if status == "confirmed" else "info",
                        actor_id=current_user["id"],
                        source_table="appointments",
                        source_id=str(appt_id),
                        action_url="/patient/appointments"
                    )
                if doctor_id and patient_id:
                    await notification_service.create_notification(
                        user_id=str(doctor_id),
                        title=f"Lịch hẹn {status_text}",
                        message=f"Lịch hẹn '{title}' đã {status_text}.",
                        type=f"appointment_{status}",
                        category="appointment",
                        severity="warning" if status == "cancelled" else "success" if status == "confirmed" else "info",
                        patient_id=str(patient_id),
                        actor_id=current_user["id"],
                        source_table="appointments",
                        source_id=str(appt_id),
                        action_url="/doctor/appointments"
                    )
        elif table == "prescriptions":
            patient_id = record.get("patient_id")
            doctor_id = record.get("doctor_id")
            med_name = record.get("medication_name", "Thuốc")
            prescription_id = record.get("id")
            
            if patient_id:
                await notification_service.notify_patient(
                    patient_id=str(patient_id),
                    title="Đơn thuốc mới/cập nhật",
                    message=f"Bạn nhận được đơn thuốc '{med_name}' từ bác sĩ.",
                    type="prescription_updated",
                    category="record",
                    severity="success",
                    actor_id=str(doctor_id) if doctor_id else None,
                    source_table="prescriptions",
                    source_id=str(prescription_id),
                    action_url="/patient/prescriptions"
                )
        elif table == "chat_messages":
            sender_id = record.get("sender_id")
            recipient_id = record.get("recipient_id")
            msg_id = record.get("id")
            msg_text = record.get("message", "")
            snippet = msg_text[:30] + "..." if len(msg_text) > 30 else msg_text
            
            if recipient_id:
                sender_row = await database.fetch_one("SELECT full_name FROM users WHERE id = CAST(:id AS uuid)", {"id": str(sender_id)})
                sender_name = sender_row["full_name"] if sender_row else "Người dùng"
                
                await notification_service.create_notification(
                    user_id=str(recipient_id),
                    title=f"Tin nhắn mới từ {sender_name}",
                    message=snippet,
                    type="chat_received",
                    category="chat",
                    severity="info",
                    actor_id=str(sender_id),
                    source_table="chat_messages",
                    source_id=str(msg_id),
                    action_url="/patient/chat" if current_user["role"] == "doctor" else "/doctor/chat"
                )
    except Exception as e:
        logger.exception("Lỗi khi xử lý trigger_domain_notifications cho table=%s, operation=%s", table, operation)


async def create_record(table: str, payload: dict[str, Any], authorization: Optional[str], request: Optional[Request] = None):
    """Tạo một bản ghi mới với đầy đủ phân quyền và xác thực.

    Áp dụng quyền thao tác, lọc cột (loại trừ các cột được bảo vệ ghi),
    giá trị mặc định ghi và thực thi phạm vi ghi. Ghi nhật ký thao tác
    và kích hoạt phát sóng WebSocket khi thành công.

    Args:
        table: Tên bảng mục tiêu.
        payload: Dữ liệu bản ghi.
        authorization: Token Bearer.
        request: FastAPI Request để trích xuất IP (tùy chọn).

    Returns:
        Bản ghi đã tạo dưới dạng dict an toàn JSON.
    """
    user = await get_user_from_token(authorization)
    enforce_operation_permission(table, user["role"], "create")
    columns = await table_columns(table)
    values = normalize_payload(payload)
    allowed_columns = columns - WRITE_PROTECTED_COLUMNS
    values = {key: value for key, value in values.items() if key in allowed_columns and value is not None}
    values = apply_write_defaults(table, columns, user, values)
    await enforce_write_scope(table, columns, user, values)

    if not values:
        raise HTTPException(status_code=400, detail="No valid columns to insert")

    insert_columns = ", ".join(quote_column(key, columns) for key in values.keys())
    bind_columns = ", ".join(f":{key}" for key in values.keys())
    record_id = values.get("id")
    await database.execute(
        f"INSERT INTO {quote_identifier(table)} ({insert_columns}) VALUES ({bind_columns})",
        values,
    )
    inserted_row = await fetch_authorized_row(table, str(record_id), columns, user)
    await trigger_websocket_broadcast(table, inserted_row)
    await trigger_domain_notifications(table, "create", inserted_row, user)

    # Ghi nhận audit log (tránh ghi log của chính audit_logs để ngăn đệ quy)
    if table != "audit_logs":
        ip_addr = request.client.host if request and request.client else "-"
        await log_activity(
            user_id=user["id"],
            action="CREATE_RECORD",
            entity_type=table,
            entity_id=str(record_id),
            ip_address=ip_addr
        )

    return inserted_row


async def update_record(table: str, record_id: str, payload: dict[str, Any], authorization: Optional[str], request: Optional[Request] = None):
    """Cập nhật một bản ghi hiện có với đầy đủ phân quyền và xác thực.

    Lấy bản ghi hiện tại để xác minh quyền truy cập và áp dụng cập nhật
    một phần (chỉ các trường được cung cấp). Tự động đặt updated_at nếu cột
    tồn tại. Ghi nhật ký thao tác và kích hoạt phát sóng WebSocket.

    Args:
        table: Tên bảng mục tiêu.
        record_id: UUID của bản ghi cần cập nhật.
        payload: Dữ liệu cập nhật một phần.
        authorization: Token Bearer.
        request: FastAPI Request để trích xuất IP (tùy chọn).

    Returns:
        Bản ghi đã cập nhật dưới dạng dict an toàn JSON.
    """
    user = await get_user_from_token(authorization)
    enforce_operation_permission(table, user["role"], "update")
    columns = await table_columns(table)
    current = await fetch_authorized_row(table, record_id, columns, user)
    values = normalize_payload(payload)
    values = {key: value for key, value in values.items() if key in columns and key not in WRITE_PROTECTED_COLUMNS and key != "id"}
    await enforce_write_scope(table, columns, user, values, current)

    if not values:
        return current

    set_sql = ", ".join(f"{quote_column(key, columns)} = :{key}" for key in values.keys())
    if "updated_at" in columns:
        set_sql = f"{set_sql}, \"updated_at\" = NOW()"

    await database.execute(
        f"UPDATE {quote_identifier(table)} SET {set_sql} WHERE \"id\" = CAST(:record_id AS uuid)",
        {**values, "record_id": record_id},
    )
    updated_row = await fetch_authorized_row(table, record_id, columns, user)
    await trigger_websocket_broadcast(table, updated_row)
    await trigger_domain_notifications(table, "update", updated_row, user)

    # Ghi nhận audit log
    if table != "audit_logs":
        ip_addr = request.client.host if request and request.client else "-"
        await log_activity(
            user_id=user["id"],
            action="UPDATE_RECORD",
            entity_type=table,
            entity_id=str(record_id),
            ip_address=ip_addr
        )

    return updated_row


async def delete_record(table: str, record_id: str, authorization: Optional[str], request: Optional[Request] = None):
    """Xóa một bản ghi theo ID với kiểm tra phân quyền.

    Lấy bản ghi để xác minh quyền truy cập và phạm vi ghi trước khi xóa.
    Ghi nhật ký xóa qua audit_service.

    Args:
        table: Tên bảng mục tiêu.
        record_id: UUID của bản ghi cần xóa.
        authorization: Token Bearer.
        request: FastAPI Request để trích xuất IP (tùy chọn).

    Returns:
        Dict xác nhận với deleted=True và ID bản ghi.
    """
    user = await get_user_from_token(authorization)
    enforce_operation_permission(table, user["role"], "delete")
    columns = await table_columns(table)
    current = await fetch_authorized_row(table, record_id, columns, user)
    await enforce_write_scope(table, columns, user, {}, current)
    await database.execute(
        f"DELETE FROM {quote_identifier(table)} WHERE \"id\" = CAST(:record_id AS uuid)",
        {"record_id": record_id},
    )

    # Ghi nhận audit log
    if table != "audit_logs":
        ip_addr = request.client.host if request and request.client else "-"
        await log_activity(
            user_id=user["id"],
            action="DELETE_RECORD",
            entity_type=table,
            entity_id=str(record_id),
            ip_address=ip_addr
        )

    return {"deleted": True, "id": record_id}


async def reports_summary_data(authorization: Optional[str]):
    """Lấy thống kê báo cáo tổng hợp theo loại.

    Admin truy vấn từ một view materialized được tính toán trước để có hiệu suất.
    Bác sĩ/bệnh nhân truy vấn với lọc phân quyền dựa trên vai trò.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict chứa total_reports, danh sách by_type và siêu dữ liệu.
    """
    user = await get_user_from_token(authorization)
    
    if user["role"] == "admin":
        # Tài khoản Admin: Truy vấn trực tiếp từ Materialized View tính toán sẵn (cực nhanh!)
        rows = await database.fetch_all(
            "SELECT report_type, total FROM reports_summary_mv ORDER BY total DESC"
        )
    else:
        # Bác sĩ / Bệnh nhân: Truy vấn có lọc phân quyền bảo mật riêng tư
        report_columns = await table_columns("reports")
        report_access, report_values = access_filter("reports", report_columns, user)
        report_where = f"WHERE {report_access}" if report_access else ""
        rows = await database.fetch_all(
            f"""
            SELECT report_type, COUNT(*)::int AS total
            FROM reports
            {report_where}
            GROUP BY report_type
            ORDER BY total DESC
            """,
            report_values,
        )
        
    total = sum(row["total"] for row in rows)
    return {
        "total_reports": total,
        "by_type": [{ "report_type": row["report_type"], "total": row["total"] } for row in rows],
        "database": "configured",
        "export_pdf": "pending_real_implementation",
    }


def register_table_routes(table: str, path: str, create_model: type, update_model: type) -> None:
    """Đăng ký các tuyến đường GET, POST, GET/:id, PATCH/:id, DELETE/:id cho một bảng.

    Tạo động các hàm endpoint với tham số được chú thích kiểu
    và đăng ký chúng trên router cấp module.

    Args:
        table: Tên bảng cơ sở dữ liệu.
        path: Tiền tố đường dẫn URL cho các tuyến đường.
        create_model: Lớp model Pydantic cho yêu cầu tạo.
        update_model: Lớp model Pydantic cho yêu cầu cập nhật.
    """
    async def list_endpoint(
        authorization: Optional[str] = Header(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
        patient_id: Optional[str] = Query(default=None),
    ):
        return await list_records(table, authorization, limit, offset, patient_id)

    async def create_endpoint(payload: create_model, request: Request, authorization: Optional[str] = Header(default=None)):
        return await create_record(table, payload.model_dump(exclude_unset=True), authorization, request)

    async def get_endpoint(record_id: str, authorization: Optional[str] = Header(default=None)):
        columns = await table_columns(table)
        user = await get_user_from_token(authorization)
        return await fetch_authorized_row(table, record_id, columns, user)

    async def update_endpoint(record_id: str, payload: update_model, request: Request, authorization: Optional[str] = Header(default=None)):
        return await update_record(table, record_id, payload.model_dump(exclude_unset=True), authorization, request)

    async def delete_endpoint(record_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
        return await delete_record(table, record_id, authorization, request)

    router.add_api_route(path, list_endpoint, methods=["GET"], tags=[table])
    router.add_api_route(path, create_endpoint, methods=["POST"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", get_endpoint, methods=["GET"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", update_endpoint, methods=["PATCH"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", delete_endpoint, methods=["DELETE"], tags=[table])


@router.get("/reports/summary", tags=["reports"])
async def reports_summary(authorization: Optional[str] = Header(default=None)):
    """Lấy thống kê báo cáo tổng hợp.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict chứa total_reports và phân tích theo report_type.
    """
    return await reports_summary_data(authorization)


for table_name, config in TABLES.items():
    register_table_routes(table_name, config["path"], config["create"], config["update"])

# Alias routes are registered explicitly so legacy clients that still use
# short resource names keep working. Both canonical and alias paths map to
# the same handlers and should be documented together in API references.
for alias, table_name in ALIASES.items():
    config = TABLES[table_name]
    register_table_routes(table_name, f"/{alias}", config["create"], config["update"])
