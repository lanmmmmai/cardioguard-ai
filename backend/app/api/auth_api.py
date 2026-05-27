import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.core.database import database
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth_schema import RegisterRequest, LoginRequest, RegisterOtpRequest

router = APIRouter()

otp_store: dict[str, dict[str, object]] = {}


def send_register_otp_email(email: str, full_name: str, otp: str) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[DEV OTP] Register OTP for {email}: {otp}")
        return

    message = EmailMessage()
    message["Subject"] = "CardioGuard AI - Mã OTP đăng ký"
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    message["To"] = email
    message.set_content(
        f"Xin chào {full_name},\n\n"
        f"Mã OTP đăng ký tài khoản bệnh nhân CardioGuard AI của bạn là: {otp}\n"
        "Mã này có hiệu lực trong 10 phút. Không chia sẻ mã này cho người khác.\n\n"
        "CardioGuard AI"
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


@router.post("/auth/register/request-otp")
async def request_register_otp(data: RegisterOtpRequest):
    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": data.email}
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    otp = f"{random.randint(0, 999999):06d}"
    otp_store[data.email] = {
        "otp": otp,
        "full_name": data.full_name,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    try:
        send_register_otp_email(data.email, data.full_name, otp)
    except Exception as exc:
        otp_store.pop(data.email, None)
        raise HTTPException(status_code=502, detail="Unable to send OTP email") from exc

    return {"message": "OTP sent to email"}


@router.post("/auth/register")
async def register(data: RegisterRequest):
    otp_record = otp_store.get(data.email)
    now = datetime.now(timezone.utc)

    if not otp_record or otp_record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if otp_record["expires_at"] < now:
        otp_store.pop(data.email, None)
        raise HTTPException(status_code=400, detail="OTP expired")

    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": data.email}
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    insert_query = """
    INSERT INTO users(full_name, email, password_hash, role)
    VALUES (:full_name, :email, :password_hash, :role)
    """

    await database.execute(
        query=insert_query,
        values={
            "full_name": data.full_name,
            "email": data.email,
            "password_hash": hash_password(data.password),
            "role": "patient"
        }
    )

    otp_store.pop(data.email, None)

    return {"message": "Register successfully"}


@router.post("/auth/login")
async def login(data: LoginRequest):
    query = """
    SELECT id::text as id, full_name, email, password_hash, role
    FROM users
    WHERE email = :email
    """

    user = await database.fetch_one(
        query=query,
        values={"email": data.email}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    }
