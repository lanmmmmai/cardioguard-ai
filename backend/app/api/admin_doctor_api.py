"""API Quản lý Bác sĩ dành cho Admin.

Mục đích:
    Cung cấp các thao tác CRUD để quản lý tài khoản bác sĩ, giới hạn cho
    quyền admin. Hỗ trợ liệt kê, xem chi tiết, tạo mới, cập nhật và xóa mềm
    tài khoản bác sĩ.

Luồng xử lý:
    Tất cả các endpoint đều yêu cầu xác thực admin thông qua dependency require_admin.
    Tài khoản bác sĩ được lưu trong bảng users với role='doctor'.
    Cập nhật sử dụng xây dựng động câu SQL để cập nhật từng trường một phần.
    Xóa sử dụng xóa mềm bằng cách đặt status='inactive'.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực token
    - Phụ thuộc vào: core.security.hash_password để băm mật khẩu
    - Phụ thuộc vào: core.database để truy cập DB
    - Phụ thuộc vào: admin_doctor_schema cho các model request/response
"""

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
    """Xác thực người gọi là người dùng có quyền admin.

    Args:
        authorization: Token Bearer từ header Authorization.

    Returns:
        Dict chứa thông tin người dùng admin đã xác thực.

    Raises:
        HTTPException 403: Nếu người dùng không phải là admin.
    """
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền thực hiện thao tác này")
    return user

@router.get("/doctors", response_model=List[DoctorResponse])
async def list_doctors(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_admin)
):
    where_clauses = ["u.role = 'doctor'"]
    params = {}
    if status:
        status_clean = status.strip().lower()
        if status_clean == "pending_verification":
            where_clauses.append("u.status = 'pending_verification'")
        elif status_clean == "active":
            where_clauses.append("u.status = 'active' AND u.is_verified = TRUE")
        elif status_clean == "rejected":
            where_clauses.append("u.status = 'rejected'")
        elif status_clean == "pending_profile":
            where_clauses.append("u.status = 'pending_profile'")
        elif status_clean == "need_update":
            where_clauses.append("u.status = 'need_update'")

    where_sql = " AND ".join(where_clauses)

    count_query = f"SELECT COUNT(*)::int AS total FROM users u WHERE {where_sql}"
    total = await database.fetch_val(count_query, params)

    query = f"""
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
    WHERE {where_sql}
    ORDER BY u.created_at DESC
    LIMIT :limit OFFSET :offset
    """
    params["limit"] = min(limit, 500)
    params["offset"] = offset

    rows = await database.fetch_all(query, params)
    return {"items": [dict(row) for row in rows], "total": total, "limit": limit, "offset": offset}

@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    """Lấy thông tin một bác sĩ theo ID.

    Args:
        doctor_id: UUID của bác sĩ.
        admin: Người dùng admin từ dependency injection.

    Returns:
        DoctorResponse cho bác sĩ phù hợp.

    Raises:
        HTTPException 404: Nếu không tìm thấy bác sĩ.
    """
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
    WHERE u.role = 'doctor' AND u.id = :doctor_id::uuid
    """
    row = await database.fetch_one(query, {"doctor_id": doctor_id})
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
    return dict(row)

@router.post("/doctors", response_model=DoctorResponse)
async def create_doctor(payload: DoctorCreate, admin: dict = Depends(require_admin)):
    """Tạo một tài khoản bác sĩ mới.

    Args:
        payload: Dữ liệu tạo bác sĩ bao gồm tên, email, mật khẩu, v.v.
        admin: Người dùng admin từ dependency injection.

    Returns:
        DoctorResponse cho bác sĩ vừa được tạo.

    Raises:
        HTTPException 400: Nếu email đã tồn tại.
        HTTPException 500: Nếu thêm vào cơ sở dữ liệu thất bại.
    """
    email = payload.email.lower()
    
    # Kiểm tra email đã tồn tại chưa
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
        logger.exception("Admin tạo bác sĩ thất bại: full_name=%s", payload.full_name)
        raise HTTPException(status_code=500, detail=f"Lỗi thêm bác sĩ: {str(e)}")

@router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(doctor_id: str, payload: DoctorUpdate, admin: dict = Depends(require_admin)):
    """Cập nhật thông tin bác sĩ hiện có (cập nhật một phần).

    Xây dựng động câu UPDATE dựa trên các trường được cung cấp trong payload.
    Chỉ các trường không phải None mới được đưa vào mệnh đề SET.

    Args:
        doctor_id: UUID của bác sĩ cần cập nhật.
        payload: Dữ liệu cập nhật; chỉ các trường được cung cấp sẽ thay đổi.
        admin: Người dùng admin từ dependency injection.

    Returns:
        DoctorResponse cho bác sĩ đã cập nhật.

    Raises:
        HTTPException 404: Nếu không tìm thấy bác sĩ.
        HTTPException 400: Nếu email mới đã được sử dụng.
        HTTPException 500: Nếu câu truy vấn cập nhật thất bại.
    """
    # Kiểm tra bác sĩ tồn tại
    check_doctor = await database.fetch_one("SELECT id FROM users WHERE role = 'doctor' AND id = :doctor_id::uuid", {"doctor_id": doctor_id})
    if not check_doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

    # Nếu email thay đổi, kiểm tra xem đã tồn tại chưa
    if payload.email is not None:
        email = payload.email.lower()
        existing_user = await database.fetch_one("SELECT id FROM users WHERE email = :email AND id != :doctor_id::uuid", {"email": email, "doctor_id": doctor_id})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email đã tồn tại trên hệ thống")

    # Xây dựng truy vấn cập nhật động
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
        WHERE id = :doctor_id::uuid
        """
        row = await database.fetch_one(query, {"doctor_id": doctor_id})
        return dict(row)

    update_query = f"""
    UPDATE users
    SET {", ".join(update_fields)}
    WHERE role = 'doctor' AND id = :doctor_id::uuid
    RETURNING id::text as id, full_name, email, phone, specialty, department, status, created_at
    """
    
    try:
        row = await database.fetch_one(update_query, values)
        return dict(row)
    except Exception as e:
        logger.exception("Admin cập nhật bác sĩ thất bại: doctor_id=%s", doctor_id)
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật bác sĩ: {str(e)}")

@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    """Xóa mềm một bác sĩ bằng cách đặt trạng thái thành 'inactive'.

    Bảo toàn các phân công bệnh nhân hiện có và dữ liệu lâm sàng.

    Args:
        doctor_id: UUID của bác sĩ cần vô hiệu hóa.
        admin: Người dùng admin từ dependency injection.

    Returns:
        Tin nhắn xác nhận kèm ID bác sĩ.

    Raises:
        HTTPException 404: Nếu không tìm thấy bác sĩ.
    """
    check_doctor = await database.fetch_one("SELECT id FROM users WHERE role = 'doctor' AND id = :doctor_id::uuid", {"doctor_id": doctor_id})
    if not check_doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

    logger.info("Admin đã xóa mềm bác sĩ: doctor_id=%s", doctor_id)
    await database.execute("UPDATE users SET status = 'inactive' WHERE role = 'doctor' AND id = :doctor_id::uuid", {"doctor_id": doctor_id})
    return {
        "message": "Vô hiệu hóa bác sĩ thành công (Soft Delete)",
        "id": doctor_id,
        "assignments_preserved": True,
    }

@router.patch("/doctors/{doctor_id}/verify")
async def verify_doctor(doctor_id: str, admin: dict = Depends(require_admin)):
    async with database.transaction():
        doctor = await database.fetch_one(
            "SELECT email, full_name FROM users WHERE id = :doctor_id::uuid AND role = 'doctor'",
            {"doctor_id": doctor_id},
        )
        if not doctor:
            raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

        await database.execute(
            """UPDATE users SET is_verified = TRUE, status = 'active'
               WHERE id = :doctor_id::uuid""",
            {"doctor_id": doctor_id},
        )
        await database.execute(
            """UPDATE doctor_profiles SET is_verified = TRUE, status = 'active',
               verified_by = :admin_id, verified_at = NOW()
               WHERE user_id = :doctor_id::uuid""",
            {"doctor_id": doctor_id, "admin_id": admin["id"]},
        )

    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "active")
    except Exception:
        logger.exception("Failed to send active verification email to doctor")

    return {"message": "Xác thực tài khoản bác sĩ thành công"}


@router.patch("/doctors/{doctor_id}/reject")
async def reject_doctor(doctor_id: str, action: DoctorVerificationAction, admin: dict = Depends(require_admin)):
    async with database.transaction():
        doctor = await database.fetch_one(
            "SELECT email, full_name FROM users WHERE id = :doctor_id::uuid AND role = 'doctor'",
            {"doctor_id": doctor_id},
        )
        if not doctor:
            raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

        await database.execute(
            "UPDATE users SET is_verified = FALSE, status = 'rejected' WHERE id = :doctor_id::uuid",
            {"doctor_id": doctor_id},
        )
        await database.execute(
            "UPDATE doctor_profiles SET is_verified = FALSE, status = 'rejected', verification_note = :note WHERE user_id = :doctor_id::uuid",
            {"doctor_id": doctor_id, "note": action.verification_note},
        )

    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "rejected", action.verification_note)
    except Exception:
        logger.exception("Failed to send rejected verification email to doctor")

    return {"message": "Từ chối xác thực hồ sơ bác sĩ thành công"}


@router.patch("/doctors/{doctor_id}/request-update")
async def request_update_doctor(doctor_id: str, action: DoctorVerificationAction, admin: dict = Depends(require_admin)):
    async with database.transaction():
        doctor = await database.fetch_one(
            "SELECT email, full_name FROM users WHERE id = :doctor_id::uuid AND role = 'doctor'",
            {"doctor_id": doctor_id},
        )
        if not doctor:
            raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")

        await database.execute(
            "UPDATE users SET is_verified = FALSE, status = 'need_update' WHERE id = :doctor_id::uuid",
            {"doctor_id": doctor_id},
        )
        await database.execute(
            "UPDATE doctor_profiles SET is_verified = FALSE, status = 'need_update', verification_note = :note WHERE user_id = :doctor_id::uuid",
            {"doctor_id": doctor_id, "note": action.verification_note},
        )

    try:
        await send_doctor_status_email(doctor["email"], doctor["full_name"], "need_update", action.verification_note)
    except Exception:
        logger.exception("Failed to send need_update verification email to doctor")

    return {"message": "Yêu cầu bổ sung hồ sơ bác sĩ thành công"}
