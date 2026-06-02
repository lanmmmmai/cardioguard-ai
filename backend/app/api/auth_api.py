import asyncio
import secrets
import requests
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request
from jose import JWTError, jwt
from app.core.config import settings
from app.core.database import database
from app.core.security import ALGORITHM, SECRET_KEY, hash_password, verify_password, create_access_token
from app.core.rate_limit import check_rate_limit, get_client_ip
from app.schemas.auth_schema import (
    RegisterRequest, LoginRequest, RegisterOtpRequest,
    ForgotPasswordRequest, ForgotPasswordVerifyRequest, ChangePasswordRequest
)
from app.services.otp_service import (
    OTP_PURPOSE_FORGOT_PASSWORD,
    OTP_PURPOSE_REGISTER,
    create_otp_token,
    invalidate_otp_tokens,
    verify_otp_token,
)
from app.services.audit_service import log_activity
router = APIRouter()
logger = logging.getLogger(__name__)

VALID_ROLES = {"admin", "doctor", "patient"}


def normalize_role(role: Optional[str]) -> str:
    normalized = (role or "").strip().lower()
    if normalized not in VALID_ROLES:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phân quyền")
    return normalized


def generic_forgot_password_response(email: str) -> dict[str, object]:
    return {
        "message": "If the email exists, an OTP will be sent.",
        "email": email,
        "email_sent": bool(settings.BREVO_API_KEY),
    }


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


_users_columns_cache: Optional[set[str]] = None
_users_columns_lock = asyncio.Lock()

async def get_users_columns() -> set[str]:
    global _users_columns_cache
    if _users_columns_cache is None:
        async with _users_columns_lock:
            if _users_columns_cache is None:
                columns = await database.fetch_all(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'users'
                    """
                )
                _users_columns_cache = {column["column_name"] for column in columns}
    return _users_columns_cache



async def get_user_from_token(
    authorization: Optional[str],
    *,
    allow_must_change_password: bool = False,
    allow_uncompleted: bool = False,
    allow_unverified: bool = False,
):
    token = extract_bearer_token(authorization)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        jti = payload.get("jti")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if jti:
        revoked = await database.fetch_val("SELECT 1 FROM revoked_tokens WHERE jti = :jti", {"jti": jti})
        if revoked:
            raise HTTPException(status_code=401, detail="Token has been revoked")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")


    user_columns = await get_users_columns()
    select_columns = [
        "id::text as id",
        "full_name",
        "email",
        "phone" if "phone" in user_columns else "NULL::text as phone",
        "role",
        "created_at" if "created_at" in user_columns else "NULL::timestamptz as created_at",
        "status" if "status" in user_columns else "NULL::text as status",
        "must_change_password" if "must_change_password" in user_columns else "FALSE as must_change_password",
        "profile_completed" if "profile_completed" in user_columns else "FALSE as profile_completed",
        "is_verified" if "is_verified" in user_columns else "FALSE as is_verified",
        "avatar_url" if "avatar_url" in user_columns else "NULL::text as avatar_url",
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

    if (user["status"] or "").strip().lower() in {"inactive", "disabled"}:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hóa")

    result = {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": normalize_role(user["role"]),
        "created_at": user["created_at"],
        "status": user["status"],
        "must_change_password": user["must_change_password"],
        "profile_completed": bool(user["profile_completed"]),
        "is_verified": bool(user["is_verified"]),
        "avatar_url": user["avatar_url"],
    }

    if result["must_change_password"] and not allow_must_change_password:
        raise HTTPException(
            status_code=403,
            detail="Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống",
        )

    # Check profile completion
    if not result["profile_completed"] and not allow_uncompleted:
        if result["role"] in {"patient", "doctor"}:
            raise HTTPException(
                status_code=403,
                detail="Tài khoản chưa hoàn thiện hồ sơ. Vui lòng hoàn thiện hồ sơ trước khi tiếp tục."
            )

    # Check doctor verification
    if result["role"] == "doctor" and not result["is_verified"] and not allow_unverified:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản bác sĩ chưa được ban quản trị phê duyệt xác thực."
        )

    return result


from app.services.email_service import send_system_email


async def send_forgot_password_otp_email(email: str, full_name: str, otp: str, role: Optional[str] = None) -> bool:
    fallback_subject = "CardioGuard AI - Mã OTP đặt lại mật khẩu"
    fallback_html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
      <p style="color:#374151">Xin chào <strong>{full_name}</strong>,</p>
      <p style="color:#374151">Bạn vừa yêu cầu đặt lại mật khẩu. Mã OTP của bạn là:</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#e11d48">
        {otp}
      </div>
      <p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">CardioGuard AI</p>
    </div>
    """
    return await send_system_email(
        email_type="password_reset",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "otp": otp, "role": role},
        fallback_subject=fallback_subject,
        fallback_html=fallback_html,
    )


async def send_random_password_email(email: str, full_name: str, new_password: str, role: Optional[str] = None) -> bool:
    fallback_subject = "CardioGuard AI - Mật khẩu mới của bạn"
    fallback_html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
      <p style="color:#374151">Xin chào <strong>{full_name}</strong>,</p>
      <p style="color:#374151">Mật khẩu của bạn đã được đặt lại thành công. Mật khẩu tạm thời của bạn là:</p>
      <div style="font-size:24px;font-weight:700;text-align:center;padding:24px 0;color:#e11d48">
        {new_password}
      </div>
      <p style="color:#6b7280;font-size:13px">Vui lòng đăng nhập với mật khẩu này. Bạn sẽ được yêu cầu đổi mật khẩu ngay sau khi đăng nhập thành công.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">CardioGuard AI</p>
    </div>
    """
    return await send_system_email(
        email_type="password_reset",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "new_password": new_password, "otp": new_password, "role": role},
        fallback_subject=fallback_subject,
        fallback_html=fallback_html,
    )


async def send_register_otp_email(email: str, full_name: str, otp: str, role: Optional[str] = "patient") -> bool:
    fallback_subject = "CardioGuard AI - Mã OTP đăng ký"
    fallback_html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
      <p style="color:#374151">Xin chào <strong>{full_name}</strong>,</p>
      <p style="color:#374151">Mã OTP đăng ký tài khoản của bạn là:</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#e11d48">
        {otp}
      </div>
      <p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">CardioGuard AI — Hệ thống giám sát tim mạch thông minh</p>
    </div>
    """
    return await send_system_email(
        email_type="otp_register",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "otp": otp, "role": role},
        fallback_subject=fallback_subject,
        fallback_html=fallback_html,
    )



@router.post("/auth/register/request-otp")
async def request_register_otp(data: RegisterOtpRequest, request: Request):
    ip = get_client_ip(request)
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/register/request-otp", max_requests=5, window_seconds=60)

    reg_role = (data.role or "patient").strip().lower()
    if reg_role == "admin":
        raise HTTPException(status_code=400, detail="Đăng ký tài khoản Admin không được phép công khai.")
    if reg_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Vai trò đăng ký không hợp lệ.")

    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": email}
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    otp = await create_otp_token(
        purpose=OTP_PURPOSE_REGISTER,
        email=email,
        metadata={
            "full_name": data.full_name,
            "role": reg_role,
            "phone": data.phone,
            "specialty": data.specialty,
            "department": data.department
        },
    )

    try:
        email_sent = await send_register_otp_email(email, data.full_name, otp, role=reg_role)
    except Exception as exc:
        await invalidate_otp_tokens(purpose=OTP_PURPOSE_REGISTER, email=email)
        logger.exception("Unable to send registration OTP email")
        raise HTTPException(status_code=502, detail="Unable to send OTP email. Please try again later.") from exc

    response = {"message": "OTP sent to email", "email": email, "email_sent": email_sent}
    return response


@router.post("/auth/register")
async def register(data: RegisterRequest, request: Request):
    email = data.email.lower()
    otp_result = await verify_otp_token(
        purpose=OTP_PURPOSE_REGISTER,
        email=email,
        otp=data.otp,
    )

    if not otp_result.is_valid:
        if otp_result.reason == "expired":
            raise HTTPException(status_code=400, detail="OTP expired")
        raise HTTPException(status_code=400, detail="Invalid OTP")

    insert_query = """
    INSERT INTO users(full_name, email, password_hash, role, phone, specialty, department, status, profile_completed, is_verified)
    VALUES (:full_name, :email, :password_hash, :role, :phone, :specialty, :department, 'pending_profile', FALSE, FALSE)
    """

    user_id = None
    try:
        async with database.transaction():
            check_query = "SELECT id FROM users WHERE email = :email"
            existing_user = await database.fetch_one(
                query=check_query,
                values={"email": email}
            )

            if existing_user:
                raise HTTPException(status_code=400, detail="Email already exists")

            role = otp_result.metadata.get("role") or data.role or "patient"
            role = role.strip().lower()
            if role == "admin":
                raise HTTPException(status_code=400, detail="Đăng ký tài khoản Admin không được phép công khai.")

            phone = otp_result.metadata.get("phone") or data.phone
            specialty = otp_result.metadata.get("specialty") or data.specialty
            department = otp_result.metadata.get("department") or data.department

            await database.execute(
                query=insert_query,
                values={
                    "full_name": otp_result.metadata.get("full_name") or data.full_name,
                    "email": email,
                    "password_hash": hash_password(data.password),
                    "role": role,
                    "phone": phone,
                    "specialty": specialty,
                    "department": department
                }
            )

            # Đồng bộ hồ sơ patient ngay sau đăng ký để tránh /patients/me trả null.
            created_user = await database.fetch_one(
                "SELECT id::text as id, full_name FROM users WHERE email = :email",
                {"email": email},
            )
            user_id = created_user["id"] if created_user else None
            if created_user and role == "patient":
                patient_columns = await database.fetch_all(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'patients'
                    """
                )
                patient_cols = {row["column_name"] for row in patient_columns}
                patient_values = {
                    "id": user_id,
                    "full_name": created_user["full_name"],
                }
                if "user_id" in patient_cols:
                    patient_values["user_id"] = user_id
                if "phone" in patient_cols:
                    patient_values["phone"] = phone
                insert_columns = ", ".join(patient_values.keys())
                bind_columns = ", ".join(f":{key}" for key in patient_values.keys())
                await database.execute(
                    f"INSERT INTO patients ({insert_columns}) VALUES ({bind_columns}) ON CONFLICT DO NOTHING",
                    patient_values,
                )
    except HTTPException:
        raise
    except Exception as exc:
        err_msg = str(exc).lower()
        if "unique constraint" in err_msg or "duplicate key" in err_msg:
            raise HTTPException(status_code=400, detail="Email already exists")
        raise

    # Ghi nhận log đăng ký thành công
    await log_activity(
        user_id=user_id,
        action="USER_REGISTER_SUCCESS",
        entity_type="users",
        entity_id=user_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"message": "Register successfully"}


@router.post("/auth/login")
async def login(data: LoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/login", max_requests=5, window_seconds=60)

    user_columns = await get_users_columns()
    select_cols = "id::text as id, full_name, email, password_hash, role"
    if "must_change_password" in user_columns:
        select_cols += ", must_change_password"
    else:
        select_cols += ", FALSE as must_change_password"
    if "status" in user_columns:
        select_cols += ", status"
    else:
        select_cols += ", NULL::text as status"
    if "profile_completed" in user_columns:
        select_cols += ", profile_completed"
    else:
        select_cols += ", FALSE as profile_completed"
    if "is_verified" in user_columns:
        select_cols += ", is_verified"
    else:
        select_cols += ", FALSE as is_verified"
    if "avatar_url" in user_columns:
        select_cols += ", avatar_url"
    else:
        select_cols += ", NULL::text as avatar_url"

    query = f"""
    SELECT {select_cols}
    FROM users
    WHERE email = :email
    """

    user = await database.fetch_one(
        query=query,
        values={"email": data.email.lower()}
    )

    ip_addr = request.client.host if request.client else "-"

    if not user:
        await log_activity(
            user_id=None,
            action="USER_LOGIN_FAILED",
            entity_type="users",
            ip_address=ip_addr,
            details={"email": data.email.lower(), "reason": "Email not found"}
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user["password_hash"]):
        await log_activity(
            user_id=None,
            action="USER_LOGIN_FAILED",
            entity_type="users",
            ip_address=ip_addr,
            details={"email": data.email.lower(), "reason": "Incorrect password"}
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if (user["status"] or "").strip().lower() in {"inactive", "disabled"}:
        await log_activity(
            user_id=user["id"],
            action="USER_LOGIN_FAILED",
            entity_type="users",
            entity_id=user["id"],
            ip_address=ip_addr,
            details={"email": data.email.lower(), "reason": "Account inactive or disabled"}
        )
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hóa")

    db_role = normalize_role(user["role"])

    # Xác thực expected_role
    if data.expected_role:
        expected = data.expected_role.strip().lower()
        if db_role != expected:
            await log_activity(
                user_id=user["id"],
                action="USER_LOGIN_FAILED",
                entity_type="users",
                entity_id=user["id"],
                ip_address=ip_addr,
                details={"email": data.email.lower(), "reason": f"Expected role {expected} but got {db_role}"}
            )
            
            if expected == "admin":
                detail_msg = "Tài khoản này không có quyền truy cập trang quản trị."
            elif expected == "doctor":
                detail_msg = "Tài khoản này không có quyền truy cập cổng bác sĩ."
            else:  # expected == "patient"
                if db_role == "admin":
                    detail_msg = "Vui lòng đăng nhập bằng cổng quản trị viên."
                elif db_role == "doctor":
                    detail_msg = "Vui lòng đăng nhập bằng cổng bác sĩ."
                else:
                    detail_msg = "Tài khoản này không có quyền truy cập cổng đăng nhập hiện tại."
            
            raise HTTPException(status_code=403, detail=detail_msg)

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": db_role
    })

    # Ghi nhận đăng nhập thành công
    await log_activity(
        user_id=user["id"],
        action="USER_LOGIN_SUCCESS",
        entity_type="users",
        entity_id=user["id"],
        ip_address=ip_addr
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": normalize_role(user["role"]),
            "status": user["status"],
            "must_change_password": user["must_change_password"],
            "profile_completed": bool(user["profile_completed"]),
            "is_verified": bool(user["is_verified"]),
            "avatar_url": user["avatar_url"]
        }
    }

@router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if not authorization:
        return {"message": "Logged out successfully"}
    try:
        token = extract_bearer_token(authorization)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            await database.execute(
                "INSERT INTO revoked_tokens (jti, expires_at) VALUES (:jti, :exp) ON CONFLICT DO NOTHING",
                {"jti": jti, "exp": expires_at}
            )
    except Exception:
        pass
    return {"message": "Logged out successfully"}


@router.post("/auth/forgot-password/request-otp")
async def request_forgot_password_otp(data: ForgotPasswordRequest, request: Request):
    ip = get_client_ip(request)
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/forgot-password/request-otp", max_requests=5, window_seconds=60)

    response = generic_forgot_password_response(email)
    user = await database.fetch_one(
        "SELECT id::text AS id, full_name, role FROM users WHERE email = :email",
        {"email": email},
    )
    
    if not user:
        return response

    otp = await create_otp_token(
        purpose=OTP_PURPOSE_FORGOT_PASSWORD,
        email=email,
        metadata={"user_id": user["id"], "full_name": user["full_name"]},
    )

    try:
        await send_forgot_password_otp_email(email, user["full_name"], otp, role=user["role"])
    except Exception as exc:
        logger.exception("Unable to send forgot-password OTP email")
        if settings.BREVO_API_KEY:
            await invalidate_otp_tokens(purpose=OTP_PURPOSE_FORGOT_PASSWORD, email=email)

    # Ghi nhận log yêu cầu OTP quên mật khẩu
    await log_activity(
        user_id=user["id"],
        action="PASSWORD_RESET_REQUEST_OTP",
        entity_type="users",
        entity_id=user["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return response


@router.post("/auth/forgot-password/verify-otp")
async def verify_forgot_password_otp(data: ForgotPasswordVerifyRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/forgot-password/verify-otp", max_requests=5, window_seconds=60)

    otp_result = await verify_otp_token(
        purpose=OTP_PURPOSE_FORGOT_PASSWORD,
        email=email,
        otp=data.otp,
    )

    if not otp_result.is_valid:
        if otp_result.reason == "expired":
            raise HTTPException(status_code=400, detail="OTP expired")
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user_id = otp_result.metadata.get("user_id")
    if user_id:
        user = await database.fetch_one(
            "SELECT id, full_name, role FROM users WHERE id::text = :id",
            {"id": user_id},
        )
    else:
        user = await database.fetch_one(
            "SELECT id, full_name, role FROM users WHERE email = :email",
            {"email": email},
        )
    if not user:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if data.new_password:
        new_password = data.new_password
        must_change_password = False
    else:
        import string
        from app.core.password_policy import PASSWORD_PATTERN
        chars = string.ascii_letters + string.digits + "@!#?$"
        while True:
            new_password = "".join(secrets.choice(chars) for _ in range(16))
            if PASSWORD_PATTERN.fullmatch(new_password):
                break
        must_change_password = True
    
    hashed_password = hash_password(new_password)

    await database.execute(
        """
        UPDATE users 
        SET password_hash = :password_hash, must_change_password = :must_change_password
        WHERE id = :id
        """,
        {"password_hash": hashed_password, "must_change_password": must_change_password, "id": user["id"]}
    )

    # Ghi nhận log khôi phục mật khẩu thành công qua OTP
    await log_activity(
        user_id=str(user["id"]),
        action="PASSWORD_RESET_VERIFY_OTP",
        entity_type="users",
        entity_id=str(user["id"]),
        ip_address=request.client.host if request.client else "-"
    )

    if data.new_password:
        return {"message": "Password has been reset successfully."}

    email_sent = await send_random_password_email(email, user["full_name"], new_password, role=user["role"])
    return {
        "message": "Password has been reset. Please check your email for the new password.",
        "email_sent": email_sent,
    }


@router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    current_user = await get_user_from_token(
        authorization,
        allow_must_change_password=True,
        allow_uncompleted=True,
        allow_unverified=True,
    )
    
    user = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id::text = :id",
        {"id": current_user["id"]}
    )

    if not verify_password(data.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    await database.execute(
        """
        UPDATE users 
        SET password_hash = :password_hash, must_change_password = FALSE
        WHERE id::text = :id
        """,
        {"password_hash": hash_password(data.new_password), "id": current_user["id"]}
    )

    # Ghi nhận log đổi mật khẩu thành công
    await log_activity(
        user_id=current_user["id"],
        action="USER_PASSWORD_CHANGE",
        entity_type="users",
        entity_id=current_user["id"],
        ip_address=request.client.host if request.client else "-"
    )

    try:
        token = extract_bearer_token(authorization)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            await database.execute(
                "INSERT INTO revoked_tokens (jti, expires_at) VALUES (:jti, :exp) ON CONFLICT DO NOTHING",
                {"jti": jti, "exp": expires_at}
            )
    except Exception:
        pass

    new_token = create_access_token({
        "sub": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"],
    })
    updated_user = {
        **current_user,
        "must_change_password": False,
    }

    return {
        "message": "Password changed successfully",
        "access_token": new_token,
        "token_type": "bearer",
        "user": updated_user,
    }



@router.get("/auth/me")
async def me(authorization: Optional[str] = Header(default=None)):
    return {
        "user": await get_user_from_token(
            authorization,
            allow_must_change_password=True,
            allow_uncompleted=True,
            allow_unverified=True,
        )
    }
