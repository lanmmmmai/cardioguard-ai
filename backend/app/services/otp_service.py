"""Dịch vụ Mật khẩu Một lần (OTP) cho CardioGuard.

Mục đích:
    Cung cấp khả năng tạo, lưu trữ và xác minh OTP an toàn cho các luồng xác thực
    (đăng ký, đặt lại mật khẩu). OTP được băm HMAC-SHA256 trước khi
    lưu trữ; OTP dạng văn bản thuần không bao giờ được lưu trữ.

Luồng công việc:
    1. create_otp_token() tạo một OTP số gồm 6 chữ số, băm nó bằng
       HMAC-SHA256 (khóa bởi SECRET_KEY) và lưu trữ băm cùng với mục đích,
       email, thời gian hết hạn và giới hạn số lần thử trong bảng auth_otp_tokens.
    2. verify_otp_token() tra cứu mã thông báo chưa sử dụng gần đây nhất, kiểm tra
       thời gian hết hạn và số lần thử, so sánh OTP được cung cấp qua so sánh
       thời gian cố định và đánh dấu mã thông báo là đã sử dụng khi thành công hoặc khi
       vượt quá giới hạn.

Quan hệ:
    - app.core.config.settings.SECRET_KEY: Được sử dụng làm khóa HMAC cho băm OTP.
    - app.core.database.database: Tất cả trạng thái mã thông báo được quản lý trong auth_otp_tokens.
    - Cũng quản lý bảng revoked_tokens (được sử dụng bởi luồng danh sách đen JWT).
    - Được gọi từ các tuyến xác thực và luồng quản trị yêu cầu xác minh email.
"""

import hashlib
import hmac
import json
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict
from uuid import uuid4

from app.core.config import settings
from app.core.database import database

logger = logging.getLogger(__name__)


OTP_PURPOSE_REGISTER = "register"
OTP_PURPOSE_FORGOT_PASSWORD = "forgot_password"
OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


@dataclass
class OtpVerificationResult:
    """Kết quả của một lần thử xác minh OTP.

    Thuộc tính:
        is_valid: True nếu OTP khớp và nằm trong tất cả các giới hạn.
        reason: Chuỗi mã ngắn — "valid", "invalid" hoặc "expired".
        metadata: Tải trọng tùy ý được lưu trữ cùng với mã thông báo (ví dụ: email đang chờ xử lý).
    """
    is_valid: bool
    reason: str
    metadata: dict[str, Any]


def generate_otp() -> str:
    """Tạo một chuỗi OTP 6 chữ số an toàn về mặt mật mã."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(purpose: str, email: str, otp: str) -> str:
    """Tạo một thông báo HMAC-SHA256 của OTP để lưu trữ an toàn.

    Đầu vào được chuẩn hóa dưới dạng ``purpose:email:otp`` (email viết thường,
    OTP được cắt bỏ khoảng trắng) và được băm với SECRET_KEY của ứng dụng. Điều này
    đảm bảo OTP dạng văn bản thuần không bao giờ được ghi vào cơ sở dữ liệu.

    Args:
        purpose: Chuỗi mục đích OTP (ví dụ: "register").
        email: Địa chỉ email của người dùng (không phân biệt chữ hoa/thường).
        otp: OTP 6 chữ số thô.

    Trả về:
        Thông báo SHA-256 HMAC được mã hóa hex.
    """
    normalized = f"{purpose}:{email.lower()}:{otp.strip()}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), normalized, hashlib.sha256).hexdigest()


def parse_metadata(value: Any) -> dict[str, Any]:
    """Phân tích cột siêu dữ liệu thành dict một cách an toàn.

    Xử lý ba trường hợp phổ biến: đã là dict, None/rỗng hoặc chuỗi JSON.

    Args:
        value: Giá trị siêu dữ liệu thô từ cơ sở dữ liệu (dict, str hoặc None).

    Trả về:
        Một dict (có thể rỗng) đại diện cho siêu dữ liệu.
    """
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(str(value))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def ensure_otp_table() -> None:
    """Tạo các bảng auth_otp_tokens và revoked_tokens nếu chúng chưa tồn tại.

    Cũng tạo các chỉ mục hỗ trợ cho việc tra cứu hiệu quả theo mục đích+email
    và theo thời gian hết hạn. Đây là một khởi tạo nhẹ không thay đổi — an toàn
    để gọi trên mỗi lần khởi động ứng dụng.
    """
    await database.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_otp_tokens (
            id           UUID        PRIMARY KEY,
            purpose      TEXT        NOT NULL CHECK (purpose IN ('register', 'forgot_password')),
            email        TEXT        NOT NULL,
            otp_hash     TEXT        NOT NULL,
            metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
            attempts     INTEGER     NOT NULL DEFAULT 0,
            max_attempts INTEGER     NOT NULL DEFAULT 5,
            expires_at   TIMESTAMPTZ NOT NULL,
            consumed_at  TIMESTAMPTZ,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await database.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_lookup
        ON auth_otp_tokens (purpose, email, consumed_at, created_at DESC)
        """
    )
    await database.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_auth_otp_tokens_expires_at
        ON auth_otp_tokens (expires_at)
        """
    )
    # Đảm bảo bảng revoked_tokens tồn tại phòng trường hợp chưa chạy migration 011
    await database.execute(
        """
        CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti        TEXT        PRIMARY KEY,
            expires_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    await database.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
        ON revoked_tokens (expires_at)
        """
    )


async def create_otp_token(
    *,
    purpose: str,
    email: str,
    metadata: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = OTP_TTL_MINUTES,
    max_attempts: int = OTP_MAX_ATTEMPTS,
) -> str:
    """Tạo một mã OTP mới cho mục đích và email cụ thể.

    Trong một giao dịch:
        1. Đánh dấu tất cả các mã chưa sử dụng hiện có cho cùng (mục đích, email)
           là đã sử dụng (đảm bảo chỉ một mã hoạt động trên mỗi người dùng trên mỗi mục đích).
        2. Tạo OTP 6 chữ số mới, tính toán băm HMAC và chèn
           một hàng mới với TTL và số lần thử tối đa đã cấu hình.

    Args:
        purpose: Mục đích sử dụng — "register" hoặc "forgot_password".
        email: Địa chỉ email của người dùng (sẽ được chuyển thành chữ thường để lưu trữ).
        metadata: Dict tùy chọn được lưu cùng với mã thông báo (ví dụ: dữ liệu đang chờ xử lý).
        ttl_minutes: Thời gian tồn tại của mã này (mặc định: 10).
        max_attempts: Số lần thử xác minh tối đa trước khi tự động sử dụng.

    Trả về:
        Chuỗi OTP dạng văn bản thuần (sẽ được gửi đến người dùng qua email).
    """
    normalized_email = email.lower()
    otp = generate_otp()

    async with database.transaction():
        await database.execute(
            """
            UPDATE auth_otp_tokens
            SET consumed_at = NOW()
            WHERE purpose = :purpose
              AND email = :email
              AND consumed_at IS NULL
            """,
            {"purpose": purpose, "email": normalized_email},
        )

        await database.execute(
            """
            INSERT INTO auth_otp_tokens (
                id, purpose, email, otp_hash, metadata, max_attempts, expires_at
            )
            VALUES (
                :id, :purpose, :email, :otp_hash, CAST(:metadata AS JSONB), :max_attempts, :expires_at
            )
            """,
            {
                "id": str(uuid4()),
                "purpose": purpose,
                "email": normalized_email,
                "otp_hash": hash_otp(purpose, normalized_email, otp),
                "metadata": json.dumps(metadata or {}),
                "max_attempts": max_attempts,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
            },
        )

    logger.info("OTP created: purpose=%s email=%s ttl=%dmin", purpose, normalized_email, ttl_minutes)
    return otp


async def invalidate_otp_tokens(*, purpose: str, email: str) -> None:
    """Đánh dấu tất cả các mã OTP chưa sử dụng cho mục đích+email cụ thể là đã sử dụng.

    Được sử dụng để vô hiệu hóa các mã đang chờ xử lý, ví dụ: sau khi đăng ký thành công
    hoàn tất hoặc đặt lại mật khẩu được thực hiện, để các mã còn lại không thể bị
    phát lại.

    Args:
        purpose: Mục đích OTP cần nhắm mục tiêu ("register" / "forgot_password").
        email: Địa chỉ email của người dùng (không phân biệt chữ hoa/thường).
    """
    await database.execute(
        """
        UPDATE auth_otp_tokens
        SET consumed_at = NOW()
        WHERE purpose = :purpose
          AND email = :email
          AND consumed_at IS NULL
        """,
        {"purpose": purpose, "email": email.lower()},
    )


async def verify_otp_token(*, purpose: str, email: str, otp: str) -> OtpVerificationResult:
    """Xác minh một mã OTP cho mục đích và email cụ thể.

    Các bước:
        1. Tìm nạp mã chưa sử dụng gần đây nhất khớp với (mục đích, email).
        2. Từ chối nếu không có mã nào, mã đã hết hạn hoặc đã đạt số lần thử tối đa.
        3. So sánh OTP được cung cấp với băm HMAC đã lưu trữ bằng cách sử dụng
           so sánh thời gian cố định để ngăn chặn các cuộc tấn công timing.
        4. Nếu không khớp, tăng bộ đếm số lần thử (và tự động sử dụng nếu
           đạt max_attempts).
        5. Nếu khớp, đánh dấu mã là đã sử dụng và trả về siêu dữ liệu đã lưu trữ.

    Args:
        purpose: Mục đích OTP ("register" / "forgot_password").
        email: Địa chỉ email của người dùng (không phân biệt chữ hoa/thường).
        otp: OTP dạng văn bản thuần do người dùng cung cấp.

    Trả về:
        OtpVerificationResult với is_valid (bool), reason (str) và metadata.
    """
    normalized_email = email.lower()
    row = await database.fetch_one(
        """
        SELECT id::text AS id, otp_hash, metadata::text AS metadata, attempts, max_attempts, expires_at
        FROM auth_otp_tokens
        WHERE purpose = :purpose
          AND email = :email
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"purpose": purpose, "email": normalized_email},
    )

    if not row:
        logger.warning("OTP verify failed: purpose=%s email=%s reason=no_token_found", purpose, normalized_email)
        return OtpVerificationResult(False, "invalid", {})

    now = datetime.now(timezone.utc)
    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        logger.warning("OTP verify failed: purpose=%s email=%s reason=expired", purpose, normalized_email)
        await consume_otp_token(row["id"])
        return OtpVerificationResult(False, "expired", {})

    if row["attempts"] >= row["max_attempts"]:
        logger.warning("OTP verify failed: purpose=%s email=%s reason=max_attempts_exceeded", purpose, normalized_email)
        await consume_otp_token(row["id"])
        return OtpVerificationResult(False, "invalid", {})

    expected_hash = hash_otp(purpose, normalized_email, otp)
    if not hmac.compare_digest(str(row["otp_hash"]), expected_hash):
        await database.execute(
            """
            UPDATE auth_otp_tokens
            SET attempts = attempts + 1,
                consumed_at = CASE
                    WHEN attempts + 1 >= max_attempts THEN NOW()
                    ELSE consumed_at
                END
            WHERE id = :id::uuid
            """,
            {"id": row["id"]},
        )
        return OtpVerificationResult(False, "invalid", {})

    consumed = await database.fetch_one(
        """
        UPDATE auth_otp_tokens
        SET consumed_at = NOW()
        WHERE id = :id::uuid
          AND consumed_at IS NULL
        RETURNING metadata::text AS metadata
        """,
        {"id": row["id"]},
    )

    if not consumed:
        return OtpVerificationResult(False, "invalid", {})

    return OtpVerificationResult(True, "valid", parse_metadata(consumed["metadata"]))


async def consume_otp_token(token_id: str) -> None:
    """Đánh dấu một mã OTP là đã sử dụng mà không có điều kiện theo UUID của nó.

    Được sử dụng nội bộ bởi verify_otp_token khi một mã đã hết hạn hoặc vượt quá
    giới hạn số lần thử của nó, để ngăn chặn các lần thử xác minh tiếp theo.

    Args:
        token_id: UUID của hàng mã thông báo cần sử dụng.
    """
    await database.execute(
        "UPDATE auth_otp_tokens SET consumed_at = NOW() WHERE id = :id::uuid AND consumed_at IS NULL",
        {"id": token_id},
    )
