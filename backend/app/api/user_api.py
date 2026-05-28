from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.api.auth_api import get_user_from_token
from app.core.database import database
from app.core.security import hash_password, verify_password
from app.schemas.user_schema import PasswordUpdate, PatientMeUpdate, UserMeUpdate

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


def row_to_dict(row: Any | None) -> dict[str, Any] | None:
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


async def fetch_patient_profile(user_id: str) -> dict[str, Any] | None:
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
async def update_user_me(payload: UserMeUpdate, authorization: str | None = Header(default=None)):
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
    return {"user": await fetch_current_user(current_user["id"])}


@router.put("/users/me/password")
async def update_user_password(payload: PasswordUpdate, authorization: str | None = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    row = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id::text = :user_id",
        {"user_id": current_user["id"]},
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    if not verify_password(payload.current_password, row["password_hash"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    await database.execute(
        "UPDATE users SET password_hash = :password_hash WHERE id::text = :user_id",
        {"password_hash": hash_password(payload.new_password), "user_id": current_user["id"]},
    )
    return {"message": "Password updated successfully"}


@router.get("/patients/me")
async def get_patient_me(authorization: str | None = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access patient profile")

    profile = await fetch_patient_profile(current_user["id"])
    if not profile:
        return {"patient": None}
    return {"patient": profile}


@router.put("/patients/me")
async def update_patient_me(payload: PatientMeUpdate, authorization: str | None = Header(default=None)):
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
    return {"patient": await fetch_patient_profile(current_user["id"])}


from pydantic import BaseModel

class AssignmentCreate(BaseModel):
    doctor_id: str
    patient_id: str

async def require_admin(authorization: str | None = Header(default=None)):
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền truy cập chức năng này")
    return user

@router.get("/admin/assignments")
async def get_assignments(authorization: str | None = Header(default=None)):
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
async def create_assignment(payload: AssignmentCreate, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    
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
    return {"message": "Phân công bác sĩ thành công", "doctor_id": payload.doctor_id, "patient_id": payload.patient_id}

@router.delete("/admin/assignments/{doctor_id}/{patient_id}")
async def delete_assignment(doctor_id: str, patient_id: str, authorization: str | None = Header(default=None)):
    await require_admin(authorization)
    
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
    return {"message": "Hủy phân công bác sĩ thành công", "doctor_id": doctor_id, "patient_id": patient_id}


@router.get("/patients/me/doctors")
async def get_my_doctors(authorization: str | None = Header(default=None)):
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
