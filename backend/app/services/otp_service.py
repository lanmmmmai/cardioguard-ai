import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict
from uuid import uuid4

from app.core.config import settings
from app.core.database import database


OTP_PURPOSE_REGISTER = "register"
OTP_PURPOSE_FORGOT_PASSWORD = "forgot_password"
OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


@dataclass
class OtpVerificationResult:
    is_valid: bool
    reason: str
    metadata: dict[str, Any]


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(purpose: str, email: str, otp: str) -> str:
    normalized = f"{purpose}:{email.lower()}:{otp.strip()}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), normalized, hashlib.sha256).hexdigest()


def parse_metadata(value: Any) -> dict[str, Any]:
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


async def create_otp_token(
    *,
    purpose: str,
    email: str,
    metadata: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = OTP_TTL_MINUTES,
    max_attempts: int = OTP_MAX_ATTEMPTS,
) -> str:
    normalized_email = email.lower()
    otp = generate_otp()

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

    return otp


async def invalidate_otp_tokens(*, purpose: str, email: str) -> None:
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
        return OtpVerificationResult(False, "invalid", {})

    now = datetime.now(timezone.utc)
    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        await consume_otp_token(row["id"])
        return OtpVerificationResult(False, "expired", {})

    if row["attempts"] >= row["max_attempts"]:
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
            WHERE id::text = :id
            """,
            {"id": row["id"]},
        )
        return OtpVerificationResult(False, "invalid", {})

    consumed = await database.fetch_one(
        """
        UPDATE auth_otp_tokens
        SET consumed_at = NOW()
        WHERE id::text = :id
          AND consumed_at IS NULL
        RETURNING metadata::text AS metadata
        """,
        {"id": row["id"]},
    )

    if not consumed:
        return OtpVerificationResult(False, "invalid", {})

    return OtpVerificationResult(True, "valid", parse_metadata(consumed["metadata"]))


async def consume_otp_token(token_id: str) -> None:
    await database.execute(
        "UPDATE auth_otp_tokens SET consumed_at = NOW() WHERE id::text = :id AND consumed_at IS NULL",
        {"id": token_id},
    )
