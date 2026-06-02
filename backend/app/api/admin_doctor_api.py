import logging
from fastapi import APIRouter, Header, HTTPException, Depends
from typing import List, Optional
from app.core.database import database
from app.core.security import hash_password
from app.api.auth_api import get_user_from_token
from app.schemas.admin_doctor_schema import DoctorCreate, DoctorUpdate, DoctorResponse
from app.schemas.profile_schema import DoctorVerificationAction
from app.services.email_service import send_doctor_status_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin_doctors"])

async def require_admin(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền thực hiện thao tác này")
    return user

@router.get("/doctors", response_model=List[DoctorResponse])
async def list_doctors(
    status: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    query = """
    SELECT 
        u.id::text as id, u.full_name, u.email, u.phone, 
        COALESCE(dp.specialty, u.specialty) as specialty, 
        COALESCE(dp.workplace, u.department) as workplace, 
        u.status, u.created_at,
        dp.gender, dp.date_of_birth, dp.address, dp.position, 
        dp.experience_years, dp.license_number, dp.license_issued_date, 
        dp.license_issued_by, dp.license_certificate_url, 
        dp.cccd_front_url, dp.cccd_back_url, dp.is_verified, 
        dp.verification_note
    FROM users u
    LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.role = 'doctor'
    """
    params = {}
    if status:
        status_clean = status.strip().lower()
        if status_clean == "pending_verification":
            query += " AND u.status = 'pending_verification'"
        elif status_clean == "active":
            query += " AND u.status = 'active' AND u.is_verified = TRUE"
        elif status_clean == "rejected":
            query += " AND u.status = 'rejected'"
        elif status_clean == "pending_profile":
            query += " AND u.status = 'pending_profile'"
        elif status_clean == "need_update":
            query += " AND u.status = 'need_update'"
            
    query += " ORDER BY u.created_at DESC"
    rows = await database.fetch_all(query, params)
    return [dict(row) for row in rows]

@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    query = """
    SELECT 
        u.id::text as id, u.full_name, u.email, u.phone, 
        COALESCE(dp.specialty, u.specialty) as specialty, 
        COALESCE(dp.workplace, u.department) as workplace, 
        u.status, u.created_at,
        dp.gender, dp.date_of_birth, dp.address, dp.position, 
        dp.experience_years, dp.license_number, dp.license_issued_date, 
        dp.license_issued_by, dp.license_certificate_url, 
        dp.cccd_front_url, dp.cccd_back_url, dp.is_verified, 
        dp.verification_note
    FROM users u
    LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
    WHERE u.role = 'doctor' AND u.id::text = :doctor_id
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
        logger.exception("Admin create doctor failed: full_name=%s", payload.full_name)
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
        logger.exception("Admin update doctor failed: doctor_id=%s", doctor_id)
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật bác sĩ: {str(e)}")

@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    check_doctor = await database.fetch_one("SELECT id FROM users WHERE role = 'doctor' AND id::text = :doctor_id", {"doctor_id": doctor_id})
    if not check_doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

    logger.info("Admin soft-deleted doctor: doctor_id=%s", doctor_id)
    await database.execute("UPDATE users SET status = 'inactive' WHERE role = 'doctor' AND id::text = :doctor_id", {"doctor_id": doctor_id})
    return {
        "message": "Vô hiệu hóa bác sĩ thành công (Soft Delete)",
        "id": doctor_id,
        "assignments_preserved": True,
    }

@router.patch("/doctors/{doctor_id}/verify")
async def verify_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    doctor = await database.fetch_one("SELECT email, full_name FROM users WHERE id::text = :doctor_id AND role = 'doctor'", {"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
        
    async with database.transaction():
        await database.execute(
            "UPDATE users SET is_verified = TRUE, status = 'active' WHERE id::text = :doctor_id",
            {"doctor_id": doctor_id}
        )
        await database.execute(
            "UPDATE doctor_profiles SET is_verified = TRUE, status = 'active', verified_by = :admin_id, verified_at = NOW() WHERE user_id::text = :doctor_id",
            {"doctor_id": doctor_id, "admin_id": admin["id"]}
        )
        
    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "active")
    except Exception:
        logger.exception("Failed to send active verification email to doctor")
        
    return {"message": "Xác thực tài khoản bác sĩ thành công"}

@router.patch("/doctors/{doctor_id}/reject")
async def reject_doctor(doctor_id: str, action: DoctorVerificationAction, admin: dict = Depends(require_admin)):
    doctor = await database.fetch_one("SELECT email, full_name FROM users WHERE id::text = :doctor_id AND role = 'doctor'", {"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
        
    async with database.transaction():
        await database.execute(
            "UPDATE users SET is_verified = FALSE, status = 'rejected' WHERE id::text = :doctor_id",
            {"doctor_id": doctor_id}
        )
        await database.execute(
            "UPDATE doctor_profiles SET is_verified = FALSE, status = 'rejected', verification_note = :note WHERE user_id::text = :doctor_id",
            {"doctor_id": doctor_id, "note": action.verification_note}
        )
        
    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "rejected", action.verification_note)
    except Exception:
        logger.exception("Failed to send rejected verification email to doctor")
        
    return {"message": "Từ chối xác thực hồ sơ bác sĩ thành công"}

@router.patch("/doctors/{doctor_id}/request-update")
async def request_update_doctor(doctor_id: str, action: DoctorVerificationAction, admin: dict = Depends(require_admin)):
    doctor = await database.fetch_one("SELECT email, full_name FROM users WHERE id::text = :doctor_id AND role = 'doctor'", {"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
        
    async with database.transaction():
        await database.execute(
            "UPDATE users SET is_verified = FALSE, status = 'need_update' WHERE id::text = :doctor_id",
            {"doctor_id": doctor_id}
        )
        await database.execute(
            "UPDATE doctor_profiles SET is_verified = FALSE, status = 'need_update', verification_note = :note WHERE user_id::text = :doctor_id",
            {"doctor_id": doctor_id, "note": action.verification_note}
        )
        
    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "need_update", action.verification_note)
    except Exception:
        logger.exception("Failed to send need_update verification email to doctor")
        
    return {"message": "Yêu cầu bổ sung hồ sơ bác sĩ thành công"}
