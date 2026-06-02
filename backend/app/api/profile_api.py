import os
import uuid
import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, File, Header, HTTPException, UploadFile, Depends, Form
from fastapi.responses import FileResponse

from app.core.database import database
from app.api.auth_api import get_user_from_token, extract_bearer_token
from app.schemas.profile_schema import PatientProfileUpdate, DoctorProfileUpdate
from app.services.audit_service import log_activity
from app.services.email_service import send_doctor_status_email

logger = logging.getLogger(__name__)
router = APIRouter()

STORAGE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))

@router.get("/patient/profile")
async def get_patient_profile(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có quyền truy cập hồ sơ này")
    
    row = await database.fetch_one(
        "SELECT * FROM patient_profiles WHERE user_id = :user_id",
        {"user_id": user["id"]}
    )
    if not row:
        return {
            "full_name": user["full_name"],
            "phone": user["phone"],
            "gender": None,
            "date_of_birth": None,
            "address": None,
            "blood_type": None,
            "medical_history": None,
            "allergies": None,
            "emergency_contact_name": None,
            "emergency_contact_phone": None,
            "avatar_url": user.get("avatar_url")
        }
    
    data = dict(row)
    if data.get("date_of_birth") and isinstance(data["date_of_birth"], date):
        data["date_of_birth"] = data["date_of_birth"].isoformat()
    return data

@router.put("/patient/profile")
async def update_patient_profile(payload: PatientProfileUpdate, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Chỉ bệnh nhân mới có quyền cập nhật hồ sơ này")
        
    user_id = user["id"]
    exists = await database.fetch_one("SELECT 1 FROM patient_profiles WHERE user_id = :user_id", {"user_id": user_id})
    
    profile_completed = bool(
        payload.full_name and 
        payload.date_of_birth and 
        payload.gender and 
        payload.phone and 
        payload.address
    )
    
    values = {
        "user_id": user_id,
        "full_name": payload.full_name,
        "phone": payload.phone,
        "gender": payload.gender,
        "date_of_birth": payload.date_of_birth,
        "address": payload.address,
        "blood_type": payload.blood_type,
        "medical_history": payload.medical_history,
        "allergies": payload.allergies,
        "emergency_contact_name": payload.emergency_contact_name,
        "emergency_contact_phone": payload.emergency_contact_phone,
        "avatar_url": payload.avatar_url,
        "profile_completed": profile_completed
    }
    
    async with database.transaction():
        if exists:
            await database.execute(
                """
                UPDATE patient_profiles
                SET full_name = :full_name, phone = :phone, gender = :gender, date_of_birth = :date_of_birth,
                    address = :address, blood_type = :blood_type, medical_history = :medical_history,
                    allergies = :allergies, emergency_contact_name = :emergency_contact_name,
                    emergency_contact_phone = :emergency_contact_phone, avatar_url = :avatar_url,
                    profile_completed = :profile_completed, updated_at = NOW()
                WHERE user_id = :user_id
                """,
                values
            )
        else:
            await database.execute(
                """
                INSERT INTO patient_profiles (user_id, full_name, phone, gender, date_of_birth, address, blood_type, 
                                            medical_history, allergies, emergency_contact_name, emergency_contact_phone, 
                                            avatar_url, profile_completed)
                VALUES (:user_id, :full_name, :phone, :gender, :date_of_birth, :address, :blood_type, 
                        :medical_history, :allergies, :emergency_contact_name, :emergency_contact_phone, 
                        :avatar_url, :profile_completed)
                """,
                values
            )
            
        user_status = "active" if profile_completed else "pending_profile"
        await database.execute(
            """
            UPDATE users
            SET status = :status, profile_completed = :profile_completed, avatar_url = :avatar_url, full_name = :full_name, phone = :phone
            WHERE id = :user_id
            """,
            {
                "status": user_status,
                "profile_completed": profile_completed,
                "avatar_url": payload.avatar_url,
                "full_name": payload.full_name,
                "phone": payload.phone,
                "user_id": user_id
            }
        )
        
        patients_exists = await database.fetch_one("SELECT 1 FROM patients WHERE user_id = :user_id OR id = :user_id", {"user_id": user_id})
        age = None
        if payload.date_of_birth:
            age = datetime.now().year - payload.date_of_birth.year
            
        patient_sync_vals = {
            "id": user_id,
            "user_id": user_id,
            "full_name": payload.full_name,
            "age": age,
            "gender": payload.gender,
            "phone": payload.phone,
            "address": payload.address,
            "medical_history": payload.medical_history
        }
        
        if patients_exists:
            await database.execute(
                """
                UPDATE patients
                SET full_name = :full_name, age = :age, gender = :gender, phone = :phone, address = :address, medical_history = :medical_history
                WHERE user_id = :user_id OR id = :user_id
                """,
                {
                    "full_name": payload.full_name,
                    "age": age,
                    "gender": payload.gender,
                    "phone": payload.phone,
                    "address": payload.address,
                    "medical_history": payload.medical_history,
                    "user_id": user_id
                }
            )
        else:
            await database.execute(
                """
                INSERT INTO patients (id, user_id, full_name, age, gender, phone, address, medical_history)
                VALUES (:id, :user_id, :full_name, :age, :gender, :phone, :address, :medical_history)
                ON CONFLICT (id) DO UPDATE
                SET full_name = EXCLUDED.full_name, age = EXCLUDED.age, gender = EXCLUDED.gender, phone = EXCLUDED.phone, address = EXCLUDED.address, medical_history = EXCLUDED.medical_history
                """,
                patient_sync_vals
            )
            
    await log_activity(
        user_id=user_id,
        action="PATIENT_UPDATE_PROFILE",
        entity_type="users",
        entity_id=user_id,
        ip_address="-"
    )
    
    return {"message": "Hồ sơ bệnh nhân được cập nhật thành công", "profile_completed": profile_completed}

@router.get("/doctor/profile")
async def get_doctor_profile(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Chỉ bác sĩ mới có quyền truy cập hồ sơ này")
        
    row = await database.fetch_one(
        "SELECT * FROM doctor_profiles WHERE user_id = :user_id",
        {"user_id": user["id"]}
    )
    if not row:
        user_row = await database.fetch_one("SELECT specialty, department FROM users WHERE id = :id", {"id": user["id"]})
        specialty = user_row["specialty"] if user_row else None
        department = user_row["department"] if user_row else None
        return {
            "full_name": user["full_name"],
            "gender": None,
            "date_of_birth": None,
            "phone": user["phone"],
            "address": None,
            "specialty": specialty,
            "position": None,
            "workplace": department or None,
            "experience_years": None,
            "license_number": "",
            "license_issued_date": None,
            "license_issued_by": None,
            "license_certificate_url": "",
            "cccd_front_url": "",
            "cccd_back_url": "",
            "avatar_url": user.get("avatar_url"),
            "status": "pending_profile"
        }
        
    data = dict(row)
    if data.get("date_of_birth") and isinstance(data["date_of_birth"], date):
        data["date_of_birth"] = data["date_of_birth"].isoformat()
    if data.get("license_issued_date") and isinstance(data["license_issued_date"], date):
        data["license_issued_date"] = data["license_issued_date"].isoformat()
    return data

@router.put("/doctor/profile")
async def update_doctor_profile(payload: DoctorProfileUpdate, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Chỉ bác sĩ mới có quyền cập nhật hồ sơ này")
        
    user_id = user["id"]
    exists = await database.fetch_one("SELECT 1 FROM doctor_profiles WHERE user_id = :user_id", {"user_id": user_id})
    
    profile_completed = bool(
        payload.full_name and
        payload.phone and
        payload.address and
        payload.specialty and
        payload.license_number and
        payload.license_certificate_url and
        payload.cccd_front_url and
        payload.cccd_back_url
    )
    
    if not profile_completed:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp đầy đủ thông tin chuyên môn và tài liệu xác thực bắt buộc")
        
    values = {
        "user_id": user_id,
        "full_name": payload.full_name,
        "gender": payload.gender,
        "date_of_birth": payload.date_of_birth,
        "phone": payload.phone,
        "address": payload.address,
        "specialty": payload.specialty,
        "position": payload.position,
        "workplace": payload.workplace,
        "experience_years": payload.experience_years,
        "license_number": payload.license_number,
        "license_issued_date": payload.license_issued_date,
        "license_issued_by": payload.license_issued_by,
        "license_certificate_url": payload.license_certificate_url,
        "cccd_front_url": payload.cccd_front_url,
        "cccd_back_url": payload.cccd_back_url,
        "avatar_url": payload.avatar_url,
        "is_verified": False,
        "status": "pending_verification"
    }
    
    async with database.transaction():
        if exists:
            await database.execute(
                """
                UPDATE doctor_profiles
                SET full_name = :full_name, gender = :gender, date_of_birth = :date_of_birth, phone = :phone,
                    address = :address, specialty = :specialty, position = :position, workplace = :workplace,
                    experience_years = :experience_years, license_number = :license_number,
                    license_issued_date = :license_issued_date, license_issued_by = :license_issued_by,
                    license_certificate_url = :license_certificate_url, cccd_front_url = :cccd_front_url,
                    cccd_back_url = :cccd_back_url, avatar_url = :avatar_url, is_verified = FALSE,
                    status = 'pending_verification', updated_at = NOW()
                WHERE user_id = :user_id
                """,
                values
            )
        else:
            await database.execute(
                """
                INSERT INTO doctor_profiles (user_id, full_name, gender, date_of_birth, phone, address, specialty, 
                                            position, workplace, experience_years, license_number, license_issued_date, 
                                            license_issued_by, license_certificate_url, cccd_front_url, cccd_back_url, 
                                            avatar_url, is_verified, status)
                VALUES (:user_id, :full_name, :gender, :date_of_birth, :phone, :address, :specialty, 
                        :position, :workplace, :experience_years, :license_number, :license_issued_date, 
                        :license_issued_by, :license_certificate_url, :cccd_front_url, :cccd_back_url, 
                        :avatar_url, FALSE, 'pending_verification')
                """,
                values
            )
            
        await database.execute(
            """
            UPDATE users
            SET status = 'pending_verification', profile_completed = TRUE, is_verified = FALSE, 
                avatar_url = :avatar_url, full_name = :full_name, phone = :phone, specialty = :specialty, department = :department
            WHERE id = :user_id
            """,
            {
                "avatar_url": payload.avatar_url,
                "full_name": payload.full_name,
                "phone": payload.phone,
                "specialty": payload.specialty,
                "department": payload.workplace,
                "user_id": user_id
            }
        )
        
    await log_activity(
        user_id=user_id,
        action="DOCTOR_UPDATE_PROFILE",
        entity_type="users",
        entity_id=user_id,
        ip_address="-"
    )
    
    try:
        await send_doctor_status_email(user["email"], payload.full_name, "pending_verification")
    except Exception:
        logger.exception("Failed to send pending verification email to doctor")
        
    return {"message": "Hồ sơ bác sĩ được lưu thành công, vui lòng chờ duyệt", "profile_completed": True}

@router.get("/doctor/verification-status")
async def get_doctor_verification_status(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    if user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Chỉ bác sĩ mới có quyền truy cập thông tin này")
        
    row = await database.fetch_one(
        "SELECT status, is_verified, verification_note FROM doctor_profiles WHERE user_id = :user_id",
        {"user_id": user["id"]}
    )
    if not row:
        return {"status": "pending_profile", "is_verified": False, "verification_note": None}
    return dict(row)

@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    owner_id: Optional[str] = Form(default=None),
    owner_role: Optional[str] = Form(default=None),
    authorization: Optional[str] = Header(default=None)
):
    user = await get_user_from_token(authorization, allow_uncompleted=True, allow_unverified=True)
    user_id = user["id"]
    
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Kích thước tệp tin tối đa là 5MB")
        
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận các định dạng ảnh: .jpg, .jpeg, .png, .webp")
        
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp tin tải lên phải là hình ảnh")
        
    unique_filename = f"{uuid.uuid4()}{ext}"
    
    if file_type == "avatar":
        rel_dir = f"avatars/{user_id}"
    elif file_type == "doctor_license":
        rel_dir = f"doctor-documents/{user_id}/license"
    elif file_type == "cccd_front":
        rel_dir = f"identity-documents/{user_id}/cccd-front"
    elif file_type == "cccd_back":
        rel_dir = f"identity-documents/{user_id}/cccd-back"
    else:
        raise HTTPException(status_code=400, detail="Loại tệp tin không hợp lệ")
        
    full_dir = os.path.join(STORAGE_ROOT, rel_dir)
    os.makedirs(full_dir, exist_ok=True)
    
    full_path = os.path.join(full_dir, unique_filename)
    try:
        content = await file.read()
        with open(full_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lưu trữ tệp tin: {str(e)}")
        
    return {"url": f"/files/download/{rel_dir}/{unique_filename}"}

@router.get("/files/download/{file_path:path}")
async def download_file(
    file_path: str,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(default=None)
):
    full_path = os.path.abspath(os.path.join(STORAGE_ROOT, file_path))
    
    if not full_path.startswith(STORAGE_ROOT):
        raise HTTPException(status_code=400, detail="Đường dẫn không hợp lệ")
        
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp tin")
        
    if file_path.startswith("avatars/"):
        return FileResponse(full_path)
        
    auth_token = None
    if authorization:
        try:
            auth_token = extract_bearer_token(authorization)
        except Exception:
            pass
    if not auth_token and token:
        auth_token = token
        
    if not auth_token:
        raise HTTPException(status_code=401, detail="Yêu cầu xác thực tài khoản")
        
    try:
        user = await get_user_from_token(f"Bearer {auth_token}", allow_uncompleted=True, allow_unverified=True)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn") from exc
        
    parts = file_path.split("/")
    owner_id = ""
    if len(parts) >= 2:
        owner_id = parts[1]
        
    if user["role"] == "admin" or user["id"] == owner_id:
        return FileResponse(full_path)
        
    raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập tệp tin này")
