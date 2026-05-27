import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.api.auth_api import get_user_from_token
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
)

router = APIRouter()

TABLES = {
    "appointments": {"path": "/appointments", "create": AppointmentCreate, "update": AppointmentUpdate},
    "medical_records": {"path": "/medical-records", "create": MedicalRecordCreate, "update": MedicalRecordUpdate},
    "prescriptions": {"path": "/prescriptions", "create": PrescriptionCreate, "update": PrescriptionUpdate},
    "devices": {"path": "/devices", "create": DeviceCreate, "update": DeviceUpdate},
    "notifications": {"path": "/notifications", "create": NotificationCreate, "update": NotificationUpdate},
    "chat_messages": {"path": "/chat-messages", "create": ChatMessageCreate, "update": ChatMessageUpdate},
    "audit_logs": {"path": "/audit-logs", "create": AuditLogCreate, "update": AuditLogUpdate},
    "cameras": {"path": "/cameras", "create": CameraCreate, "update": CameraUpdate},
    "reports": {"path": "/reports", "create": ReportCreate, "update": ReportUpdate},
}

ALIASES = {
    "iot-devices": "devices",
    "chat": "chat_messages",
}

WRITE_PROTECTED_COLUMNS = {"created_at", "updated_at"}
_column_cache: dict[str, set[str]] = {}


def quote_identifier(value: str) -> str:
    if value not in TABLES:
        raise HTTPException(status_code=404, detail="Unknown table")
    return f'"{value}"'


def quote_column(value: str, columns: set[str]) -> str:
    if value not in columns:
        raise HTTPException(status_code=400, detail=f"Unknown column: {value}")
    return f'"{value}"'


def to_jsonable(value: Any) -> Any:
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
    if table in _column_cache:
        return _column_cache[table]

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

    _column_cache[table] = columns
    return columns


def row_to_dict(row: Any) -> dict[str, Any]:
    return {key: to_jsonable(row[key]) for key in row.keys()}


def access_filter(table: str, columns: set[str], user: dict[str, str], prefix: str = "") -> tuple[str, dict[str, Any]]:
    role = user["role"]
    user_id = user["id"]
    col = lambda name: f"{prefix}{quote_column(name, columns)}"

    if role == "admin":
        return "", {}

    clauses = []
    if "patient_id" in columns:
        if role == "patient":
            clauses.append(f"{col('patient_id')}::text = :current_user_id")
        elif role == "doctor":
            clauses.append(
                f"""EXISTS (
                    SELECT 1 FROM doctor_patient dp
                    WHERE dp.doctor_id::text = :current_user_id
                    AND dp.patient_id::text = {col('patient_id')}::text
                )"""
            )

    if table == "notifications" and "user_id" in columns:
        clauses.append(f"{col('user_id')}::text = :current_user_id")

    if table == "chat_messages":
        for owner_column in ("sender_id", "recipient_id"):
            if owner_column in columns:
                clauses.append(f"{col(owner_column)}::text = :current_user_id")
        if role == "doctor" and "doctor_id" in columns:
            clauses.append(f"{col('doctor_id')}::text = :current_user_id")

    if table == "audit_logs" and "user_id" in columns:
        clauses.append(f"{col('user_id')}::text = :current_user_id")

    if not clauses:
        return "1 = 0", {"current_user_id": user_id}

    return f"({' OR '.join(clauses)})", {"current_user_id": user_id}


async def ensure_doctor_patient_access(doctor_id: str, patient_id: Any) -> None:
    if not patient_id:
        raise HTTPException(status_code=403, detail="Doctor requests must include an assigned patient_id")
    row = await database.fetch_one(
        """
        SELECT 1
        FROM doctor_patient
        WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id
        """,
        {"doctor_id": doctor_id, "patient_id": str(patient_id)},
    )
    if not row:
        raise HTTPException(status_code=403, detail="Doctor is not assigned to this patient")


async def enforce_write_scope(table: str, columns: set[str], user: dict[str, str], payload: dict[str, Any], current: dict[str, Any] | None = None) -> None:
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
    access_sql, values = access_filter(table, columns, user)
    where_sql = f'"id"::text = :record_id'
    if access_sql:
        where_sql = f"{where_sql} AND {access_sql}"

    row = await database.fetch_one(
        f"SELECT * FROM {quote_identifier(table)} WHERE {where_sql}",
        {**values, "record_id": record_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return row_to_dict(row)


async def list_records(table: str, authorization: str | None, limit: int, offset: int, patient_id: str | None = None):
    user = await get_user_from_token(authorization)
    columns = await table_columns(table)
    access_sql, values = access_filter(table, columns, user)
    where_parts = [access_sql] if access_sql else []

    if patient_id:
        if "patient_id" not in columns:
            raise HTTPException(status_code=400, detail="This table does not support patient_id filtering")
        where_parts.append('"patient_id"::text = :patient_id')
        values["patient_id"] = patient_id

    order_column = "created_at" if "created_at" in columns else "updated_at" if "updated_at" in columns else "id"
    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    rows = await database.fetch_all(
        f"""
        SELECT *
        FROM {quote_identifier(table)}
        {where_sql}
        ORDER BY {quote_column(order_column, columns)} DESC
        LIMIT :limit OFFSET :offset
        """,
        {**values, "limit": limit, "offset": offset},
    )
    return [row_to_dict(row) for row in rows]


async def create_record(table: str, payload: dict[str, Any], authorization: str | None):
    user = await get_user_from_token(authorization)
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
    return await fetch_authorized_row(table, str(record_id), columns, user)


async def update_record(table: str, record_id: str, payload: dict[str, Any], authorization: str | None):
    user = await get_user_from_token(authorization)
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
        f"UPDATE {quote_identifier(table)} SET {set_sql} WHERE \"id\"::text = :record_id",
        {**values, "record_id": record_id},
    )
    return await fetch_authorized_row(table, record_id, columns, user)


async def delete_record(table: str, record_id: str, authorization: str | None):
    user = await get_user_from_token(authorization)
    columns = await table_columns(table)
    current = await fetch_authorized_row(table, record_id, columns, user)
    await enforce_write_scope(table, columns, user, {}, current)
    await database.execute(
        f"DELETE FROM {quote_identifier(table)} WHERE \"id\"::text = :record_id",
        {"record_id": record_id},
    )
    return {"deleted": True, "id": record_id}


async def reports_summary_data(authorization: str | None):
    user = await get_user_from_token(authorization)
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
    async def list_endpoint(
        authorization: str | None = Header(default=None),
        limit: int = Query(default=100, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
        patient_id: str | None = Query(default=None),
    ):
        return await list_records(table, authorization, limit, offset, patient_id)

    async def create_endpoint(payload: create_model, authorization: str | None = Header(default=None)):  # type: ignore[valid-type]
        return await create_record(table, payload.model_dump(exclude_unset=True), authorization)

    async def get_endpoint(record_id: str, authorization: str | None = Header(default=None)):
        columns = await table_columns(table)
        user = await get_user_from_token(authorization)
        return await fetch_authorized_row(table, record_id, columns, user)

    async def update_endpoint(record_id: str, payload: update_model, authorization: str | None = Header(default=None)):  # type: ignore[valid-type]
        return await update_record(table, record_id, payload.model_dump(exclude_unset=True), authorization)

    async def delete_endpoint(record_id: str, authorization: str | None = Header(default=None)):
        return await delete_record(table, record_id, authorization)

    router.add_api_route(path, list_endpoint, methods=["GET"], tags=[table])
    router.add_api_route(path, create_endpoint, methods=["POST"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", get_endpoint, methods=["GET"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", update_endpoint, methods=["PATCH"], tags=[table])
    router.add_api_route(f"{path}/{{record_id}}", delete_endpoint, methods=["DELETE"], tags=[table])


@router.get("/reports/summary", tags=["reports"])
async def reports_summary(authorization: str | None = Header(default=None)):
    return await reports_summary_data(authorization)


for table_name, config in TABLES.items():
    register_table_routes(table_name, config["path"], config["create"], config["update"])

for alias, table_name in ALIASES.items():
    config = TABLES[table_name]
    register_table_routes(table_name, f"/{alias}", config["create"], config["update"])
