"""API Quản lý Hồ sơ Bệnh nhân.

Mục đích:
    Cung cấp các endpoint liệt kê bệnh nhân với phạm vi truy cập dựa trên vai trò.
    Việc tạo bệnh nhân bị vô hiệu hóa có chủ ý qua API này (phải sử dụng
    luồng đăng ký OTP trong auth_api).

Luồng xử lý:
    GET /patients liệt kê tất cả bệnh nhân với phạm vi dựa trên vai trò (bệnh nhân
    thấy chính họ, bác sĩ thấy bệnh nhân được phân công, admin thấy tất cả).
    Kết quả thích ứng động với lược đồ bảng patients thông qua
    giới thiệu information_schema. POST /patients bị chặn với
    thông báo lỗi mô tả hướng dẫn người dùng đến luồng đăng ký.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Phụ thuộc vào: user_api.table_columns để giới thiệu lược đồ
    - Phụ thuộc vào: core.database để truy cập DB
    - Bảng: users, patients, doctor_patient
"""

import logging
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.patient_schema import PatientCreate
from app.core.database import database
from app.api.auth_api import get_user_from_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/patients")
async def create_patient(patient: PatientCreate):
    """Bị chặn — bệnh nhân phải đăng ký qua luồng đăng ký OTP.

    Args:
        patient: Dữ liệu tạo bệnh nhân bị bỏ qua.

    Raises:
        HTTPException 403: Luôn luôn, với tin nhắn hướng dẫn đến đăng ký.
    """
    raise HTTPException(
        status_code=403,
        detail="Bệnh nhân chỉ được tạo bằng đăng ký tài khoản và xác thực OTP qua email"
    )


@router.get("/patients")
async def get_patients(authorization: Optional[str] = Header(default=None)):
    """Liệt kê bệnh nhân với phạm vi truy cập dựa trên vai trò.

    Giới thiệu động lược đồ bảng patients để xây dựng truy vấn
    SELECT. Bệnh nhân chỉ thấy chính họ; bác sĩ thấy bệnh nhân
    được phân công của họ; admin thấy tất cả bệnh nhân.

    Args:
        authorization: Token Bearer.

    Returns:
        Danh sách dict bệnh nhân với id, full_name, age, gender, phone,
        address, medical_history, email, created_at và source.
    """
    current_user = await get_user_from_token(authorization)
    role = current_user["role"]
    
    from app.api.user_api import table_columns
    try:
        columns = await table_columns("patients")
    except Exception:
        columns = set()

    has_user_id = "user_id" in columns
    has_age = "age" in columns
    has_gender = "gender" in columns
    has_phone = "phone" in columns
    has_address = "address" in columns
    has_medical_history = "medical_history" in columns
    has_created_at = "created_at" in columns

    join_on = "p.user_id::text = u.id::text" if has_user_id else "p.id::text = u.id::text"
    
    select_fields = [
        "u.id::text as id",
        "u.full_name as user_full_name",
        "u.email as user_email",
        "p.full_name as patient_full_name" if "full_name" in columns else "NULL::text as patient_full_name",
        "p.age" if has_age else "NULL::int as age",
        "p.gender" if has_gender else "NULL::text as gender",
        "p.phone" if has_phone else "NULL::text as phone",
        "p.address" if has_address else "NULL::text as address",
        "p.medical_history" if has_medical_history else "NULL::text as medical_history",
        "p.created_at" if has_created_at else "NULL::timestamptz as created_at"
    ]

    base_query = f"""
    SELECT {", ".join(select_fields)}
    FROM users u
    LEFT JOIN patients p ON {join_on}
    """

    where_sql = ""
    values = {}

    if role == "patient":
        where_sql = "WHERE u.id = :user_id::uuid AND lower(u.role) = 'patient'"
        values["user_id"] = current_user["id"]
    elif role == "doctor":
        where_sql = """
        WHERE EXISTS (
            SELECT 1 FROM doctor_patient dp
            WHERE dp.doctor_id = :doctor_id::uuid
              AND dp.patient_id = u.id
        ) AND lower(u.role) = 'patient'
        """
        values["doctor_id"] = current_user["id"]
    else:
        where_sql = "WHERE lower(u.role) = 'patient'"

    query = f"{base_query} {where_sql} ORDER BY u.full_name ASC"
    rows = await database.fetch_all(query=query, values=values)
    logger.info("Danh sách bệnh nhân: role=%s user_id=%s count=%d", role, current_user["id"], len(rows))

    return [
        {
            "id": row["id"],
            "full_name": row["patient_full_name"] or row["user_full_name"],
            "age": row["age"] if row["age"] is not None else 0,
            "gender": row["gender"] or "Chưa cập nhật",
            "phone": row["phone"] or row["user_email"],
            "address": row["address"] or "Chưa cập nhật",
            "medical_history": row["medical_history"] or "Chưa cập nhật",
            "email": row["user_email"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "source": "verified_patient_account"
        }
        for row in rows
    ]
