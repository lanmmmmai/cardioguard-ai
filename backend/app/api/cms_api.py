"""API Hệ thống Quản lý Nội dung (CMS).

Mục đích:
    Cung cấp giao diện CRUD chung chỉ dành cho admin để quản lý tất cả các
    bảng cơ sở dữ liệu thông qua một REST API thống nhất. Hỗ trợ liệt kê với
    tìm kiếm/lọc/sắp xếp/phân trang, xuất/nhập CSV và các thao tác CRUD ở
    cấp bản ghi. Các thao tác ghi trên các bảng quan trọng (users, patients,
    alerts, sensor_data, v.v.) bị chặn để thực thi logic nghiệp vụ thông qua
    các API chuyên dụng.

Luồng xử lý:
    Mọi endpoint đều yêu cầu xác thực admin. Cấu hình module (CMS_MODULES)
    định nghĩa ánh xạ bảng, các cột ẩn/chỉ đọc/bắt buộc, bí danh và danh
    sách cột CSV. Giới thiệu lược đồ thông qua information_schema
    xây dựng truy vấn động. Việc ép kiểu cột và xác thực được xử lý
    bởi cast_value/validate_payload. Ghi nhật ký kiểm toán được thực hiện
    cho tất cả các thay đổi ngoại trừ trên chính bảng audit_logs (để ngăn
    đệ quy).

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực admin
    - Phụ thuộc vào: services.audit_service để ghi nhật ký hoạt động
    - Phụ thuộc vào: core.sqlalchemy_async cho các phiên SQLAlchemy bất đồng bộ
    - Phụ thuộc vào: core.security/password_policy để xử lý mật khẩu
    - Được sử dụng bởi: Giao diện quản trị để quản lý dữ liệu
"""

import csv
import io
import logging
import os
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from urllib.parse import urlparse
from typing import Any, Optional

from fastapi import APIRouter, File, Header, HTTPException, Query, Response, UploadFile, Request
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
from sqlalchemy import text
from PIL import Image

from app.api.auth_api import get_user_from_token
from app.services.audit_service import log_activity
from app.core.sqlalchemy_async import AsyncSessionLocal
from app.core.password_policy import validate_password
from app.core.security import hash_password

router = APIRouter(prefix="/cms", tags=["cms"])

DOMAIN_LINKS_STORAGE_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "storage", "domain-links")
)
DOMAIN_LINKS_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DOMAIN_LINKS_ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
DOMAIN_LINKS_DEFAULT_PREVIEW = {
    "title": "CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực",
    "description": "CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.",
    "image_url": "https://giatky.site/images/preview.jpg",
}


def _is_within_directory(base_dir: str, candidate_path: str) -> bool:
    """Kiểm tra candidate_path có nằm trong base_dir hay không."""
    base_real = os.path.realpath(base_dir)
    candidate_real = os.path.realpath(candidate_path)
    try:
        return os.path.commonpath([base_real, candidate_real]) == base_real
    except ValueError:
        return False

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
    "domain_links": {
        "table": "domain_links",
        "hidden": {"deleted_at", "cache_version"},
        "readonly": {"id", "created_at", "updated_at", "deleted_at", "cache_version"},
        "required": {"path", "url", "title", "description", "image_url"},
        "aliases": {},
        "csv_columns": ["path", "url", "domain", "title", "description", "image_url", "is_active"],
    },
}

TEXT_TYPES = {"text", "varchar", "bpchar", "citext", "uuid"}
NUMERIC_TYPES = {"int2", "int4", "int8", "float4", "float8", "numeric"}
BOOL_TYPES = {"bool"}
DATE_TYPES = {"date", "timestamp", "timestamptz"}


def module_config(module: str) -> dict[str, Any]:
    """Lấy cấu hình module CMS theo tên.

    Args:
        module: Tên module (ví dụ: 'users', 'devices').

    Returns:
        Dict cấu hình module với table, hidden, readonly, v.v.

    Raises:
        HTTPException 404: Nếu module không được định nghĩa.
    """
    config = CMS_MODULES.get(module.replace("-", "_"))
    if not config:
        raise HTTPException(status_code=404, detail="CMS module not found")
    return config


def ensure_module_write_allowed(module: str) -> None:
    """Chặn ghi CMS trực tiếp trên các module quan trọng.

    Các module này phải sử dụng API chuyên dụng của chúng để đảm bảo
    logic nghiệp vụ và tính toàn vẹn dữ liệu.

    Args:
        module: Tên module cần kiểm tra.

    Raises:
        HTTPException 403: Nếu module nằm trong danh sách bị hạn chế.
    """
    module = module.replace("-", "_")
    # Các module này phải đi qua domain API để giữ nghiệp vụ và toàn vẹn dữ liệu.
    restricted_modules = {
        "users",
        "patients",
        "alerts",
        "sensor_data",
        "prescriptions",
        "medical_records",
        "reports",
    }
    if module in restricted_modules:
        raise HTTPException(
            status_code=403,
            detail=f"Module {module} chỉ cho phép ghi qua domain API để đảm bảo nghiệp vụ an toàn.",
        )


def ensure_domain_links_storage_dir() -> None:
    os.makedirs(DOMAIN_LINKS_STORAGE_ROOT, exist_ok=True)


def normalize_domain_path(value: Optional[str]) -> str:
    raw = (value or "").strip()
    if not raw:
        return "/"
    if "://" in raw:
        parsed = urlparse(raw)
        raw = parsed.path or "/"
    if not raw.startswith("/"):
        raw = f"/{raw}"
    if len(raw) > 1 and raw.endswith("/"):
        raw = raw.rstrip("/")
    return raw or "/"


def normalize_domain_link_payload(values: dict[str, Any]) -> dict[str, Any]:
    """Chuẩn hóa payload domain-links trước khi ghi xuống DB."""
    normalized = dict(values)
    normalized_path = normalize_domain_path(normalized.get("path"))
    normalized["path"] = normalized_path

    raw_url = (normalized.get("url") or "").strip()
    if not raw_url:
        raw_url = f"https://giatky.site{normalized_path}"
    normalized["url"] = raw_url

    parsed = urlparse(raw_url)
    normalized["domain"] = parsed.netloc or (normalized.get("domain") or "").strip()
    return normalized


def get_request_base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def build_public_domain_link_image_url(request: Request, file_name: str) -> str:
    return f"{get_request_base_url(request)}/api/cms/domain-links/images/{file_name}"


def domain_links_default_payload(path: Optional[str], full_url: Optional[str] = None) -> dict[str, Any]:
    normalized_path = normalize_domain_path(path)
    target_url = full_url or f"https://giatky.site{normalized_path}"
    parsed = urlparse(target_url)
    return {
        "id": None,
        "path": normalized_path,
        "url": target_url,
        "domain": parsed.netloc or "giatky.site",
        "title": DOMAIN_LINKS_DEFAULT_PREVIEW["title"],
        "description": DOMAIN_LINKS_DEFAULT_PREVIEW["description"],
        "image_url": DOMAIN_LINKS_DEFAULT_PREVIEW["image_url"],
        "is_active": True,
        "cache_version": 1,
        "resolved_from": "fallback",
    }


async def require_admin(authorization: Optional[str]) -> dict[str, Any]:
    """Xác thực người gọi là người dùng admin.

    Args:
        authorization: Chuỗi token Bearer.

    Returns:
        Dict người dùng admin đã xác thực.

    Raises:
        HTTPException 403: Nếu người dùng không phải là admin.
    """
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access CMS")
    return user


def quote_identifier(value: str) -> str:
    """Đặt dấu ngoặc kép an toàn cho định danh SQL để ngăn chèn.

    Chỉ cho phép ký tự chữ và số và dấu gạch dưới.

    Args:
        value: Chuỗi định danh cần đặt dấu ngoặc kép.

    Returns:
        Định danh được đặt trong dấu ngoặc kép.

    Raises:
        HTTPException 400: Nếu định danh chứa ký tự không hợp lệ.
    """
    if not value.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail=f"Invalid identifier: {value}")
    return f'"{value}"'


_CMS_COLUMNS_CACHE_TTL = 300
_cms_columns_cache: dict[str, tuple[list[dict[str, Any]], float]] = {}


async def get_columns(table: str) -> list[dict[str, Any]]:
    """Lấy siêu dữ liệu cột cho một bảng thông qua information_schema.

    Kết quả được lưu vào bộ nhớ đệm để giảm tải cơ sở dữ liệu.

    Args:
        table: Tên bảng.

    Returns:
        Danh sách dict chứa column_name, udt_name, is_nullable, column_default.

    Raises:
        HTTPException 500: Nếu không tìm thấy bảng.
    """
    cached = _cms_columns_cache.get(table)
    if cached and time.monotonic() - cached[1] < _CMS_COLUMNS_CACHE_TTL:
        return cached[0]
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
    _cms_columns_cache[table] = (cols, time.monotonic())
    return cols


def visible_columns(columns: list[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    """Lọc các cột để chỉ hiển thị những cột không bị ẩn.

    Args:
        columns: Danh sách siêu dữ liệu cột đầy đủ từ get_columns.
        config: Dict cấu hình module.

    Returns:
        Danh sách cột đã lọc với name, type, nullable, readonly.
    """
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
    """Chuyển đổi các kiểu không thể tuần tự hóa thành biểu diễn an toàn JSON.

    Xử lý datetime/date -> chuỗi ISO, UUID -> chuỗi, Decimal -> float.

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
    return value


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Chuyển đổi tất cả giá trị trong một hàng sang kiểu an toàn JSON.

    Args:
        row: Dict hàng cơ sở dữ liệu thô.

    Returns:
        Dict với tất cả giá trị được truyền qua to_jsonable.
    """
    return {key: to_jsonable(value) for key, value in row.items()}


def cast_value(value: Any, column: dict[str, Any]) -> Any:
    """Ép một giá trị thô sang kiểu Python phù hợp cho một cột.

    Xử lý UUID, số nguyên, số thực, boolean, date/timestamp và kiểu văn bản.
    Chuỗi rỗng được chuyển đổi thành None.

    Args:
        value: Giá trị đầu vào thô.
        column: Dict siêu dữ liệu cột với udt_name.

    Returns:
        Giá trị đã ép kiểu phù hợp để chèn vào cơ sở dữ liệu.

    Raises:
        ValueError: Nếu ép kiểu boolean thất bại.
    """
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
    """Xác thực và chuẩn hóa một dict payload để chèn vào cơ sở dữ liệu.

    Giải quyết bí danh, xử lý 'password' ảo -> 'password_hash',
    thực thi các ràng buộc readonly/hidden/required, ép giá trị sang
    đúng kiểu và xác thực các trường email/phone/age.

    Args:
        payload: Dict đầu vào thô.
        columns: Siêu dữ liệu cột từ get_columns.
        config: Dict cấu hình module.
        partial: Nếu True, bỏ qua xác thực trường bắt buộc (cho cập nhật).

    Returns:
        Tuple gồm (normalized_values, error_messages).
    """
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
    """Xây dựng mệnh đề WHERE SQL để tìm kiếm toàn văn trên các cột văn bản.

    Args:
        columns: Danh sách siêu dữ liệu cột.
        query: Chuỗi truy vấn tìm kiếm.
        params: Dict tham số cần thay đổi với giá trị tìm kiếm.

    Returns:
        Chuỗi mệnh đề WHERE SQL (rỗng nếu không có truy vấn hoặc không có cột nào có thể tìm kiếm).
    """
    if not query:
        return ""
    searchable = [column["column_name"] for column in columns if column["udt_name"] in TEXT_TYPES]
    if not searchable:
        return ""
    params["q"] = f"%{query}%"
    return "(" + " OR ".join(f"{quote_identifier(column)}::text ILIKE :q" for column in searchable) + ")"


def build_filters(filter_value: Optional[str], columns: list[dict[str, Any]], params: dict[str, Any]) -> str:
    """Phân tích chuỗi bộ lọc được phân tách bằng dấu phẩy thành mệnh đề WHERE SQL.

    Định dạng: "column1:value1,column2:value2". Các giá trị được ép kiểu
    theo kiểu dữ liệu của cột.

    Args:
        filter_value: Chuỗi bộ lọc (ví dụ: "status:active,role:doctor").
        columns: Danh sách siêu dữ liệu cột.
        params: Dict tham số cần thay đổi với các giá trị bộ lọc.

    Returns:
        Chuỗi mệnh đề WHERE SQL (rỗng nếu không có bộ lọc).

    Raises:
        HTTPException 400: Nếu một cột bộ lọc không xác định.
    """
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


async def fetch_domain_link_by_path(path: Optional[str]) -> Optional[dict[str, Any]]:
    normalized_path = normalize_domain_path(path)
    full_url = f"https://giatky.site{normalized_path}"
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                """
                SELECT id::text as id, path, url, domain, title, description, image_url, is_active, cache_version, created_at, updated_at
                FROM domain_links
                WHERE deleted_at IS NULL
                  AND is_active = TRUE
                  AND (
                        lower(path) = lower(:path)
                        OR lower(url) = lower(:full_url)
                        OR lower(url) LIKE lower(:full_url_like)
                        OR lower(url) LIKE lower(:path_like)
                  )
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {
                "path": normalized_path,
                "full_url": full_url,
                "full_url_like": f"%{full_url.rstrip('/')}",
                "path_like": f"%{normalized_path}",
            },
        )
        row = result.mappings().first()
    return dict(row) if row else None


@router.get("/domain-links/resolve")
async def resolve_domain_link(path: Optional[str] = Query(default="/")):
    link = await fetch_domain_link_by_path(path)
    if not link:
        return domain_links_default_payload(path)
    resolved = dict(link)
    resolved["resolved_from"] = "cms"
    return resolved


@router.get("/domain-links/images/{file_name}")
async def get_domain_link_image(file_name: str):
    ensure_domain_links_storage_dir()
    full_path = os.path.abspath(os.path.join(DOMAIN_LINKS_STORAGE_ROOT, file_name))
    if not _is_within_directory(DOMAIN_LINKS_STORAGE_ROOT, full_path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(full_path)


@router.post("/domain-links/upload-image")
async def upload_domain_link_image(
    request: Request,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    await require_admin(authorization)
    ensure_domain_links_storage_dir()

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in DOMAIN_LINKS_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận ảnh PNG, JPG, JPEG hoặc WEBP")

    if file.content_type not in DOMAIN_LINKS_ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Tệp tải lên phải là ảnh PNG, JPG, JPEG hoặc WEBP")

    content = await file.read()
    size = len(content)
    if size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Kích thước ảnh tối đa là 5MB")

    try:
        image = Image.open(BytesIO(content))
        image.load()
        width, height = image.size
        mime_type = Image.MIME.get(image.format, file.content_type or "application/octet-stream")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Tệp tải lên không phải là ảnh hợp lệ") from exc

    unique_name = f"{uuid.uuid4()}{ext if ext != '.jpeg' else '.jpg'}"
    full_path = os.path.join(DOMAIN_LINKS_STORAGE_ROOT, unique_name)
    with open(full_path, "wb") as handle:
        handle.write(content)

    warning = None
    if (width, height) != (1200, 630):
        warning = "Khuyến nghị ảnh 1200x630 để hiển thị preview tối ưu."

    return {
        "public_url": build_public_domain_link_image_url(request, unique_name),
        "file_name": unique_name,
        "storage_path": f"domain-links/{unique_name}",
        "mime_type": mime_type,
        "size": size,
        "width": width,
        "height": height,
        "warning": warning,
    }


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
    """Liệt kê các bản ghi CMS với tìm kiếm, bộ lọc, sắp xếp và phân trang.

    Giới thiệu lược đồ bảng một cách động, xây dựng truy vấn với
    tìm kiếm toàn văn tùy chọn và bộ lọc cột, và trả về
    kết quả được phân trang kèm siêu dữ liệu cột.

    Args:
        module: Tên module CMS.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.
        limit: Số bản ghi mỗi trang (1-200).
        offset: Độ lệch phân trang.
        q: Truy vấn tìm kiếm toàn văn.
        filter: Bộ lọc cột (định dạng: "col:val,col2:val2").
        sort_by: Cột để sắp xếp.
        sort_dir: Hướng sắp xếp ('asc' hoặc 'desc').

    Returns:
        Dict chứa items, total, limit, offset và siêu dữ liệu cột.
    """
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
    if table == "domain_links" and "deleted_at" in {column["column_name"] for column in columns}:
        where_parts.append("deleted_at IS NULL")
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
    logger.info("CMS list: module=%s admin_id=%s total=%d", module, user["id"], total)
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
    """Xuất các bản ghi CMS ra file CSV (tối đa 200 bản ghi).

    Args:
        module: Tên module CMS.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.
        q: Truy vấn tìm kiếm toàn văn.
        filter: Bộ lọc cột.

    Returns:
        File CSV dưới dạng phản hồi streaming.
    """
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
    """Lấy một bản ghi CMS duy nhất theo ID của nó.

    Args:
        module: Tên module CMS.
        record_id: UUID của bản ghi.
        authorization: Token Bearer.

    Returns:
        Bản ghi dưới dạng dict JSON với các giá trị đã chuẩn hóa.

    Raises:
        HTTPException 404: Nếu không tìm thấy bản ghi.
    """
    await require_admin(authorization)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    visible = visible_columns(columns, config)
    select_sql = ", ".join(quote_identifier(column["name"]) for column in visible)
    async with AsyncSessionLocal() as session:
        if table == "domain_links":
            status_result = await session.execute(
                text("SELECT deleted_at FROM domain_links WHERE id::text = :record_id"),
                {"record_id": record_id},
            )
            status_row = status_result.mappings().first()
            if not status_row or status_row.get("deleted_at") is not None:
                raise HTTPException(status_code=404, detail="Record not found")
        result = await session.execute(
            text(f"SELECT {select_sql} FROM {quote_identifier(table)} WHERE id = CAST(:record_id AS uuid)"),
            {"record_id": record_id},
        )
        row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return normalize_row(dict(row))


@router.post("/{module}")
async def create_cms_record(module: str, payload: dict[str, Any], request: Request, authorization: Optional[str] = Header(default=None)):
    """Tạo một bản ghi CMS mới.

    Xác thực payload, tự động tạo UUID nếu bảng có cột 'id' và chèn
    bản ghi. Bị chặn đối với các module bị hạn chế.

    Args:
        module: Tên module CMS.
        payload: Dữ liệu bản ghi dưới dạng dict JSON.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Bản ghi đã tạo (được lấy qua get_cms_record).

    Raises:
        HTTPException 403: Nếu module bị hạn chế ghi.
        HTTPException 422: Nếu xác thực thất bại.
    """
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    column_names = {column["column_name"] for column in columns}
    values, errors = validate_payload(payload, columns, config)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    if table == "domain_links":
        values = normalize_domain_link_payload(values)
        async with AsyncSessionLocal() as session:
            duplicate = await session.execute(
                text(
                    """
                    SELECT 1
                    FROM domain_links
                    WHERE deleted_at IS NULL
                      AND lower(path) = lower(:path)
                    LIMIT 1
                    """
                ),
                {"path": values.get("path")},
            )
            if duplicate.first():
                raise HTTPException(status_code=422, detail="Path này đã tồn tại cho một domain link đang hoạt động")
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

    logger.info("CMS create: module=%s admin_id=%s record_id=%s", module, user["id"], values.get("id"))
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
    """Cập nhật một bản ghi CMS hiện có (cập nhật một phần).

    Xác thực payload với partial=True (các trường bắt buộc là tùy chọn
    khi cập nhật) và áp dụng các thay đổi. Nếu không có giá trị cập nhật nào,
    trả về bản ghi hiện tại không thay đổi.

    Args:
        module: Tên module CMS.
        record_id: UUID của bản ghi cần cập nhật.
        payload: Dữ liệu bản ghi một phần dưới dạng dict JSON.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Bản ghi đã cập nhật.

    Raises:
        HTTPException 403: Nếu module bị hạn chế ghi.
        HTTPException 422: Nếu xác thực thất bại.
        HTTPException 404: Nếu không tìm thấy bản ghi.
    """
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    columns = await get_columns(table)
    values, errors = validate_payload(payload, columns, config, partial=True)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    if table == "domain_links" and values:
        values = normalize_domain_link_payload(values)
    if not values:
        return await get_cms_record(module, record_id, authorization)
    values["record_id"] = record_id
    async with AsyncSessionLocal() as session:
        if table == "domain_links":
            status_result = await session.execute(
                text("SELECT deleted_at FROM domain_links WHERE id::text = :record_id"),
                {"record_id": record_id},
            )
            status_row = status_result.mappings().first()
            if not status_row or status_row.get("deleted_at") is not None:
                raise HTTPException(status_code=404, detail="Record not found")
            if "path" in values:
                duplicate = await session.execute(
                    text(
                        """
                        SELECT 1
                        FROM domain_links
                        WHERE deleted_at IS NULL
                          AND lower(path) = lower(:path)
                          AND id::text <> :record_id
                        LIMIT 1
                        """
                    ),
                    {"path": values["path"], "record_id": record_id},
                )
                if duplicate.first():
                    raise HTTPException(status_code=422, detail="Path này đã tồn tại cho một domain link đang hoạt động")
        result = await session.execute(
            text(
                f"""
                UPDATE {quote_identifier(table)}
                SET {", ".join(f"{quote_identifier(key)} = :{key}" for key in values.keys() if key != "record_id")}
                WHERE id = CAST(:record_id AS uuid)
                """
            ),
            values,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        await session.commit()

    logger.info("CMS update: module=%s admin_id=%s record_id=%s", module, user["id"], record_id)
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
    """Xóa một bản ghi CMS theo ID.

    Xóa vĩnh viễn bản ghi khỏi cơ sở dữ liệu. Bị chặn đối với
    các module bị hạn chế.

    Args:
        module: Tên module CMS.
        record_id: UUID của bản ghi cần xóa.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Dict xác nhận với deleted=True và ID bản ghi.

    Raises:
        HTTPException 403: Nếu module bị hạn chế ghi.
        HTTPException 404: Nếu không tìm thấy bản ghi.
    """
    user = await require_admin(authorization)
    ensure_module_write_allowed(module)
    config = module_config(module)
    table = config["table"]
    if table == "domain_links":
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text(
                    f"""
                    UPDATE {quote_identifier(table)}
                    SET deleted_at = NOW(), is_active = FALSE
                    WHERE id::text = :record_id
                    """
                ),
                {"record_id": record_id},
            )
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Record not found")
            await session.commit()
        if table != "audit_logs":
            await log_activity(
                user_id=user["id"],
                action="CMS_DELETE_RECORD",
                entity_type=table,
                entity_id=record_id,
                ip_address=request.client.host if request.client else "-"
            )
        logger.info("CMS delete (soft): module=%s admin_id=%s record_id=%s", module, user["id"], record_id)
        return {"deleted": True, "id": record_id, "soft_deleted": True}

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(f"DELETE FROM {quote_identifier(table)} WHERE id = CAST(:record_id AS uuid)"),
            {"record_id": record_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        await session.commit()

    logger.info("CMS delete: module=%s admin_id=%s record_id=%s", module, user["id"], record_id)
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
    """Nhập bản ghi từ file CSV vào một module CMS.

    Phân tích CSV, xác thực từng hàng và chèn chúng trong một giao dịch
    duy nhất. Nếu bất kỳ hàng nào có lỗi xác thực, toàn bộ quá trình nhập
    sẽ bị hoàn tác và lỗi được trả về. Bị chặn đối với các module bị hạn chế.

    Args:
        module: Tên module CMS.
        request: FastAPI Request để trích xuất IP.
        file: File CSV đã tải lên.
        authorization: Token Bearer.

    Returns:
        Dict chứa số lượng đã nhập và danh sách lỗi.
    """
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
