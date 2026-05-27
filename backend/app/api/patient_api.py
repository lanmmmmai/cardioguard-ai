from fastapi import APIRouter, Header, HTTPException
from app.schemas.patient_schema import PatientCreate
from app.core.database import database
from app.api.auth_api import get_user_from_token

router = APIRouter()


@router.post("/patients")
async def create_patient(patient: PatientCreate):
    raise HTTPException(
        status_code=403,
        detail="Bệnh nhân chỉ được tạo bằng đăng ký tài khoản và xác thực OTP qua email"
    )


@router.get("/patients")
async def get_patients(authorization: str | None = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    role = current_user["role"]

    if role == "patient":
        query = """
        SELECT id::text as id, full_name, email
        FROM users
        WHERE id::text = :user_id AND lower(role) = 'patient'
        ORDER BY full_name ASC
        """
        rows = await database.fetch_all(query=query, values={"user_id": current_user["id"]})
    elif role == "doctor":
        query = """
        SELECT users.id::text as id, users.full_name, users.email
        FROM users
        JOIN doctor_patient dp ON dp.patient_id::text = users.id::text
        WHERE dp.doctor_id::text = :doctor_id AND lower(users.role) = 'patient'
        ORDER BY users.full_name ASC
        """
        rows = await database.fetch_all(query=query, values={"doctor_id": current_user["id"]})
    else:
        query = """
        SELECT id::text as id, full_name, email
        FROM users
        WHERE lower(role) = 'patient'
        ORDER BY full_name ASC
        """
        rows = await database.fetch_all(query=query)

    return [
        {
            "id": row["id"],
            "full_name": row["full_name"],
            "age": 0,
            "gender": "Chưa cập nhật",
            "phone": row["email"],
            "address": "Chưa cập nhật",
            "medical_history": "Hồ sơ được tạo từ tài khoản bệnh nhân đã xác thực OTP",
            "email": row["email"],
            "created_at": None,
            "source": "verified_patient_account"
        }
        for row in rows
    ]
