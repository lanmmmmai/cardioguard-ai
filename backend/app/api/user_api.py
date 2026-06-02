import json
from typing import Any, Optional, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request
from jose import jwt

from app.api.auth_api import get_user_from_token, extract_bearer_token
from app.services.audit_service import log_activity
from app.core.database import database
from app.core.security import hash_password, verify_password, ALGORITHM, SECRET_KEY
from app.schemas.user_schema import PasswordUpdate, PatientMeUpdate, UserMeUpdate, UserAdminCreate, UserAdminUpdate

router = APIRouter()

_column_cache: dict[str, set[str]] = {}


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
    if not columns:
        raise HTTPException(status_code=500, detail=f"Table {table} not found")
    _column_cache[table] = columns
    return columns


def row_to_dict(row: Optional[Any]) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    return {key: row[key] for key in row.keys()}


async def fetch_current_user(user_id: str) -> dict[str, Any]:
    columns = await table_columns("users")
    select_columns = [
        "id::text as id",
        "full_name",
        "email",
        "phone" if "phone" in columns else "NULL::text as phone",
        "role",
        "created_at" if "created_at" in columns else "NULL::timestamptz as created_at",
        "status" if "status" in columns else "NULL::text as status",
    ]
    row = await database.fetch_one(
        f"""
        SELECT {", ".join(select_columns)}
        FROM users
        WHERE id::text = :user_id
        """,
        {"user_id": user_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    return row_to_dict(row) or {}


async def fetch_patient_profile(user_id: str) -> Optional[Dict[str, Any]]:
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
    where_sql = "user_id::text = :user_id" if "user_id" in columns else "id::text = :user_id"
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
    current_user = await get_user_from_token(authorization)
    columns = await table_columns("users")
    values = payload.model_dump(exclude_unset=True)
    update_values = {key: value for key, value in values.items() if key in {"full_name", "phone"} and key in columns}

    if not update_values:
        return {"user": await fetch_current_user(current_user["id"])}

    set_sql = ", ".join(f"{key} = :{key}" for key in update_values.keys())
    await database.execute(
        f"UPDATE users SET {set_sql} WHERE id::text = :user_id",
        {**update_values, "user_id": current_user["id"]},
    )

    # Ghi nhận log cập nhật thông tin cá nhân
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
    current_user = await get_user_from_token(
        authorization,
        allow_must_change_password=True,
    )
    row = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id::text = :user_id",
        {"user_id": current_user["id"]},
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    if not verify_password(payload.current_password, row["password_hash"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    await database.execute(
        "UPDATE users SET password_hash = :password_hash, must_change_password = FALSE WHERE id::text = :user_id",
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

    # Ghi nhận log đổi mật khẩu thành công
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
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access patient profile")

    profile = await fetch_patient_profile(current_user["id"])
    if not profile:
        return {"patient": None}
    return {"patient": profile}


@router.put("/patients/me")
async def update_patient_me(payload: PatientMeUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
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
            where_sql = "user_id::text = :user_id" if "user_id" in columns else "id::text = :user_id"
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
    doctor_id: str
    patient_id: str

async def require_admin(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền truy cập chức năng này")
    return user

@router.get("/admin/assignments")
async def get_assignments(authorization: Optional[str] = Header(default=None)):
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
    JOIN users d ON dp.doctor_id::text = d.id::text AND lower(d.role) = 'doctor'
    JOIN users p ON dp.patient_id::text = p.id::text AND lower(p.role) = 'patient'
    """
    return await database.fetch_all(query)

@router.post("/admin/assignments")
async def create_assignment(payload: AssignmentCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    user = await require_admin(authorization)
    
    # Verify doctor exists and has doctor role
    doctor = await database.fetch_one(
        "SELECT id FROM users WHERE id::text = :doctor_id AND lower(role) = 'doctor'",
        {"doctor_id": payload.doctor_id}
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Bác sĩ không tồn tại hoặc vai trò không hợp lệ")

    # Verify patient exists and has patient role
    patient = await database.fetch_one(
        "SELECT id FROM users WHERE id::text = :patient_id AND lower(role) = 'patient'",
        {"patient_id": payload.patient_id}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Bệnh nhân không tồn tại hoặc vai trò không hợp lệ")

    # Check if already assigned
    existing = await database.fetch_one(
        "SELECT 1 FROM doctor_patient WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id",
        {"doctor_id": payload.doctor_id, "patient_id": payload.patient_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bác sĩ đã được phân công cho bệnh nhân này")

    # Insert assignment
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
    user = await require_admin(authorization)
    
    # Check if assignment exists
    existing = await database.fetch_one(
        "SELECT 1 FROM doctor_patient WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id",
        {"doctor_id": doctor_id, "patient_id": patient_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân công bác sĩ - bệnh nhân")

    # Delete assignment
    await database.execute(
        "DELETE FROM doctor_patient WHERE doctor_id::text = :doctor_id AND patient_id::text = :patient_id",
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
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có thể xem bác sĩ phụ trách")
        
    query = """
    SELECT d.id::text as id, d.full_name, d.email
    FROM users d
    JOIN doctor_patient dp ON dp.doctor_id::text = d.id::text
    WHERE dp.patient_id::text = :patient_id AND lower(d.role) = 'doctor'
    """
    return await database.fetch_all(query, {"patient_id": current_user["id"]})


@router.get("/admin/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    authorization: Optional[str] = Header(default=None)
):
    await require_admin(authorization)
    
    query = """
    SELECT id::text as id, full_name, email, phone, role, status, created_at
    FROM users
    WHERE 1=1
    """
    params = {}
    
    if role:
        query += " AND role = :role"
        params["role"] = role.lower()
        
    if status:
        query += " AND status = :status"
        params["status"] = status.lower()
        
    if search:
        query += " AND (lower(full_name) LIKE :search OR lower(email) LIKE :search OR phone LIKE :search)"
        params["search"] = f"%{search.lower()}%"
        
    query += " ORDER BY created_at DESC"
    
    rows = await database.fetch_all(query, params)
    return [row_to_dict(row) for row in rows]


@router.post("/admin/users")
async def create_user(
    payload: UserAdminCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    user = await require_admin(authorization)
    
    email = payload.email.lower().strip()
    
    # Check email exists
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
        created_user = dict(row)
        
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
        raise HTTPException(status_code=500, detail="Lỗi thêm tài khoản mới. Vui lòng thử lại sau.")


@router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UserAdminUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    user = await require_admin(authorization)
    
    # Check user exists
    check_user = await database.fetch_one("SELECT id, role, full_name FROM users WHERE id::text = :user_id", {"user_id": user_id})
    if not check_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    # Chặn admin tự thay đổi vai trò của bản thân để tránh leo thang đặc quyền hoặc tự khóa mình
    if payload.role is not None and payload.role != check_user["role"]:
        if user_id == user["id"]:
            raise HTTPException(status_code=400, detail="Không thể tự thay đổi vai trò của bản thân")
        
    # If email changed, check if exists
    if payload.email is not None:
        email = payload.email.lower().strip()
        existing_user = await database.fetch_one(
            "SELECT id FROM users WHERE email = :email AND id::text != :user_id", 
            {"email": email, "user_id": user_id}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")
            
    # Construct dynamic update query
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
        WHERE id::text = :user_id
        """
        row = await database.fetch_one(query, {"user_id": user_id})
        return dict(row)
        
    update_query = f"""
    UPDATE users
    SET {", ".join(update_fields)}
    WHERE id::text = :user_id
    RETURNING id::text as id, full_name, email, phone, role, status, created_at
    """
    
    try:
        row = await database.fetch_one(update_query, values)
        updated_user = dict(row)
        
        # Nếu đổi sang role patient hoặc cập nhật thông tin patient hiện tại, đồng bộ bảng patients
        target_role = payload.role if payload.role is not None else check_user["role"]
        if target_role == "patient":
            columns = await table_columns("patients")
            where_sql = "user_id::text = :user_id" if "user_id" in columns else "id::text = :user_id"
            
            # Check if patient record exists
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
        raise HTTPException(status_code=500, detail="Lỗi cập nhật người dùng. Vui lòng thử lại sau.")


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    user = await require_admin(authorization)
    
    # Check user exists
    check_user = await database.fetch_one("SELECT id, role FROM users WHERE id::text = :user_id", {"user_id": user_id})
    if not check_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Không thể tự xóa hoặc vô hiệu hóa tài khoản của chính mình")
        
    # Luôn sử dụng Soft Delete để bảo toàn dữ liệu y tế lâm sàng nhạy cảm và lịch sử audit
    await database.execute("UPDATE users SET status = 'inactive' WHERE id::text = :user_id", {"user_id": user_id})

    # Ghi nhận log Admin xóa user dạng vô hiệu hóa an toàn (Soft Delete)
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
        "status": "inactive"
    }


@router.get("/audit-logs", tags=["admin"])
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    authorization: Optional[str] = Header(default=None)
):
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
    
    # helper convert rows to json-friendly list of dicts
    result = []
    for row in rows:
        d = dict(row)
        # Parse details if it is stringified JSON
        if d.get("details") and isinstance(d["details"], str):
            try:
                d["details"] = json.loads(d["details"])
            except Exception:
                pass
        result.append(d)
    return result


@router.get("/admin/db-performance", tags=["admin"])
async def db_performance(authorization: Optional[str] = Header(default=None)):
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
