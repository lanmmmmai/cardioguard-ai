import csv
import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, File, Header, HTTPException, Query, Response, UploadFile, Request
from sqlalchemy import text

from app.api.auth_api import get_user_from_token
from app.services.audit_service import log_activity
from app.core.sqlalchemy_async import AsyncSessionLocal
from app.core.password_policy import validate_password
from app.core.security import hash_password

router = APIRouter(prefix="/cms", tags=["cms"])

CMS_MODULES = {
    "users": {
        "table": "users",
        "hidden": {"password_hash"},
        "readonly": {"id", "created_at", "password_hash"},
        "required": {"email", "full_name", "role", "password"},
        "aliases": {},
        "virtual": {"password"},
    },
    "patients": {
        "table": "patients",
        "hidden": set(),
        "readonly": {"id", "created_at"},
        "required": {"full_name"},
        "aliases": {},
        "csv_columns": ["full_name", "age", "gender", "phone", "address", "medical_history"],
    },
    "devices": {
        "table": "devices",
        "hidden": set(),
        "readonly": {"id", "created_at", "updated_at"},
        "required": set(),
        "aliases": {"device_name": "name", "battery_level": "battery"},
        "csv_columns": ["device_name", "serial_number", "status", "battery_level"],
    },
    "cameras": {
        "table": "cameras",
        "hidden": set(),
        "readonly": {"id", "created_at", "updated_at"},
        "required": set(),
        "aliases": {"camera_name": "name", "assigned_patient_id": "patient_id"},
        "csv_columns": ["camera_name", "location", "stream_url", "status", "assigned_patient_id"],
    },
    "alerts": {"table": "alerts", "hidden": set(), "readonly": {"id", "created_at"}, "required": set(), "aliases": {}},
    "sensor_data": {
        "table": "sensor_data",
        "hidden": set(),
        "readonly": {"id"},
        "required": set(),
        "aliases": {},
        "csv_columns": ["heart_rate", "spo2", "systolic_bp", "diastolic_bp", "ecg_value", "created_at"],
    },
    "appointments": {"table": "appointments", "hidden": set(), "readonly": {"id", "created_at", "updated_at"}, "required": set(), "aliases": {}},
    "prescriptions": {"table": "prescriptions", "hidden": set(), "readonly": {"id", "created_at", "updated_at"}, "required": set(), "aliases": {}},
    "medical_records": {"table": "medical_records", "hidden": set(), "readonly": {"id", "created_at", "updated_at"}, "required": set(), "aliases": {}},
    "notifications": {"table": "notifications", "hidden": set(), "readonly": {"id", "created_at", "updated_at"}, "required": set(), "aliases": {}},
    "reports": {"table": "reports", "hidden": set(), "readonly": {"id", "created_at", "updated_at"}, "required": set(), "aliases": {}},
}

TEXT_TYPES = {"text", "varchar", "bpchar", "citext", "uuid"}
NUMERIC_TYPES = {"int2", "int4", "int8", "float4", "float8", "numeric"}
BOOL_TYPES = {"bool"}
DATE_TYPES = {"date", "timestamp", "timestamptz"}


def module_config(module: str) -> dict[str, Any]:
    config = CMS_MODULES.get(module)
    if not config:
        raise HTTPException(status_code=404, detail="CMS module not found")
    return config


def ensure_module_write_allowed(module: str) -> None:
    # users phải đi qua user_api để giữ đồng bộ patients + soft-delete policy
    if module == "users":
        raise HTTPException(
            status_code=403,
            detail="Module users chỉ cho phép ghi qua /admin/users để đảm bảo nghiệp vụ an toàn.",
        )


async def require_admin(authorization: Optional[str]) -> dict[str, Any]:
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access CMS")
    return user


def quote_identifier(value: str) -> str:
    if not value.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail=f"Invalid identifier: {value}")
    return f'"{value}"'


_cms_columns_cache: dict[str, list[dict[str, Any]]] = {}


async def get_columns(table: str) -> list[dict[str, Any]]:
    if table in _cms_columns_cache:
        return _cms_columns_cache[table]
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                """
                SELECT column_name, udt_name, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :table
                ORDER BY ordinal_position
                """
            ),
            {"table": table},
        )
        rows = result.mappings().all()
    if not rows:
        raise HTTPException(status_code=500, detail=f"Table {table} not found")
    cols = [dict(row) for row in rows]
    _cms_columns_cache[table] = cols
    return cols


def visible_columns(columns: list[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    hidden = config.get("hidden", set())
    readonly = config.get("readonly", set())
    return [
        {
            "name": column["column_name"],
            "type": column["udt_name"],
            "nullable": column["is_nullable"] == "YES",
            "readonly": column["column_name"] in readonly,
        }
        for column in columns
        if column["column_name"] not in hidden
    ]


def to_jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    return value


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: to_jsonable(value) for key, value in row.items()}


def cast_value(value: Any, column: dict[str, Any]) -> Any:
    if value == "":
        return None
    column_type = column["udt_name"]
    if value is None:
        return None
    if column_type == "uuid":
        return str(uuid.UUID(str(value)))
    if column_type in {"int2", "int4", "int8"}:
        return int(value)
    if column_type in {"float4", "float8", "numeric"}:
        return float(value)
    if column_type == "bool":
        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return True
        if normalized in {"false", "0", "no", "n"}:
            return False
        raise ValueError("Invalid boolean")
    if column_type in DATE_TYPES:
        return str(value).strip()
    return str(value).strip()


def validate_payload(payload: dict[str, Any], columns: list[dict[str, Any]], config: dict[str, Any], partial: bool = False) -> tuple[dict[str, Any], list[str]]:
    column_map = {column["column_name"]: column for column in columns}
    readonly = set(config.get("readonly", set()))
    hidden = set(config.get("hidden", set()))
    required = set(config.get("required", set()))
    aliases = config.get("aliases", {})
    normalized = {}
    for key, value in payload.items():
        alias_target = aliases.get(key, key)
        normalized[alias_target if alias_target in column_map else key] = value
    values: dict[str, Any] = {}
    errors: list[str] = []

    for key, value in normalized.items():
        if key == "password" and "password_hash" in column_map:
            try:
                values["password_hash"] = hash_password(validate_password(str(value or "")))
            except ValueError as exc:
                errors.append(str(exc))
            continue
        if key not in column_map:
            errors.append(f"Unknown column: {key}")
            continue
        if key in readonly or key in hidden:
            continue
        try:
            values[key] = cast_value(value, column_map[key])
        except (TypeError, ValueError) as exc:
            errors.append(f"{key}: {exc}")

    if not partial:
        for key in required:
            if key == "password":
                if "password_hash" in column_map and not values.get("password_hash"):
                    errors.append("password is required")
                continue
            if key in column_map and not values.get(key):
                errors.append(f"{key} is required")

    if "email" in values and values["email"] and "@" not in values["email"]:
        errors.append("email must be valid")
    if "phone" in values and values["phone"] and len(str(values["phone"])) < 7:
        errors.append("phone must be at least 7 characters")
    for key in ("age", "battery", "battery_level"):
        real_key = config.get("aliases", {}).get(key, key)
        if real_key in values and values[real_key] is not None and (values[real_key] < 0 or values[real_key] > 130):
            errors.append(f"{key} is out of range")

    return values, errors


def build_search(columns: list[dict[str, Any]], query: Optional[str], params: dict[str, Any]) -> str:
    if not query:
        return ""
    searchable = [column["column_name"] for column in columns if column["udt_name"] in TEXT_TYPES]
    if not searchable:
        return ""
    params["q"] = f"%{query}%"
    return "(" + " OR ".join(f"{quote_identifier(column)}::text ILIKE :q" for column in searchable) + ")"


def build_filters(filter_value: Optional[str], columns: list[dict[str, Any]], params: dict[str, Any]) -> str:
    if not filter_value:
        return ""
    column_map = {column["column_name"]: column for column in columns}
    clauses = []
    for index, item in enumerate(filter_value.split(",")):
        if ":" not in item:
            continue
        key, value = item.split(":", 1)
        key = key.strip()
        if key not in column_map:
            raise HTTPException(status_code=400, detail=f"Unknown filter column: {key}")
        param_name = f"filter_{index}"
        params[param_name] = cast_value(value.strip(), column_map[key])
        clauses.append(f"{quote_identifier(key)} = :{param_name}")
    return " AND ".join(clauses)


@router.get("/{module}")
async def list_cms_records(
    module: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: Optional[str] = Query(default=None),
    filter: Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default=None),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    user = await require_admin(authorization)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    visible = visible_columns(columns, config)
    visible_names = {column["name"] for column in visible}
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    where_parts = [
        part for part in (
            build_search(columns, q, params),
            build_filters(filter, columns, params),
        )
        if part
    ]
    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    sort_column = sort_by if sort_by in {column["column_name"] for column in columns} else "created_at" if "created_at" in {column["column_name"] for column in columns} else "id"
    select_sql = ", ".join(quote_identifier(column) for column in visible_names)

    async with AsyncSessionLocal() as session:
        total_result = await session.execute(text(f"SELECT COUNT(*) FROM {quote_identifier(table)} {where_sql}"), params)
        total = int(total_result.scalar() or 0)
        rows_result = await session.execute(
            text(
                f"""
                SELECT {select_sql}
                FROM {quote_identifier(table)}
                {where_sql}
                ORDER BY {quote_identifier(sort_column)} {sort_dir.upper()}
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
        items = [normalize_row(dict(row)) for row in rows_result.mappings().all()]

    # Ghi nhận log (tránh ghi log audit_logs để ngăn đệ quy)
    if table != "audit_logs":
        await log_activity(
            user_id=user["id"],
            action="CMS_VIEW_LIST",
            entity_type=table,
            ip_address=request.client.host if request.client else "-"
        )

    return {"items": items, "total": total, "limit": limit, "offset": offset, "columns": visible}


@router.get("/{module}/export-csv")
async def export_cms_csv(
    module: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    q: Optional[str] = Query(default=None),
    filter: Optional[str] = Query(default=None),
):
    user = await require_admin(authorization)
    data = await list_cms_records(module, request, authorization, limit=200, offset=0, q=q, filter=filter, sort_by=None, sort_dir="desc")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[column["name"] for column in data["columns"]])
    writer.writeheader()
    writer.writerows(data["items"])

    # Ghi nhận log xuất CSV dữ liệu y tế nhạy cảm
    await log_activity(
        user_id=user["id"],
        action="CMS_EXPORT_CSV",
        entity_type=module_config(module)["table"],
        ip_address=request.client.host if request.client else "-"
    )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{module}.csv"'},
    )


@router.get("/{module}/{record_id}")
async def get_cms_record(module: str, record_id: str, authorization: Optional[str] = Header(default=None)):
    await require_admin(authorization)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    visible = visible_columns(columns, config)
    select_sql = ", ".join(quote_identifier(column["name"]) for column in visible)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(f"SELECT {select_sql} FROM {quote_identifier(table)} WHERE id::text = :record_id"),
            {"record_id": record_id},
        )
        row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return normalize_row(dict(row))


@router.post("/{module}")
async def create_cms_record(module: str, payload: dict[str, Any], request: Request, authorization: Optional[str] = Header(default=None)):
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    column_names = {column["column_name"] for column in columns}
    values, errors = validate_payload(payload, columns, config)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    if "id" in column_names and "id" not in values:
        values["id"] = str(uuid.uuid4())
    if not values:
        raise HTTPException(status_code=422, detail="No valid data to insert")
    keys = list(values.keys())
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                f"""
                INSERT INTO {quote_identifier(table)} ({", ".join(quote_identifier(key) for key in keys)})
                VALUES ({", ".join(f":{key}" for key in keys)})
                """
            ),
            values,
        )
        await session.commit()

    # Ghi nhận log tạo bản ghi
    if table != "audit_logs":
        await log_activity(
            user_id=user["id"],
            action="CMS_CREATE_RECORD",
            entity_type=table,
            entity_id=str(values.get("id")),
            ip_address=request.client.host if request.client else "-"
        )

    return await get_cms_record(module, str(values.get("id")), authorization)


@router.put("/{module}/{record_id}")
async def update_cms_record(module: str, record_id: str, payload: dict[str, Any], request: Request, authorization: Optional[str] = Header(default=None)):
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    values, errors = validate_payload(payload, columns, config, partial=True)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    if not values:
        return await get_cms_record(module, record_id, authorization)
    values["record_id"] = record_id
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                f"""
                UPDATE {quote_identifier(table)}
                SET {", ".join(f"{quote_identifier(key)} = :{key}" for key in values.keys() if key != "record_id")}
                WHERE id::text = :record_id
                """
            ),
            values,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        await session.commit()

    # Ghi nhận log cập nhật bản ghi
    if table != "audit_logs":
        await log_activity(
            user_id=user["id"],
            action="CMS_UPDATE_RECORD",
            entity_type=table,
            entity_id=record_id,
            ip_address=request.client.host if request.client else "-"
        )

    return await get_cms_record(module, record_id, authorization)


@router.delete("/{module}/{record_id}")
async def delete_cms_record(module: str, record_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(f"DELETE FROM {quote_identifier(table)} WHERE id::text = :record_id"),
            {"record_id": record_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        await session.commit()

    # Ghi nhận log xóa bản ghi
    if table != "audit_logs":
        await log_activity(
            user_id=user["id"],
            action="CMS_DELETE_RECORD",
            entity_type=table,
            entity_id=record_id,
            ip_address=request.client.host if request.client else "-"
        )

    return {"deleted": True, "id": record_id}


@router.post("/{module}/import-csv")
async def import_cms_csv(module: str, request: Request, file: UploadFile = File(...), authorization: Optional[str] = Header(default=None)):
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    column_names = {column["column_name"] for column in columns}
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV file is empty")

    aliases = config.get("aliases", {})
    allowed_names = (set(column_names) | set(aliases.keys()) | set(config.get("virtual", set()))) - set(config.get("hidden", set())) - set(config.get("readonly", set()))
    invalid_columns = [column for column in reader.fieldnames if column not in allowed_names]
    if invalid_columns:
        raise HTTPException(status_code=422, detail=[f"Invalid CSV column: {column}" for column in invalid_columns])

    imported = 0
    row_errors = []
    async with AsyncSessionLocal() as session:
        for index, raw_row in enumerate(reader, start=2):
            values, errors = validate_payload(raw_row, columns, config)
            if errors:
                row_errors.append({"row": index, "errors": errors})
                continue
            if "id" in column_names and "id" not in values:
                values["id"] = str(uuid.uuid4())
            if not values:
                row_errors.append({"row": index, "errors": ["No valid data"]})
                continue
            keys = list(values.keys())
            await session.execute(
                text(
                    f"""
                    INSERT INTO {quote_identifier(table)} ({", ".join(quote_identifier(key) for key in keys)})
                    VALUES ({", ".join(f":{key}" for key in keys)})
                    """
                ),
                values,
            )
            imported += 1
        if row_errors:
            await session.rollback()
            return {"imported": 0, "errors": row_errors}
        await session.commit()

    # Ghi nhận log nhập dữ liệu hàng loạt từ CSV
    await log_activity(
        user_id=user["id"],
        action="CMS_IMPORT_CSV",
        entity_type=table,
        ip_address=request.client.host if request.client else "-"
    )

    return {"imported": imported, "errors": []}
