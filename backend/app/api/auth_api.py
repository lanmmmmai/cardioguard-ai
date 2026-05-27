import random
import requests
from datetime import datetime, timedelta, timezone
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
    if settings.RESEND_API_KEY:
        print(f"[RESEND] Attempting to send OTP to {email}...")
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #ff3366; text-align: center;">CardioGuard AI</h2>
            <p>Xin chào <strong>{full_name}</strong>,</p>
            <p>Mã OTP đăng ký tài khoản bệnh nhân CardioGuard AI của bạn là:</p>
            <div style="text-align: center; margin: 25px 0;">
                <span style="font-size: 28px; font-weight: bold; color: #ff3366; letter-spacing: 5px; padding: 10px 20px; background-color: #ffe6eb; border-radius: 4px;">{otp}</span>
            </div>
            <p>Mã này có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;">
            <p style="font-size: 12px; color: #777777; text-align: center;">Đây là email tự động từ hệ thống CardioGuard AI. Vui lòng không phản hồi email này.</p>
        </div>
        """
        payload = {
            "from": settings.RESEND_FROM_EMAIL or "CardioGuard <onboarding@resend.dev>",
            "to": [email],
            "subject": "CardioGuard AI - Mã OTP đăng ký",
            "html": html_content
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            if response.status_code in {200, 201}:
                print(f"[RESEND SUCCESS] OTP sent to {email}")
                return True
            else:
                print(f"[RESEND ERROR] Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"[RESEND EXCEPTION] Error calling Resend API: {e}")
            return False

    # Dev OTP fallback when RESEND_API_KEY is not configured
    print(f"[DEV OTP] Resend API not configured. Register OTP for {email}: {otp}")
    return False


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
