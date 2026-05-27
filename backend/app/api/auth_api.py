import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from fastapi import APIRouter, Header, HTTPException
from jose import JWTError, jwt
from app.core.config import settings
from app.core.database import database
from app.core.security import ALGORITHM, SECRET_KEY, hash_password, verify_password, create_access_token
from app.schemas.auth_schema import RegisterRequest, LoginRequest, RegisterOtpRequest

router = APIRouter()

otp_store: dict[str, dict[str, object]] = {}
VALID_ROLES = {"admin", "doctor", "patient"}


def normalize_role(role: str | None) -> str:
    normalized = (role or "").strip().lower()
    if normalized not in VALID_ROLES:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phân quyền")
    return normalized


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


async def get_user_from_token(authorization: str | None):
    token = extract_bearer_token(authorization)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    columns = await database.fetch_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        """
    )
    user_columns = {column["column_name"] for column in columns}
    select_columns = [
        "id::text as id",
        "full_name",
        "email",
        "phone" if "phone" in user_columns else "NULL::text as phone",
        "role",
        "created_at" if "created_at" in user_columns else "NULL::timestamptz as created_at",
        "status" if "status" in user_columns else "NULL::text as status",
    ]

    user = await database.fetch_one(
        f"""
        SELECT {", ".join(select_columns)}
        FROM users
        WHERE id::text = :user_id
        """,
        {"user_id": user_id}
    )

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": normalize_role(user["role"]),
        "created_at": user["created_at"],
        "status": user["status"]
    }


def send_register_otp_email(email: str, full_name: str, otp: str) -> bool:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[DEV OTP] Register OTP for {email}: {otp}")
        return False

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

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except smtplib.SMTPAuthenticationError as exc:
        raise RuntimeError("Gmail rejected SMTP login. Use a Gmail App Password, not the normal Gmail password.") from exc

    return True


@router.post("/auth/register/request-otp")
async def request_register_otp(data: RegisterOtpRequest):
    email = data.email.lower()
    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": email}
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    otp = f"{random.randint(0, 999999):06d}"
    otp_store[email] = {
        "otp": otp,
        "full_name": data.full_name,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    try:
        email_sent = send_register_otp_email(email, data.full_name, otp)
    except Exception as exc:
        print(f"[SMTP ERROR] Unable to send OTP to {email}: {exc}")
        email_sent = False

    response = {"message": "OTP sent to email", "email": email, "email_sent": email_sent}
    if not email_sent:
        response["dev_otp"] = otp
    return response


@router.post("/auth/register")
async def register(data: RegisterRequest):
    email = data.email.lower()
    otp_record = otp_store.get(email)
    now = datetime.now(timezone.utc)

    if not otp_record or otp_record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if otp_record["expires_at"] < now:
        otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired")

    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": email}
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
            "email": email,
            "password_hash": hash_password(data.password),
            "role": "patient"
        }
    )

    otp_store.pop(email, None)

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
        values={"email": data.email.lower()}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": normalize_role(user["role"])
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": normalize_role(user["role"])
        }
    }


@router.get("/auth/me")
async def me(authorization: str | None = Header(default=None)):
    return {"user": await get_user_from_token(authorization)}
