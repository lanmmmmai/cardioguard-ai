"""API Quản lý Người dùng và Quản trị.

Mục đích:
    Quản lý hồ sơ người dùng (tự phục vụ cho hồ sơ/mật khẩu của chính mình), hồ sơ
    bệnh nhân (xem/cập nhật của chính mình), phân công bác sĩ-bệnh nhân (chỉ admin),
    quản trị người dùng (CRUD bởi admin), xem nhật ký kiểm toán (chỉ admin)
    và giám sát hiệu suất cơ sở dữ liệu (chỉ admin).

Luồng xử lý:
    Người dùng có thể cập nhật hồ sơ của chính họ (full_name, phone) và mật khẩu
    (kèm xác thực mật khẩu hiện tại). Bệnh nhân có thể xem và cập nhật
    hồ sơ mở rộng của họ (tuổi, giới tính, địa chỉ, v.v.) với tự động tạo
    nếu chưa có hồ sơ. Admin có thể liệt kê/tạo/cập nhật/xóa mềm người dùng,
    quản lý phân công bác sĩ-bệnh nhân, xem nhật ký kiểm toán và kiểm tra
    thống kê hiệu suất DB. Thay đổi mật khẩu thu hồi token JWT hiện tại.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Phụ thuộc vào: auth_api.extract_bearer_token cho thao tác token
    - Phụ thuộc vào: core.database để truy cập DB
    - Phụ thuộc vào: core.security để băm mật khẩu và thao tác JWT
    - Phụ thuộc vào: services.audit_service để ghi nhật ký hoạt động
    - Bảng: users, patients, doctor_patient, audit_logs
"""

import asyncio
import json
import logging
import time
from typing import Any, Optional, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request

logger = logging.getLogger(__name__)
from jose import jwt

from app.api.auth_api import get_user_from_token, extract_bearer_token
from app.services.audit_service import log_activity
from app.core.database import database
from app.core.security import hash_password, verify_password, ALGORITHM, SECRET_KEY
from app.schemas.user_schema import PasswordUpdate, PatientMeUpdate, UserMeUpdate, UserAdminCreate, UserAdminUpdate

router = APIRouter()

_COLUMN_CACHE_TTL = 3600  # 1 hour
_column_cache: dict[str, tuple[set[str], float]] = {}
_column_cache_lock = asyncio.Lock()


async def table_columns(table: str) -> set[str]:
    """Lấy tập hợp tên cột cho một bảng, có bộ nhớ đệm với TTL.

    Args:
        table: Tên bảng.

    Returns:
        Tập hợp các chuỗi tên cột.

    Raises:
        HTTPException 500: Nếu không tìm thấy bảng.
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
    if not columns:
        raise HTTPException(status_code=500, detail=f"Table {table} not found")

    async with _column_cache_lock:
        _column_cache[table] = (columns, time.monotonic())
    return columns


def row_to_dict(row: Optional[Any]) -> Optional[Dict[str, Any]]:
    """Chuyển đổi một hàng cơ sở dữ liệu thành dict thuần.

    Args:
        row: Đối tượng hàng cơ sở dữ liệu hoặc None.

    Returns:
        Biểu diễn dict hoặc None nếu đầu vào là None.
    """
    if not row:
        return None
    result: Dict[str, Any] = {}
    for key in row.keys():
        value = row[key]
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            result[key] = value.astimezone(timezone.utc).isoformat()
        else:
            result[key] = value
    return result


async def fetch_current_user(user_id: str) -> dict[str, Any]:
    """Lấy hồ sơ người dùng hiện tại từ bảng users.

    Chọn động các cột dựa trên lược đồ bảng.

    Args:
        user_id: UUID của người dùng.

    Returns:
        Dict hồ sơ người dùng với id, full_name, email, phone, role, v.v.

    Raises:
        HTTPException 404: Nếu không tìm thấy người dùng.
    """
    columns = await table_columns("users")
    select_columns = [
        "id::text as id",
        "full_name",
        "email",
        "phone" if "phone" in columns else "NULL::text as phone",
        "role",
        "created_at" if "created_at" in columns else "NULL::timestamptz as created_at",
        "status" if "status" in columns else "NULL::text as status",
        "avatar_url" if "avatar_url" in columns else "NULL::text as avatar_url",
    ]
    row = await database.fetch_one(
        f"""
        SELECT {", ".join(select_columns)}
        FROM users
        WHERE id = CAST(:user_id AS uuid)
        """,
        {"user_id": user_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    return row_to_dict(row) or {}


async def fetch_patient_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Lấy hồ sơ mở rộng của bệnh nhân từ bảng patients.

    Chọn động các cột và điều kiện kết dựa trên lược đồ.

    Args:
        user_id: UUID của bệnh nhân.

    Returns:
        Dict hồ sơ bệnh nhân hoặc None nếu không tồn tại hồ sơ.
    """
    columns = await table_columns("patients")
    select_columns = [
        "id::text as id",
        "full_name",
        "age" if "age" in columns else "NULL::int as age",
        "gender" if "gender" in columns else "NULL::text as gender",
        "phone" if "phone" in columns else "NULL::text as phone",
        "address" if "address" in columns else "NULL::text as address",
        "medical_history" if "medical_history" in columns else "NULL::text as medical_history",
        "created_at" if "created_at" in columns else "NULL::timestamptz as created_at",
    ]
    where_sql = "user_id = CAST(:user_id AS uuid)" if "user_id" in columns else "id = CAST(:user_id AS uuid)"
    row = await database.fetch_one(
        f"""
        SELECT {", ".join(select_columns)}
        FROM patients
        WHERE {where_sql}
        LIMIT 1
        """,
        {"user_id": user_id},
    )
    return row_to_dict(row)


@router.put("/users/me")
async def update_user_me(payload: UserMeUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Cập nhật hồ sơ của người dùng đã xác thực.

    Chỉ cho phép cập nhật full_name và phone. Các trường khác bị bỏ qua.

    Args:
        payload: UserMeUpdate với full_name và phone tùy chọn.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Dict chứa hồ sơ người dùng đã cập nhật.
    """
    current_user = await get_user_from_token(
        authorization,
        allow_uncompleted=True,
        allow_unverified=True,
    )
    columns = await table_columns("users")
    values = payload.model_dump(exclude_unset=True)
    update_values = {key: value for key, value in values.items() if key in {"full_name", "phone", "avatar_url"} and key in columns}

    if not update_values:
        return {"user": await fetch_current_user(current_user["id"])}

    set_sql = ", ".join(f"{key} = :{key}" for key in update_values.keys())
    await database.execute(
        f"UPDATE users SET {set_sql} WHERE id = CAST(:user_id AS uuid)",
        {**update_values, "user_id": current_user["id"]},
    )

    logger.info("Người dùng đã cập nhật hồ sơ: user_id=%s", current_user["id"])
    await log_activity(
        user_id=current_user["id"],
        action="USER_UPDATE_PROFILE",
        entity_type="users",
        entity_id=current_user["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return {"user": await fetch_current_user(current_user["id"])}


@router.put("/users/me/password")
async def update_user_password(payload: PasswordUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Thay đổi mật khẩu của người dùng đã xác thực.

    Xác thực mật khẩu hiện tại, cập nhật sang mật khẩu mới, xóa
    cờ must_change_password và thu hồi token hiện tại để người
    dùng phải đăng nhập lại.

    Args:
        payload: PasswordUpdate với current_password và new_password.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Tin nhắn thành công.

    Raises:
        HTTPException 403: Nếu mật khẩu hiện tại không chính xác.
    """
    current_user = await get_user_from_token(
        authorization,
        allow_must_change_password=True,
    )
    row = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id = CAST(:user_id AS uuid)",
        {"user_id": current_user["id"]},
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    if not verify_password(payload.current_password, row["password_hash"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    await database.execute(
        "UPDATE users SET password_hash = :password_hash, must_change_password = FALSE WHERE id = CAST(:user_id AS uuid)",
        {"password_hash": hash_password(payload.new_password), "user_id": current_user["id"]},
    )

    if authorization:
        try:
            token = extract_bearer_token(authorization)
            payload_decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload_decoded.get("jti")
            exp = payload_decoded.get("exp")
            if jti and exp:
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                await database.execute(
                    "INSERT INTO revoked_tokens (jti, expires_at) VALUES (:jti, :exp) ON CONFLICT DO NOTHING",
                    {"jti": jti, "exp": expires_at}
                )
        except Exception:
            pass

    logger.info("Người dùng đã thay đổi mật khẩu: user_id=%s", current_user["id"])
    await log_activity(
        user_id=current_user["id"],
        action="USER_PASSWORD_CHANGE",
        entity_type="users",
        entity_id=current_user["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return {"message": "Password updated successfully"}


@router.get("/patients/me")
async def get_patient_me(authorization: Optional[str] = Header(default=None)):
    """Lấy hồ sơ mở rộng của bệnh nhân đã xác thực.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict chứa hồ sơ bệnh nhân hoặc None nếu không tìm thấy.

    Raises:
        HTTPException 403: Nếu người dùng không phải là bệnh nhân.
    """
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access patient profile")

    profile = await fetch_patient_profile(current_user["id"])
    if not profile:
        return {"patient": None}
    return {"patient": profile}


@router.put("/patients/me")
async def update_patient_me(payload: PatientMeUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Cập nhật hồ sơ mở rộng của bệnh nhân đã xác thực.

    Cập nhật hồ sơ hiện có hoặc tạo mới nếu chưa có. Các trường
    được phép: full_name, age, gender, phone, address, medical_history.

    Args:
        payload: PatientMeUpdate với các trường hồ sơ tùy chọn.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Dict chứa hồ sơ bệnh nhân đã cập nhật/tạo.

    Raises:
        HTTPException 403: Nếu người dùng không phải là bệnh nhân.
        HTTPException 422: Nếu không có cột hợp lệ để chèn/cập nhật.
    """
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can update patient profile")

    columns = await table_columns("patients")
    allowed = {"full_name", "age", "gender", "phone", "address", "medical_history"}
    values = {key: value for key, value in payload.model_dump(exclude_unset=True).items() if key in allowed and key in columns}
    existing = await fetch_patient_profile(current_user["id"])

    if existing:
        if values:
            set_sql = ", ".join(f"{key} = :{key}" for key in values.keys())
            where_sql = "user_id = CAST(:user_id AS uuid)" if "user_id" in columns else "id = CAST(:user_id AS uuid)"
            await database.execute(
                f"UPDATE patients SET {set_sql} WHERE {where_sql}",
                {**values, "user_id": current_user["id"]},
            )

        # Ghi nhận log cập nhật hồ sơ bệnh nhân
        await log_activity(
            user_id=current_user["id"],
            action="PATIENT_UPDATE_PROFILE",
            entity_type="patients",
            entity_id=current_user["id"],
            ip_address=request.client.host if request.client else "-"
        )
        return {"patient": await fetch_patient_profile(current_user["id"])}

    insert_values = dict(values)
    if "id" in columns:
        insert_values["id"] = current_user["id"]
    if "user_id" in columns:
        insert_values["user_id"] = current_user["id"]
    if "full_name" in columns and not insert_values.get("full_name"):
        insert_values["full_name"] = current_user["full_name"]
    if "phone" in columns and not insert_values.get("phone"):
        insert_values["phone"] = None

    if not insert_values:
        raise HTTPException(status_code=422, detail="No patient columns are available to update")

    insert_columns = ", ".join(insert_values.keys())
    bind_columns = ", ".join(f":{key}" for key in insert_values.keys())
    await database.execute(
        f"INSERT INTO patients ({insert_columns}) VALUES ({bind_columns})",
        insert_values,
    )

    # Ghi nhận log tạo hồ sơ bệnh nhân mới
    await log_activity(
        user_id=current_user["id"],
        action="PATIENT_UPDATE_PROFILE",
        entity_type="patients",
        entity_id=current_user["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return {"patient": await fetch_patient_profile(current_user["id"])}


from pydantic import BaseModel

class AssignmentCreate(BaseModel):
    """Lược đồ tạo phân công bác sĩ-bệnh nhân."""
    doctor_id: str
    patient_id: str

async def require_admin(authorization: Optional[str] = Header(default=None)):
    """Xác thực người gọi là người dùng admin.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict người dùng admin.

    Raises:
        HTTPException 403: Nếu người dùng không phải là admin.
    """
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền truy cập chức năng này")
    return user

@router.get("/admin/assignments")
async def get_assignments(authorization: Optional[str] = Header(default=None)):
    """Liệt kê tất cả phân công bác sĩ-bệnh nhân.

    Trả về dữ liệu kết hợp bao gồm tên/email của bác sĩ và bệnh nhân.

    Args:
        authorization: Token Bearer.

    Returns:
        Danh sách các bản ghi phân công với chi tiết bác sĩ và bệnh nhân.
    """
    await require_admin(authorization)
    query = """
    SELECT 
        dp.doctor_id::text as doctor_id, 
        d.full_name as doctor_name, 
        d.email as doctor_email,
        dp.patient_id::text as patient_id, 
        p.full_name as patient_name, 
        p.email as patient_email
    FROM doctor_patient dp
    JOIN users d ON dp.doctor_id = d.id AND lower(d.role) = 'doctor'
    JOIN users p ON dp.patient_id = p.id AND lower(p.role) = 'patient'
    """
    return await database.fetch_all(query)

@router.post("/admin/assignments")
async def create_assignment(payload: AssignmentCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    """Tạo phân công bác sĩ-bệnh nhân mới.

    Xác thực rằng cả bác sĩ và bệnh nhân đều tồn tại và có vai trò chính xác.
    Ngăn chặn phân công trùng lặp.

    Args:
        payload: AssignmentCreate với doctor_id và patient_id.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Tin nhắn thành công với ID bác sĩ và bệnh nhân.

    Raises:
        HTTPException 404: Nếu không tìm thấy bác sĩ hoặc bệnh nhân.
        HTTPException 400: Nếu phân công đã tồn tại.
    """
    user = await require_admin(authorization)

    # Xác minh bác sĩ tồn tại và có vai trò bác sĩ
    doctor = await database.fetch_one(
        "SELECT id FROM users WHERE id = CAST(:doctor_id AS uuid) AND lower(role) = 'doctor'",
        {"doctor_id": payload.doctor_id}
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Bác sĩ không tồn tại hoặc vai trò không hợp lệ")

    # Xác minh bệnh nhân tồn tại và có vai trò bệnh nhân
    patient = await database.fetch_one(
        "SELECT id FROM users WHERE id = CAST(:patient_id AS uuid) AND lower(role) = 'patient'",
        {"patient_id": payload.patient_id}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Bệnh nhân không tồn tại hoặc vai trò không hợp lệ")

    # Kiểm tra nếu đã được phân công
    existing = await database.fetch_one(
        "SELECT 1 FROM doctor_patient WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)",
        {"doctor_id": payload.doctor_id, "patient_id": payload.patient_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bác sĩ đã được phân công cho bệnh nhân này")

    # Chèn phân công
    await database.execute(
        "INSERT INTO doctor_patient (doctor_id, patient_id) VALUES (:doctor_id, :patient_id)",
        {"doctor_id": payload.doctor_id, "patient_id": payload.patient_id}
    )

    # Ghi nhận log phân công
    await log_activity(
        user_id=user["id"],
        action="ADMIN_CREATE_ASSIGNMENT",
        entity_type="doctor_patient",
        entity_id=payload.patient_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"message": "Phân công bác sĩ thành công", "doctor_id": payload.doctor_id, "patient_id": payload.patient_id}

@router.delete("/admin/assignments/{doctor_id}/{patient_id}")
async def delete_assignment(doctor_id: str, patient_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
    """Xóa phân công bác sĩ-bệnh nhân.

    Args:
        doctor_id: UUID của bác sĩ.
        patient_id: UUID của bệnh nhân.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Tin nhắn thành công.

    Raises:
        HTTPException 404: Nếu không tìm thấy phân công.
    """
    user = await require_admin(authorization)

    # Kiểm tra nếu phân công tồn tại
    existing = await database.fetch_one(
        "SELECT 1 FROM doctor_patient WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)",
        {"doctor_id": doctor_id, "patient_id": patient_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân công bác sĩ - bệnh nhân")

    # Xóa phân công
    await database.execute(
        "DELETE FROM doctor_patient WHERE doctor_id = CAST(:doctor_id AS uuid) AND patient_id = CAST(:patient_id AS uuid)",
        {"doctor_id": doctor_id, "patient_id": patient_id}
    )

    # Ghi nhận log hủy phân công
    await log_activity(
        user_id=user["id"],
        action="ADMIN_DELETE_ASSIGNMENT",
        entity_type="doctor_patient",
        entity_id=patient_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"message": "Hủy phân công bác sĩ thành công", "doctor_id": doctor_id, "patient_id": patient_id}


@router.get("/patients/me/doctors")
async def get_my_doctors(authorization: Optional[str] = Header(default=None)):
    """Lấy danh sách bác sĩ được phân công cho bệnh nhân đã xác thực.

    Args:
        authorization: Token Bearer.

    Returns:
        Danh sách các bản ghi bác sĩ với id, full_name và email.

    Raises:
        HTTPException 403: Nếu người dùng không phải là bệnh nhân.
    """
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có thể xem bác sĩ phụ trách")

    query = """
    SELECT d.id::text as id, d.full_name, d.email
    FROM users d
    JOIN doctor_patient dp ON dp.doctor_id = d.id
    WHERE dp.patient_id = CAST(:patient_id AS uuid) AND lower(d.role) = 'doctor'
    """
    return await database.fetch_all(query, {"patient_id": current_user["id"]})


@router.get("/admin/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    authorization: Optional[str] = Header(default=None)
):
    """Liệt kê tất cả người dùng với lọc tùy chọn (chỉ admin).

    Args:
        role: Lọc theo vai trò (admin, doctor, patient).
        status: Lọc theo trạng thái (active, inactive).
        search: Tìm kiếm toàn văn trên tên, email hoặc số điện thoại.
        authorization: Token Bearer.

    Returns:
        Danh sách các bản ghi người dùng.
    """
    await require_admin(authorization)

    where_clauses = ["(status IS NULL OR status != 'deleted')"]
    params = {}

    if role:
        where_clauses.append("role = :role")
        params["role"] = role.lower()

    if status:
        where_clauses.append("status = :status")
        params["status"] = status.lower()

    if search:
        where_clauses.append("(lower(full_name) LIKE :search OR lower(email) LIKE :search OR phone LIKE :search)")
        params["search"] = f"%{search.lower()}%"

    where_sql = " AND ".join(where_clauses)

    count_query = f"SELECT COUNT(*)::int AS total FROM users WHERE {where_sql}"
    total = await database.fetch_val(count_query, params)

    query = f"""
    SELECT id::text as id, full_name, email, phone, role, status, created_at
    FROM users
    WHERE {where_sql}
    ORDER BY created_at DESC NULLS LAST
    LIMIT :limit OFFSET :offset
    """
    params["limit"] = min(limit, 500)
    params["offset"] = offset

    rows = await database.fetch_all(query, params)
    return {"items": [row_to_dict(row) for row in rows], "total": total, "limit": limit, "offset": offset}

@router.post("/admin/users")
async def create_user(
    payload: UserAdminCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    """Tạo người dùng mới (chỉ admin). Tự động tạo hồ sơ bệnh nhân nếu vai trò là patient.

    Args:
        payload: UserAdminCreate với full_name, email, password, role, v.v.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Bản ghi người dùng đã tạo.

    Raises:
        HTTPException 400: Nếu email đã tồn tại.
        HTTPException 500: Nếu chèn thất bại.
    """
    user = await require_admin(authorization)

    email = payload.email.lower().strip()

    # Kiểm tra email tồn tại
    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(check_query, {"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")

    insert_query = """
    INSERT INTO users (full_name, email, phone, password_hash, role, status)
    VALUES (:full_name, :email, :phone, :password_hash, :role, :status)
    RETURNING id::text as id, full_name, email, phone, role, status, created_at
    """

    try:
        row = await database.fetch_one(
            insert_query,
            {
                "full_name": payload.full_name.strip(),
                "email": email,
                "phone": payload.phone.strip() if payload.phone else None,
                "password_hash": hash_password(payload.password),
                "role": payload.role,
                "status": payload.status or "active"
            }
        )
        created_user = row_to_dict(row) or {}
        # Nếu role là patient, tự động tạo hồ sơ trống trong bảng patients
        if payload.role == "patient":
            columns = await table_columns("patients")
            patient_insert_vals = {
                "id": created_user["id"],
                "full_name": created_user["full_name"],
                "phone": created_user["phone"]
            }
            if "user_id" in columns:
                patient_insert_vals["user_id"] = created_user["id"]

            insert_columns = ", ".join(patient_insert_vals.keys())
            bind_columns = ", ".join(f":{key}" for key in patient_insert_vals.keys())

            await database.execute(
                f"INSERT INTO patients ({insert_columns}) VALUES ({bind_columns}) ON CONFLICT DO NOTHING",
                patient_insert_vals
            )

        # Ghi nhận log Admin tạo user mới
        await log_activity(
            user_id=user["id"],
            action="ADMIN_CREATE_USER",
            entity_type="users",
            entity_id=created_user["id"],
            ip_address=request.client.host if request.client else "-"
        )

        return created_user
    except Exception as e:
        logger.exception("Admin tạo user thất bại: admin_id=%s, email=%s", user["id"], payload.email)
        raise HTTPException(status_code=500, detail="Lỗi thêm tài khoản mới. Vui lòng thử lại sau.")


@router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UserAdminUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    """Cập nhật thông tin người dùng (chỉ admin).

    Xây dựng động truy vấn UPDATE dựa trên các trường được cung cấp. Đồng bộ
    bảng patients nếu vai trò mục tiêu là 'patient'. Ngăn admin
    thay đổi vai trò của chính họ.

    Args:
        user_id: UUID của người dùng cần cập nhật.
        payload: UserAdminUpdate với các trường tùy chọn.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Bản ghi người dùng đã cập nhật.

    Raises:
        HTTPException 404: Nếu không tìm thấy người dùng.
        HTTPException 400: Nếu email đã tồn tại hoặc admin tự thay đổi vai trò.
        HTTPException 500: Nếu cập nhật thất bại.
    """
    user = await require_admin(authorization)

    # Kiểm tra người dùng tồn tại
    check_user = await database.fetch_one("SELECT id, role, full_name FROM users WHERE id = CAST(:user_id AS uuid)", {"user_id": user_id})
    if not check_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    # Chặn admin tự thay đổi vai trò của bản thân để tránh leo thang đặc quyền hoặc tự khóa mình
    if payload.role is not None and payload.role != check_user["role"]:
        if user_id == user["id"]:
            raise HTTPException(status_code=400, detail="Không thể tự thay đổi vai trò của bản thân")

    # Nếu email thay đổi, kiểm tra xem đã tồn tại chưa
    if payload.email is not None:
        email = payload.email.lower().strip()
        existing_user = await database.fetch_one(
            "SELECT id FROM users WHERE email = :email AND id != CAST(:user_id AS uuid)",
            {"email": email, "user_id": user_id}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")

    # Xây dựng truy vấn cập nhật động
    update_fields = []
    values = {"user_id": user_id}

    if payload.full_name is not None:
        update_fields.append("full_name = :full_name")
        values["full_name"] = payload.full_name.strip()
    if payload.email is not None:
        update_fields.append("email = :email")
        values["email"] = payload.email.lower().strip()
    if payload.phone is not None:
        update_fields.append("phone = :phone")
        values["phone"] = payload.phone.strip() if payload.phone else None
    if payload.role is not None:
        update_fields.append("role = :role")
        values["role"] = payload.role
    if payload.status is not None:
        update_fields.append("status = :status")
        values["status"] = payload.status
    if payload.password is not None:
        update_fields.append("password_hash = :password_hash")
        values["password_hash"] = hash_password(payload.password)

    if not update_fields:
        query = """
        SELECT id::text as id, full_name, email, phone, role, status, created_at
        FROM users
        WHERE id = CAST(:user_id AS uuid)
        """
        row = await database.fetch_one(query, {"user_id": user_id})
        return dict(row)

    update_query = f"""
    UPDATE users
    SET {", ".join(update_fields)}
    WHERE id = CAST(:user_id AS uuid)
    RETURNING id::text as id, full_name, email, phone, role, status, created_at
    """

    try:
        row = await database.fetch_one(update_query, values)
        updated_user = row_to_dict(row) or {}
        # Nếu đổi sang role patient hoặc cập nhật thông tin patient hiện tại, đồng bộ bảng patients
        target_role = payload.role if payload.role is not None else check_user["role"]
        if target_role == "patient":
            columns = await table_columns("patients")
            where_sql = "user_id = CAST(:user_id AS uuid)" if "user_id" in columns else "id = CAST(:user_id AS uuid)"

            # Kiểm tra nếu bản ghi patient tồn tại
            patient_exists = await database.fetch_one(
                f"SELECT id FROM patients WHERE {where_sql}",
                {"user_id": user_id}
            )

            if patient_exists:
                # Cập nhật thông tin trong bảng patients
                patient_update_vals = {}
                patient_update_fields = []

                if payload.full_name is not None:
                    patient_update_fields.append("full_name = :full_name")
                    patient_update_vals["full_name"] = payload.full_name.strip()
                if payload.phone is not None:
                    patient_update_fields.append("phone = :phone")
                    patient_update_vals["phone"] = payload.phone.strip() if payload.phone else None

                if patient_update_fields:
                    await database.execute(
                        f"UPDATE patients SET {', '.join(patient_update_fields)} WHERE {where_sql}",
                        {**patient_update_vals, "user_id": user_id}
                    )
            else:
                # Tạo mới
                patient_insert_vals = {
                    "id": user_id,
                    "full_name": payload.full_name.strip() if payload.full_name else check_user["full_name"],
                    "phone": payload.phone.strip() if payload.phone else None
                }
                if "user_id" in columns:
                    patient_insert_vals["user_id"] = user_id

                insert_columns = ", ".join(patient_insert_vals.keys())
                bind_columns = ", ".join(f":{key}" for key in patient_insert_vals.keys())

                await database.execute(
                    f"INSERT INTO patients ({insert_columns}) VALUES ({bind_columns}) ON CONFLICT DO NOTHING",
                    patient_insert_vals
                )

        # Ghi nhận log Admin chỉnh sửa user
        await log_activity(
            user_id=user["id"],
            action="ADMIN_UPDATE_USER",
            entity_type="users",
            entity_id=user_id,
            ip_address=request.client.host if request.client else "-"
        )

        return updated_user
    except Exception as e:
        logger.exception("Admin cập nhật user thất bại: admin_id=%s, target_user=%s", user["id"], user_id)
        raise HTTPException(status_code=500, detail="Lỗi cập nhật người dùng. Vui lòng thử lại sau.")


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    """Xóa mềm người dùng bằng cách đặt trạng thái thành 'inactive' (chỉ admin).

    Bảo toàn dữ liệu lâm sàng và lịch sử kiểm toán. Ngăn chặn tự xóa.

    Args:
        user_id: UUID của người dùng cần vô hiệu hóa.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Tin nhắn xác nhận với chi tiết xóa mềm.

    Raises:
        HTTPException 404: Nếu không tìm thấy người dùng.
        HTTPException 400: Nếu cố gắng tự xóa.
    """
    user = await require_admin(authorization)
    
    # Check user exists
    check_user = await database.fetch_one("SELECT id, role, status FROM users WHERE id = CAST(:user_id AS uuid)", {"user_id": user_id})
    if not check_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Không thể tự xóa hoặc vô hiệu hóa tài khoản của chính mình")
        
    # Luôn sử dụng Soft Delete để bảo toàn dữ liệu y tế lâm sàng nhạy cảm và lịch sử audit.
    columns = await table_columns("users")
    update_fields = ["status = 'deleted'"]
    if "updated_at" in columns:
        update_fields.append("updated_at = NOW()")

    await database.execute(
        f"UPDATE users SET {', '.join(update_fields)} WHERE id = CAST(:user_id AS uuid)",
        {"user_id": user_id},
    )

    role = (check_user["role"] or "").strip().lower()
    if role == "doctor":
        try:
            doctor_profile_columns = await table_columns("doctor_profiles")
            doctor_update_fields = []
            if "status" in doctor_profile_columns:
                doctor_update_fields.append("status = 'deleted'")
            if "updated_at" in doctor_profile_columns:
                doctor_update_fields.append("updated_at = NOW()")
            if doctor_update_fields:
                await database.execute(
                    f"UPDATE doctor_profiles SET {', '.join(doctor_update_fields)} WHERE user_id = CAST(:user_id AS uuid)",
                    {"user_id": user_id},
                )
        except HTTPException:
            logger.debug("doctor_profiles table unavailable while deactivating user_id=%s", user_id)
    elif role == "patient":
        try:
            patient_profile_columns = await table_columns("patient_profiles")
            if "updated_at" in patient_profile_columns:
                await database.execute(
                    "UPDATE patient_profiles SET updated_at = NOW() WHERE user_id = CAST(:user_id AS uuid)",
                    {"user_id": user_id},
                )
        except HTTPException:
            logger.debug("patient_profiles table unavailable while deactivating user_id=%s", user_id)

    logger.info("Admin đã xóa mềm user: admin_id=%s, target_user=%s", user["id"], user_id)
    await log_activity(
        user_id=user["id"],
        action="ADMIN_DELETE_USER",
        entity_type="users",
        entity_id=user_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {
        "message": "Tài khoản đã được vô hiệu hóa an toàn (Soft Delete) để bảo toàn dữ liệu lâm sàng", 
        "id": user_id, 
        "status": "deleted",
        "deactivated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/audit-logs", tags=["admin"])
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    authorization: Optional[str] = Header(default=None)
):
    """Lấy các mục nhật ký kiểm toán với phân trang (chỉ admin).

    Phân tích các trường details được chuỗi hóa JSON để thuận tiện cho máy khách.

    Args:
        limit: Số bản ghi tối đa (giới hạn ở 1000).
        offset: Độ lệch phân trang.
        authorization: Token Bearer.

    Returns:
        Danh sách các mục nhật ký kiểm toán với details đã phân tích.
    """
    await require_admin(authorization)
    limit = min(limit, 1000)
    columns = await table_columns("audit_logs")

    select_columns = []
    if "id" in columns:
        select_columns.append("id::text as id")
    if "user_id" in columns:
        select_columns.append("user_id::text as user_id")
    if "action" in columns:
        select_columns.append("action")
    if "entity_type" in columns:
        select_columns.append("entity_type")
    if "entity_id" in columns:
        select_columns.append("entity_id")
    if "details" in columns:
        select_columns.append("details")
    else:
        select_columns.append("NULL::text as details")
    if "ip_address" in columns:
        select_columns.append("ip_address")
    if "created_at" in columns:
        select_columns.append("created_at")

    query = f"""
        SELECT {", ".join(select_columns)}
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    rows = await database.fetch_all(query, {"limit": limit, "offset": offset})

    # Hàm trợ giúp chuyển đổi hàng thành danh sách dict thân thiện với JSON
    result = []
    for row in rows:
        d = dict(row)
        # Phân tích details nếu nó là chuỗi JSON
        if d.get("details") and isinstance(d["details"], str):
            try:
                d["details"] = json.loads(d["details"])
            except Exception:
                pass
        result.append(d)
    return result


@router.get("/admin/db-performance", tags=["admin"])
async def db_performance(authorization: Optional[str] = Header(default=None)):
    """Lấy thống kê hiệu suất truy vấn PostgreSQL (chỉ admin).

    Truy vấn pg_stat_statements cho 10 truy vấn hàng đầu theo tổng thời gian
    thực thi. Yêu cầu tiện ích mở rộng pg_stat_statements được kích hoạt.

    Args:
        authorization: Token Bearer.

    Returns:
        Danh sách các bản ghi hiệu suất truy vấn.

    Raises:
        HTTPException 500: Nếu pg_stat_statements không khả dụng.
    """
    await require_admin(authorization)
    try:
        rows = await database.fetch_all(
            """
            SELECT
                query,
                calls,
                total_exec_time::double precision as total_exec_time_ms,
                mean_exec_time::double precision as mean_exec_time_ms,
                rows::bigint as rows_processed
            FROM pg_stat_statements
            ORDER BY total_exec_time DESC
            LIMIT 10
            """
        )
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Không thể lấy thông số hiệu năng DB. Vui lòng đảm bảo pg_stat_statements đã được kích hoạt."
        )
