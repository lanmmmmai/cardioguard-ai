"""API Xác thực và Phân quyền.

Mục đích:
    Xử lý đăng ký người dùng (kèm xác thực OTP qua email), đăng nhập (dựa trên JWT),
    đăng xuất (thu hồi token), quản lý mật khẩu (quên/đặt lại/thay đổi) và
    xác thực token. Đóng vai trò là cổng xác thực trung tâm cho tất cả
    các module API khác.

Luồng xử lý:
    Đăng ký sử dụng luồng OTP hai bước: request-otp gửi mã đến email của
    người dùng; register xác thực OTP và tạo tài khoản. Đăng nhập
    xác thực thông tin đăng nhập và trả về JWT đã ký. Đăng xuất thu hồi JWT
    bằng cách lưu trữ JTI của nó trong bảng revoked_tokens. Đặt lại mật khẩu
    sử dụng luồng OTP riêng với tùy chọn tạo mật khẩu ngẫu nhiên.
    Tất cả các sự kiện xác thực đều được ghi lại qua audit_service.

Quan hệ:
    - Phụ thuộc vào: core.security để tạo/xác thực JWT và băm
    - Phụ thuộc vào: core.rate_limit để giới hạn tốc độ các endpoint xác thực
    - Phụ thuộc vào: services.otp_service cho vòng đời token OTP
    - Phụ thuộc vào: services.audit_service để ghi nhật ký hoạt động
    - Phụ thuộc vào: services.email_service để gửi email OTP/mật khẩu
    - Được sử dụng bởi: Tất cả các module API khác thông qua get_user_from_token
"""

import asyncio
import secrets
import requests
import logging
import time
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

_USER_CACHE_TTL = 30  # 30 seconds - short TTL for auth freshness
_user_cache: dict[str, tuple[dict, float]] = {}
_user_cache_lock = asyncio.Lock()


def normalize_role(role: Optional[str]) -> str:
    """Xác thực và chuẩn hóa chuỗi vai trò.

    Args:
        role: Chuỗi vai trò thô (ví dụ: 'Admin', 'DOCTOR').

    Returns:
        Chuỗi vai trò đã được chuẩn hóa thành chữ thường.

    Raises:
        HTTPException 403: Nếu vai trò không nằm trong VALID_ROLES.
    """
    normalized = (role or "").strip().lower()
    if normalized not in VALID_ROLES:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phân quyền")
    return normalized


def generic_forgot_password_response(email: str) -> dict[str, object]:
    """Trả về phản hồi chuẩn hóa cho yêu cầu quên mật khẩu.

    Luôn trả về cùng một tin nhắn bất kể email có tồn tại hay không,
    để ngăn chặn tấn công liệt kê người dùng.

    Args:
        email: Địa chỉ email do người dùng gửi lên.

    Returns:
        Dict chứa message, email và cờ email_sent.
    """
    return {
        "message": "If the email exists, an OTP will be sent.",
        "email": email,
        "email_sent": bool(settings.BREVO_API_KEY),
    }


def extract_bearer_token(authorization: Optional[str]) -> str:
    """Trích xuất chuỗi token JWT từ header Authorization.

    Args:
        authorization: Giá trị header Authorization thô (ví dụ: 'Bearer <token>').

    Returns:
        Chuỗi token.

    Raises:
        HTTPException 401: Nếu header bị thiếu hoặc không phải Bearer token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


_users_columns_cache: Optional[set[str]] = None
_users_columns_lock = asyncio.Lock()

async def get_users_columns() -> set[str]:
    """Lấy tập hợp tên cột cho bảng users.

    Kết quả được lưu vào bộ nhớ đệm toàn cục sau truy vấn đầu tiên để tránh
    tra cứu information_schema lặp đi lặp lại.

    Returns:
        Tập hợp các chuỗi tên cột cho bảng public.users.
    """
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
    """Xác thực JWT và trả về người dùng đã xác thực.

    Giải mã token, kiểm tra thu hồi, lấy dữ liệu người dùng với lựa chọn
    cột động, xác thực trạng thái và tùy chọn kiểm tra cờ must_change_password.

    Args:
        authorization: Chuỗi token Bearer từ header Authorization.
        allow_must_change_password: Nếu True, bỏ qua kiểm tra must_change_password
            (được sử dụng cho chính luồng đổi mật khẩu).

    Returns:
        Dict với các trường người dùng: id, full_name, email, phone, role,
        created_at, status, must_change_password.

    Raises:
        HTTPException 401: Nếu token bị thiếu, không hợp lệ, hết hạn hoặc bị thu hồi.
        HTTPException 401: Nếu không tìm thấy người dùng.
        HTTPException 403: Nếu tài khoản không hoạt động hoặc phải đổi mật khẩu.
    """
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

    # Check user cache first (skip revoked check for cached non-revoked users)
    async with _user_cache_lock:
        if user_id in _user_cache:
            cached_user, cached_at = _user_cache[user_id]
            if time.monotonic() - cached_at < _USER_CACHE_TTL:
                result = dict(cached_user)
                if result["must_change_password"] and not allow_must_change_password:
                    raise HTTPException(
                        status_code=403,
                        detail="Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống",
                    )
                if not result["profile_completed"] and not allow_uncompleted:
                    if result["role"] in {"patient", "doctor"}:
                        raise HTTPException(
                            status_code=403,
                            detail="Tài khoản chưa hoàn thiện hồ sơ. Vui lòng hoàn thiện hồ sơ trước khi tiếp tục.",
                        )
                return result

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
        WHERE id = :user_id::uuid
        """,
        {"user_id": user_id}
    )

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if (user["status"] or "").strip().lower() in {"inactive", "disabled", "deleted"}:
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

    # Cache user for 30s to avoid repeated DB lookups
    async with _user_cache_lock:
        _user_cache[user_id] = (result, time.monotonic())

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
    """Gửi email OTP đặt lại mật khẩu đến người dùng.

    Args:
        email: Địa chỉ email người nhận.
        full_name: Họ và tên người nhận cho lời chào.
        otp: Mã OTP 6 chữ số.
        role: Vai trò người dùng cho ngữ cảnh biến template.

    Returns:
        True nếu email được gửi thành công, False nếu không.
    """
    return await send_system_email(
        email_type="password_reset",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "otp": otp, "role": role},
    )


async def send_random_password_email(email: str, full_name: str, new_password: str, role: Optional[str] = None) -> bool:
    """Gửi mật khẩu được tạo ngẫu nhiên đến người dùng qua email.

    Args:
        email: Địa chỉ email người nhận.
        full_name: Họ và tên người nhận cho lời chào.
        new_password: Mật khẩu tạm thời mới được tạo.
        role: Vai trò người dùng cho ngữ cảnh biến template.

    Returns:
        True nếu email được gửi thành công, False nếu không.
    """
    return await send_system_email(
        email_type="password_reset",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "new_password": new_password, "otp": new_password, "role": role},
    )


async def send_register_otp_email(email: str, full_name: str, otp: str, role: Optional[str] = "patient") -> bool:
    """Gửi email OTP đăng ký đến người dùng.

    Args:
        email: Địa chỉ email người nhận.
        full_name: Họ và tên người nhận.
        otp: Mã OTP 6 chữ số để xác thực đăng ký.
        role: Vai trò người dùng (mặc định là 'patient').

    Returns:
        True nếu email được gửi thành công, False nếu không.
    """
    return await send_system_email(
        email_type="otp_register",
        to_email=email,
        to_name=full_name,
        variables={"full_name": full_name, "otp": otp, "role": role},
    )



@router.post("/auth/register/request-otp")
async def request_register_otp(data: RegisterOtpRequest, request: Request):
    """Bước 1 của đăng ký: yêu cầu mã OTP qua email.

    Giới hạn tốc độ 5 yêu cầu mỗi 60 giây cho mỗi cặp IP/email.
    Nếu email đã tồn tại, trả về lỗi để ngăn đăng ký trùng lặp.

    Args:
        data: RegisterOtpRequest với email và full_name.
        request: FastAPI Request để trích xuất IP.

    Returns:
        Xác nhận rằng OTP đã được gửi.

    Raises:
        HTTPException 400: Nếu email đã tồn tại.
        HTTPException 502: Nếu gửi email thất bại.
    """
    ip = get_client_ip(request)
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/register/request-otp", max_requests=5, window_seconds=60)

    reg_role = (data.role or "patient").strip().lower()
    logger.debug("Entry: request_register_otp(email=%s, role=%s)", email, reg_role)
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
        logger.exception("Không thể gửi email OTP đăng ký")
        raise HTTPException(status_code=502, detail="Unable to send OTP email. Please try again later.") from exc

    response = {"message": "OTP sent to email", "email": email, "email_sent": email_sent}
    return response


@router.post("/auth/register")
async def register(data: RegisterRequest, request: Request):
    """Bước 2 của đăng ký: xác thực OTP và tạo tài khoản.

    Xác thực OTP, sau đó chèn người dùng trong một giao dịch.
    Tự động tạo một hàng tương ứng trong bảng patients cho
    tài khoản bệnh nhân mới để tránh hồ sơ null.

    Args:
        data: RegisterRequest với email, OTP, full_name và password.
        request: FastAPI Request để trích xuất IP.

    Returns:
        Tin nhắn thành công.

    Raises:
        HTTPException 400: Nếu OTP không hợp lệ/hết hạn hoặc email đã tồn tại.
    """
    email = data.email.lower()
    logger.debug("Entry: register(email=%s)", email)
    otp_result = await verify_otp_token(
        purpose=OTP_PURPOSE_REGISTER,
        email=email,
        otp=data.otp,
    )

    if not otp_result.is_valid:
        if otp_result.reason == "expired":
            logger.info("Register OTP expired for email=%s", email)
            raise HTTPException(status_code=400, detail="OTP expired")
        logger.info("Invalid register OTP for email=%s", email)
        raise HTTPException(status_code=400, detail="Invalid OTP")
    logger.info("Register OTP valid for email=%s", email)

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
        logger.exception("Registration failed unexpectedly for email=%s", email)
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
    """Xác thực người dùng và trả về mã thông báo truy cập JWT.

    Giới hạn tốc độ 5 lần thử mỗi 60 giây. Xác thực sự tồn tại của email,
    tính đúng đắn của mật khẩu và trạng thái tài khoản. Ghi lại tất cả các
    lần đăng nhập thất bại và thành công qua audit_service.

    Args:
        data: LoginRequest với email và password.
        request: FastAPI Request để trích xuất IP.

    Returns:
        Dict chứa access_token, token_type và thông tin người dùng.

    Raises:
        HTTPException 401: Nếu email hoặc mật khẩu không hợp lệ.
        HTTPException 403: Nếu tài khoản không hoạt động.
    """
    ip = request.client.host if request.client else "unknown"
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/login", max_requests=5, window_seconds=60)
    logger.debug("Entry: login(email=%s)", email)

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

    if (user["status"] or "").strip().lower() in {"inactive", "disabled", "deleted"}:
        await log_activity(
            user_id=user["id"],
            action="USER_LOGIN_FAILED",
            entity_type="users",
            entity_id=user["id"],
            ip_address=ip_addr,
            details={"email": data.email.lower(), "reason": "Account inactive, disabled or deleted"}
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

    logger.info("Login successful: email=%s role=%s", email, db_role)

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
    """Đăng xuất bằng cách thu hồi token JWT hiện tại.

    Trích xuất JTI từ token và lưu trữ nó trong bảng revoked_tokens
    để nó không thể được sử dụng lại. Bỏ qua lỗi một cách im lặng (ví dụ: nếu
    không có token nào được cung cấp hoặc token đã hết hạn).

    Args:
        authorization: Token Bearer cần thu hồi.

    Returns:
        Tin nhắn thành công.
    """
    if not authorization:
        return {"message": "Logged out successfully"}
    try:
        token = extract_bearer_token(authorization)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        user_id = payload.get("sub")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            await database.execute(
                "INSERT INTO revoked_tokens (jti, expires_at) VALUES (:jti, :exp) ON CONFLICT DO NOTHING",
                {"jti": jti, "exp": expires_at}
            )
        # Invalidate user cache on logout
        if user_id:
            async with _user_cache_lock:
                _user_cache.pop(user_id, None)
    except Exception as exc:
        logger.warning("Logout: failed to revoke token: %s", exc)
    return {"message": "Logged out successfully"}


@router.post("/auth/forgot-password/request-otp")
async def request_forgot_password_otp(data: ForgotPasswordRequest, request: Request):
    """Bước 1 của quên mật khẩu: yêu cầu OTP đặt lại mật khẩu.

    Luôn trả về cùng một phản hồi bất kể email có tồn tại hay không
    (ngăn chặn liệt kê). Nếu email tồn tại, tạo và gửi OTP.
    Giới hạn tốc độ 5 yêu cầu mỗi 60 giây.

    Args:
        data: ForgotPasswordRequest với email.
        request: FastAPI Request để trích xuất IP.

    Returns:
        Phản hồi chung cho biết OTP đã được gửi nếu email tồn tại.
    """
    ip = get_client_ip(request)
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/forgot-password/request-otp", max_requests=5, window_seconds=60)
    logger.debug("Entry: request_forgot_password_otp(email=%s)", email)

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
        logger.exception("Không thể gửi email OTP quên mật khẩu")
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
    """Bước 2 của quên mật khẩu: xác thực OTP và đặt lại mật khẩu.

    Nếu new_password được cung cấp, sử dụng trực tiếp. Nếu không, tạo
    mật khẩu ngẫu nhiên 16 ký tự và gửi email cho người dùng, đặt
    cờ must_change_password để buộc thay đổi ở lần đăng nhập tiếp theo.

    Args:
        data: ForgotPasswordVerifyRequest với email, OTP và tùy chọn
              new_password.
        request: FastAPI Request để trích xuất IP.

    Returns:
        Tin nhắn thành công, tùy chọn kèm trạng thái email_sent.

    Raises:
        HTTPException 400: Nếu OTP không hợp lệ hoặc hết hạn.
    """
    ip = request.client.host if request.client else "unknown"
    email = data.email.lower()
    check_rate_limit(ip, email, "/auth/forgot-password/verify-otp", max_requests=5, window_seconds=60)
    logger.debug("Entry: verify_forgot_password_otp(email=%s)", email)

    otp_result = await verify_otp_token(
        purpose=OTP_PURPOSE_FORGOT_PASSWORD,
        email=email,
        otp=data.otp,
    )

    if not otp_result.is_valid:
        if otp_result.reason == "expired":
            logger.info("OTP expired for email=%s", email)
            raise HTTPException(status_code=400, detail="OTP expired")
        logger.info("Invalid OTP for email=%s", email)
        raise HTTPException(status_code=400, detail="Invalid OTP")
    logger.info("OTP valid for email=%s", email)

    user_id = otp_result.metadata.get("user_id")
    if user_id:
        user = await database.fetch_one(
            "SELECT id, full_name, role FROM users WHERE id = :id::uuid",
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
    """Thay đổi mật khẩu của người dùng đã xác thực.

    Xác thực mật khẩu cũ, cập nhật sang mật khẩu mới, xóa cờ
    must_change_password và thu hồi token hiện tại để người dùng
    phải đăng nhập lại với mật khẩu mới.

    Args:
        data: ChangePasswordRequest với old_password và new_password.
        request: FastAPI Request để trích xuất IP.
        authorization: Token Bearer.

    Returns:
        Tin nhắn thành công.

    Raises:
        HTTPException 400: Nếu mật khẩu cũ không chính xác.
    """
    current_user = await get_user_from_token(
        authorization,
        allow_must_change_password=True,
        allow_uncompleted=True,
        allow_unverified=True,
    )
    logger.debug("Entry: change_password(user_id=%s)", current_user["id"])

    user = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id = :id::uuid",
        {"id": current_user["id"]}
    )

    if not verify_password(data.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    await database.execute(
        """
        UPDATE users 
        SET password_hash = :password_hash, must_change_password = FALSE
        WHERE id = :id::uuid
        """,
        {"password_hash": hash_password(data.new_password), "id": current_user["id"]}
    )

    # Invalidate user cache on password change
    async with _user_cache_lock:
        _user_cache.pop(current_user["id"], None)

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
    """Lấy hồ sơ của người dùng đã xác thực hiện tại.

    Sử dụng allow_must_change_password=True để những người dùng cần thay đổi
    mật khẩu vẫn có thể truy cập endpoint này.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict chứa đối tượng người dùng đã xác thực.
    """
    logger.debug("Entry: me()")
    return {
        "user": await get_user_from_token(
            authorization,
            allow_must_change_password=True,
            allow_uncompleted=True,
            allow_unverified=True,
        )
    }
