from fastapi import APIRouter, Header, HTTPException, Depends
from typing import List, Optional
from app.core.database import database
from app.core.security import hash_password
from app.api.auth_api import get_user_from_token
from app.schemas.admin_doctor_schema import DoctorCreate, DoctorUpdate, DoctorResponse

router = APIRouter(prefix="/admin", tags=["admin_doctors"])

async def require_admin(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền thực hiện thao tác này")
    return user

@router.get("/doctors", response_model=List[DoctorResponse])
async def list_doctors(admin: dict = Depends(require_admin)):
    query = """
    SELECT id::text as id, full_name, email, phone, specialty, department, status, created_at
    FROM users
    WHERE role = 'doctor'
    ORDER BY created_at DESC
    """
    rows = await database.fetch_all(query)
    return [dict(row) for row in rows]

@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    query = """
    SELECT id::text as id, full_name, email, phone, specialty, department, status, created_at
    FROM users
    WHERE role = 'doctor' AND id::text = :doctor_id
    """
    row = await database.fetch_one(query, {"doctor_id": doctor_id})
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
    return dict(row)

@router.post("/doctors", response_model=DoctorResponse)
async def create_doctor(payload: DoctorCreate, admin: dict = Depends(require_admin)):
    email = payload.email.lower()
    
    # Check email exists
    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(check_query, {"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")
        
    insert_query = """
    INSERT INTO users (full_name, email, phone, password_hash, role, specialty, department, status)
    VALUES (:full_name, :email, :phone, :password_hash, 'doctor', :specialty, :department, :status)
    RETURNING id::text as id, full_name, email, phone, specialty, department, status, created_at
    """
    
    try:
        row = await database.fetch_one(
            insert_query,
            {
                "full_name": payload.full_name,
                "email": email,
                "phone": payload.phone,
                "password_hash": hash_password(payload.password),
                "specialty": payload.specialty,
                "department": payload.department,
                "status": payload.status
            }
        )
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi thêm bác sĩ: {str(e)}")

@router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(doctor_id: str, payload: DoctorUpdate, admin: dict = Depends(require_admin)):
    # Check doctor exists
    check_doctor = await database.fetch_one("SELECT id FROM users WHERE role = 'doctor' AND id::text = :doctor_id", {"doctor_id": doctor_id})
    if not check_doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

    # If email changed, check if exists
    if payload.email is not None:
        email = payload.email.lower()
        existing_user = await database.fetch_one("SELECT id FROM users WHERE email = :email AND id::text != :doctor_id", {"email": email, "doctor_id": doctor_id})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")

    # Construct dynamic update query
    update_fields = []
    values = {"doctor_id": doctor_id}

    if payload.full_name is not None:
        update_fields.append("full_name = :full_name")
        values["full_name"] = payload.full_name
    if payload.email is not None:
        update_fields.append("email = :email")
        values["email"] = payload.email.lower()
    if payload.phone is not None:
        update_fields.append("phone = :phone")
        values["phone"] = payload.phone
    if payload.password is not None:
        update_fields.append("password_hash = :password_hash")
        values["password_hash"] = hash_password(payload.password)
    if payload.specialty is not None:
        update_fields.append("specialty = :specialty")
        values["specialty"] = payload.specialty
    if payload.department is not None:
        update_fields.append("department = :department")
        values["department"] = payload.department
    if payload.status is not None:
        update_fields.append("status = :status")
        values["status"] = payload.status

    if not update_fields:
        query = """
        SELECT id::text as id, full_name, email, phone, specialty, department, status, created_at
        FROM users
        WHERE id::text = :doctor_id
        """
        row = await database.fetch_one(query, {"doctor_id": doctor_id})
        return dict(row)

    update_query = f"""
    UPDATE users
    SET {", ".join(update_fields)}
    WHERE role = 'doctor' AND id::text = :doctor_id
    RETURNING id::text as id, full_name, email, phone, specialty, department, status, created_at
    """
    
    try:
        row = await database.fetch_one(update_query, values)
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật bác sĩ: {str(e)}")

@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    check_doctor = await database.fetch_one("SELECT id FROM users WHERE role = 'doctor' AND id::text = :doctor_id", {"doctor_id": doctor_id})
    if not check_doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

    # Soft delete trực tiếp để giữ nguyên lịch sử phân công bác sĩ - bệnh nhân.
    await database.execute("UPDATE users SET status = 'inactive' WHERE role = 'doctor' AND id::text = :doctor_id", {"doctor_id": doctor_id})
    return {
        "message": "Vô hiệu hóa bác sĩ thành công (Soft Delete)",
        "id": doctor_id,
        "assignments_preserved": True,
    }
