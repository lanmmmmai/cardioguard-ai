# =============================================================================
# CardioGuard AI — Email CMS API
# File: backend/app/api/email_api.py
# Các endpoint quản lý template email và gửi email hệ thống
# =============================================================================

import csv
import io
import json
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from fastapi import APIRouter, File, Header, HTTPException, Query, Response, UploadFile, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.api.auth_api import get_user_from_token
from app.core.config import settings
from app.core.sqlalchemy_async import AsyncSessionLocal
from app.services.audit_service import log_activity
from app.services.email_service import (
    EMAIL_TEMPLATE_CATALOG,
    DEFAULT_TEMPLATE_VARIABLES,
    EMAIL_TYPE_ALIASES,
    find_email_template,
    normalize_cms_email_id,
    normalize_email_type,
    render_and_deliver_email,
    render_template,
)

router = APIRouter(prefix="/email", tags=["email"])
cms_router = APIRouter(prefix="/cms", tags=["cms_email"])
logger = logging.getLogger(__name__)

SUPPORTED_VARIABLES = DEFAULT_TEMPLATE_VARIABLES

VALID_EMAIL_TYPES = {
    "otp_register",
    "otp_login",
    "welcome",
    "reset_password",
    "emergency_alert",
    "appointment_reminder",
    "doctor_assignment",
    "health_alert",
    "monthly_report",
    "doctor_pending_verification",
    "doctor_verified",
    "doctor_rejected",
    "doctor_need_update",
}

LEGACY_EMAIL_TYPES = set(EMAIL_TYPE_ALIASES.keys())


# -----------------------------------------------------------
# Schemas
# -----------------------------------------------------------

class TemplateCreate(BaseModel):
    cms_email_id: Optional[str] = None
    email_type: str
    name: str
    subject: str
    html_content: str
    text_content: str = ""
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True


class TemplateUpdate(BaseModel):
    cms_email_id: Optional[str] = None
    email_type: Optional[str] = None
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    variables: Optional[list[str]] = None
    is_active: Optional[bool] = None


class SendEmailRequest(BaseModel):
    template_id: Optional[str] = None      # Dùng template có sẵn
    email_type: Optional[str] = None
    cms_email_id: Optional[str] = None
    to_email: str
    cc: Optional[str] = None
    bcc: Optional[str] = None
    subject: Optional[str] = None          # Override subject nếu không dùng template
    html_content: Optional[str] = None     # Override html nếu không dùng template
    text_content: Optional[str] = None
    variables: dict[str, str] = Field(default_factory=dict)      # Biến động: {"full_name": "Nguyễn Văn A"}


class PreviewRequest(BaseModel):
    html_content: str
    variables: dict[str, str] = Field(default_factory=dict)


# -----------------------------------------------------------
# Helper functions
# -----------------------------------------------------------

async def require_admin(authorization: Optional[str]) -> dict[str, Any]:
    """Kiểm tra quyền admin."""
    user = await get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền truy cập Email CMS")
    return user


from app.services.email_service import render_template


def send_brevo_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
) -> bool:
    """Gửi email qua Brevo API, hoặc fallback sang SMTP nếu không có Brevo API Key."""
    if not settings.BREVO_API_KEY:
        if settings.SMTP_HOST:
            from app.services.email_service import send_smtp_email_sync
            return send_smtp_email_sync(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                html_body=html_body,
                cc=cc,
                bcc=bcc,
            )
        logger.info("Email CMS dev send skipped: subject logged suppressed")
        return False

    payload: dict[str, Any] = {
        "sender": {
            "name": settings.SMTP_FROM_NAME or settings.EMAIL_FROM_NAME or "CardioGuard AI",
            "email": settings.SMTP_FROM_EMAIL or settings.EMAIL_FROM_EMAIL or "noreply@giatky.site",
        },
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_body,
    }
    if cc:
        payload["cc"] = [{"email": addr.strip()} for addr in cc.split(",") if addr.strip()]
    if bcc:
        payload["bcc"] = [{"email": addr.strip()} for addr in bcc.split(",") if addr.strip()]

    response = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    response.raise_for_status()
    return True


def normalize_variables_value(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [part.strip() for part in re.split(r"[\n,;]+", text) if part.strip()]
    return [str(value).strip()]


def template_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    result = dict(row)
    for key in ("id", "template_id"):
        if key in result and result[key] is not None:
            result[key] = str(result[key])
    for key in ("created_at", "updated_at", "sent_at"):
        if key in result and result[key] is not None:
            result[key] = result[key].isoformat() if hasattr(result[key], "isoformat") else result[key]
    if "variables" in result:
        result["variables"] = normalize_variables_value(result["variables"])
    if "email_type" in result and result["email_type"]:
        result["email_type"] = normalize_email_type(result["email_type"])
    if "cms_email_id" in result and result["cms_email_id"]:
        result["cms_email_id"] = str(result["cms_email_id"]).upper()
    if "type" in result and result["type"] and not result.get("email_type"):
        result["email_type"] = normalize_email_type(result["type"])
    return result


async def fetch_template_by_id(template_id: str) -> Optional[dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT * FROM email_templates WHERE id::text = :id"),
            {"id": template_id},
        )
        row = result.mappings().first()
    return template_row_to_dict(dict(row)) if row else None


async def fetch_template_by_identifier(
    *,
    email_type: Optional[str] = None,
    cms_email_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    canonical_type = normalize_email_type(email_type)
    canonical_cms_id = normalize_cms_email_id(cms_email_id, canonical_type)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("""
                SELECT *
                FROM email_templates
                WHERE is_active = TRUE
                  AND (
                    lower(cms_email_id) = lower(:cms_email_id)
                    OR lower(email_type) = lower(:email_type)
                    OR lower(type) = lower(:email_type)
                  )
                ORDER BY updated_at DESC
                LIMIT 1
            """),
            {"cms_email_id": canonical_cms_id, "email_type": canonical_type},
        )
        row = result.mappings().first()
    return template_row_to_dict(dict(row)) if row else None


async def deactivate_other_templates(email_type: str, template_id: Optional[str] = None) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            text("""
                UPDATE email_templates
                SET is_active = FALSE, updated_at = NOW()
                WHERE lower(email_type) = lower(:email_type)
                  AND (:template_id IS NULL OR id::text != :template_id)
                  AND is_active = TRUE
            """),
            {"email_type": email_type, "template_id": template_id},
        )
        await session.commit()


async def maybe_toggle_active_template(email_type: str, template_id: Optional[str] = None, is_active: bool = True) -> None:
    if is_active:
        await deactivate_other_templates(email_type, template_id)


def normalize_template_summary(row: dict[str, Any]) -> dict[str, Any]:
    result = template_row_to_dict(row)
    result["variables"] = normalize_variables_value(result.get("variables"))
    return result


# -----------------------------------------------------------
# TEMPLATE ENDPOINTS
# -----------------------------------------------------------

@router.get("/templates")
@cms_router.get("/email-templates")
async def list_templates(
    authorization: Optional[str] = Header(default=None),
    q: Optional[str] = Query(default=None, description="Tìm theo tên hoặc subject"),
    email_type: Optional[str] = Query(default=None),
    cms_email_id: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Lấy danh sách email templates."""
    await require_admin(authorization)

    params: dict[str, Any] = {"limit": limit, "offset": offset}
    where_parts = []

    if q:
        params["q"] = f"%{q}%"
        where_parts.append("(name ILIKE :q OR subject ILIKE :q OR cms_email_id ILIKE :q OR email_type ILIKE :q)")
    if email_type:
        params["email_type"] = normalize_email_type(email_type)
        where_parts.append("lower(email_type) = lower(:email_type)")
    if cms_email_id:
        params["cms_email_id"] = normalize_cms_email_id(cms_email_id, email_type)
        where_parts.append("lower(cms_email_id) = lower(:cms_email_id)")
    if is_active is not None:
        params["is_active"] = is_active
        where_parts.append("is_active = :is_active")

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    async with AsyncSessionLocal() as session:
        total_result = await session.execute(
            text(f"SELECT COUNT(*) FROM email_templates {where_sql}"), params
        )
        total = int(total_result.scalar() or 0)

        rows_result = await session.execute(
            text(f"""
                SELECT id, cms_email_id, email_type, name, subject, text_content, variables, is_active, created_at, updated_at
                FROM email_templates
                {where_sql}
                ORDER BY updated_at DESC
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
        items = [normalize_template_summary(dict(row)) for row in rows_result.mappings().all()]

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/templates/{template_id}")
@cms_router.get("/email-templates/{template_id}")
async def get_template(
    template_id: str,
    authorization: Optional[str] = Header(default=None),
):
    """Lấy chi tiết một template (bao gồm html_content)."""
    await require_admin(authorization)

    template = await fetch_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template không tồn tại")
    return template


@router.post("/templates")
@cms_router.post("/email-templates")
async def create_template(
    payload: TemplateCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Tạo template mới."""
    admin = await require_admin(authorization)

    email_type = normalize_email_type(payload.email_type)
    if email_type not in VALID_EMAIL_TYPES:
        raise HTTPException(status_code=422, detail=f"Loại template không hợp lệ: {payload.email_type}")
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Tên template không được để trống")
    if not payload.subject.strip():
        raise HTTPException(status_code=422, detail="Subject không được để trống")
    if not payload.html_content.strip():
        raise HTTPException(status_code=422, detail="Nội dung HTML không được để trống")

    cms_email_id = normalize_cms_email_id(payload.cms_email_id, email_type)
    variables = normalize_variables_value(payload.variables)

    async with AsyncSessionLocal() as session:
        duplicate = await session.execute(
            text("""
                SELECT id
                FROM email_templates
                WHERE lower(cms_email_id) = lower(:cms_email_id)
                LIMIT 1
            """),
            {"cms_email_id": cms_email_id},
        )
        if duplicate.first():
            raise HTTPException(status_code=409, detail="Không được trùng mã ID Email CMS")

    new_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as session:
        if payload.is_active:
            await session.execute(
                text("""
                    UPDATE email_templates
                    SET is_active = FALSE, updated_at = NOW()
                    WHERE lower(email_type) = lower(:email_type) AND is_active = TRUE
                """),
                {"email_type": email_type},
            )
        await session.execute(
            text("""
                INSERT INTO email_templates (
                    id, cms_email_id, email_type, name, subject, html_content, text_content, variables, type, is_active
                )
                VALUES (
                    :id, :cms_email_id, :email_type, :name, :subject, :html_content, :text_content, :variables::jsonb, :type, :is_active
                )
            """),
            {
                "id": new_id,
                "cms_email_id": cms_email_id,
                "email_type": email_type,
                "name": payload.name.strip(),
                "subject": payload.subject.strip(),
                "html_content": payload.html_content,
                "text_content": payload.text_content,
                "variables": json.dumps(variables),
                "type": email_type,
                "is_active": payload.is_active,
            },
        )
        await session.commit()

    # Ghi nhận log tạo mẫu email mới
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_TEMPLATE_CREATE",
        entity_type="email_templates",
        entity_id=new_id,
        ip_address=request.client.host if request.client else "-"
    )

    return await get_template(new_id, authorization)


@router.put("/templates/{template_id}")
@cms_router.put("/email-templates/{template_id}")
async def update_template(
    template_id: str,
    payload: TemplateUpdate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Cập nhật template."""
    admin = await require_admin(authorization)

    existing = await fetch_template_by_id(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template không tồn tại")

    updates: dict[str, Any] = {}
    email_type = normalize_email_type(payload.email_type or existing.get("email_type"))
    if email_type not in VALID_EMAIL_TYPES:
        raise HTTPException(status_code=422, detail=f"Loại không hợp lệ: {payload.email_type}")
    target_active = payload.is_active if payload.is_active is not None else bool(existing.get("is_active"))

    if payload.cms_email_id is not None:
        updates["cms_email_id"] = normalize_cms_email_id(payload.cms_email_id, email_type)
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.subject is not None:
        updates["subject"] = payload.subject.strip()
    if payload.html_content is not None:
        updates["html_content"] = payload.html_content
    if payload.text_content is not None:
        updates["text_content"] = payload.text_content
    if payload.email_type is not None:
        updates["email_type"] = email_type
        updates["type"] = email_type
    if payload.variables is not None:
        updates["variables"] = json.dumps(normalize_variables_value(payload.variables))
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active

    if not updates:
        return await get_template(template_id, authorization)

    updates["id"] = template_id
    set_sql = ", ".join(f"{k} = :{k}" for k in updates if k != "id")

    async with AsyncSessionLocal() as session:
        if target_active:
            await session.execute(
                text("""
                    UPDATE email_templates
                    SET is_active = FALSE, updated_at = NOW()
                    WHERE lower(email_type) = lower(:email_type) AND id::text != :id AND is_active = TRUE
                """),
                {"email_type": email_type, "id": template_id},
            )
        if payload.cms_email_id is not None:
            duplicate = await session.execute(
                text("""
                    SELECT id
                    FROM email_templates
                    WHERE lower(cms_email_id) = lower(:cms_email_id)
                      AND id::text != :id
                    LIMIT 1
                """),
                {"cms_email_id": updates["cms_email_id"], "id": template_id},
            )
            if duplicate.first():
                raise HTTPException(status_code=409, detail="Không được trùng mã ID Email CMS")
        result = await session.execute(
            text(f"UPDATE email_templates SET {set_sql} WHERE id::text = :id RETURNING id"),
            updates,
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Template không tồn tại")
        await session.commit()

    # Ghi nhận log cập nhật mẫu email
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_TEMPLATE_UPDATE",
        entity_type="email_templates",
        entity_id=template_id,
        ip_address=request.client.host if request.client else "-"
    )

    return await get_template(template_id, authorization)


@router.delete("/templates/{template_id}")
@cms_router.delete("/email-templates/{template_id}")
async def delete_template(
    template_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Xóa template."""
    admin = await require_admin(authorization)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("DELETE FROM email_templates WHERE id::text = :id RETURNING id"),
            {"id": template_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Template không tồn tại")
        await session.commit()

    # Ghi nhận log xóa mẫu email
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_TEMPLATE_DELETE",
        entity_type="email_templates",
        entity_id=template_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"deleted": True, "id": template_id}


@router.patch("/templates/{template_id}/activate")
@cms_router.patch("/email-templates/{template_id}/activate")
async def activate_template(
    template_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    active: bool = Query(default=True),
):
    """Kích hoạt hoặc tắt template."""
    admin = await require_admin(authorization)
    template = await fetch_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template không tồn tại")

    async with AsyncSessionLocal() as session:
        if active:
            await session.execute(
                text("""
                    UPDATE email_templates
                    SET is_active = FALSE, updated_at = NOW()
                    WHERE lower(email_type) = lower(:email_type)
                      AND id::text != :id
                      AND is_active = TRUE
                """),
                {"email_type": template["email_type"], "id": template_id},
            )
        result = await session.execute(
            text("""
                UPDATE email_templates
                SET is_active = :is_active
                WHERE id::text = :id
                RETURNING id::text as id, is_active
            """),
            {"id": template_id, "is_active": active},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Template không tồn tại")
        await session.commit()

    await log_activity(
        user_id=admin["id"],
        action="EMAIL_TEMPLATE_TOGGLE",
        entity_type="email_templates",
        entity_id=template_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"id": template_id, "is_active": row["is_active"]}


# -----------------------------------------------------------
# SEND & PREVIEW ENDPOINTS
# -----------------------------------------------------------

@router.post("/preview")
async def preview_template(
    payload: PreviewRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Render HTML với biến động (không gửi email)."""
    await require_admin(authorization)
    rendered = render_template(payload.html_content, payload.variables)
    return {"rendered_html": rendered}


@router.post("/send")
async def send_email(
    payload: SendEmailRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Gửi email thủ công từ CMS."""
    admin = await require_admin(authorization)

    template = None
    if payload.template_id:
        template = await fetch_template_by_id(payload.template_id)
    elif payload.cms_email_id or payload.email_type:
        template = await fetch_template_by_identifier(
            email_type=payload.email_type,
            cms_email_id=payload.cms_email_id,
        )

    if template:
        if not template["is_active"]:
            raise HTTPException(status_code=400, detail="Template đang bị tắt (disabled)")
        subject = payload.subject or template["subject"]
        html_content = template["html_content"]
        text_content = template.get("text_content")
        template_id = template["id"]
    else:
        if payload.template_id or payload.email_type or payload.cms_email_id:
            raise HTTPException(status_code=404, detail="Không tìm thấy mẫu email CMS cho chức năng này")
        if not payload.subject or not payload.html_content:
            raise HTTPException(status_code=422, detail="Cần có subject và html_content nếu không chọn template")
        subject = payload.subject
        html_content = payload.html_content
        text_content = payload.text_content
        template_id = None

    # Tên người nhận (lấy từ variables nếu có)
    to_name = payload.variables.get("full_name", payload.to_email)

    status, error_message, sent_at, success, log_id = await render_and_deliver_email(
        template_id=template_id,
        email_type=template["email_type"] if template else normalize_email_type(payload.email_type),
        to_email=payload.to_email,
        to_name=to_name,
        variables=payload.variables,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        cc=payload.cc,
        bcc=payload.bcc,
        created_by=admin["email"],
    )

    # Ghi nhận log Admin gửi email
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_CMS_SEND",
        entity_type="email_logs",
        entity_id=log_id,
        ip_address=request.client.host if request.client else "-"
    )

    if not success:
        raise HTTPException(status_code=502, detail=f"Gửi email thất bại: {error_message}")

    return {
        "success": True,
        "log_id": log_id,
        "status": status,
        "to": payload.to_email,
        "subject": render_template(subject, payload.variables),
    }


# -----------------------------------------------------------
# LOGS ENDPOINTS
# -----------------------------------------------------------

@router.get("/logs")
async def list_logs(
    authorization: Optional[str] = Header(default=None),
    q: Optional[str] = Query(default=None, description="Tìm theo email hoặc subject"),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Lấy lịch sử gửi email."""
    await require_admin(authorization)

    params: dict[str, Any] = {"limit": limit, "offset": offset}
    where_parts = []

    if q:
        params["q"] = f"%{q}%"
        where_parts.append("(l.receiver_email ILIKE :q OR l.subject ILIKE :q)")
    if status:
        params["status"] = status
        where_parts.append("l.status = :status")

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    async with AsyncSessionLocal() as session:
        total_result = await session.execute(
            text(f"SELECT COUNT(*) FROM email_logs l {where_sql}"), params
        )
        total = int(total_result.scalar() or 0)

        rows_result = await session.execute(
            text(f"""
                SELECT l.id, l.receiver_email, l.subject, l.status, l.error_message,
                       l.sent_at, l.created_by, l.created_at,
                       t.name AS template_name
                FROM email_logs l
                LEFT JOIN email_templates t ON t.id = l.template_id
                {where_sql}
                ORDER BY l.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
        items = [template_row_to_dict(dict(row)) for row in rows_result.mappings().all()]

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/logs/{log_id}/retry")
async def retry_email(
    log_id: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """Thử gửi lại email bị lỗi."""
    admin = await require_admin(authorization)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("""
                SELECT l.*, t.html_content, t.text_content, t.is_active, t.email_type
                FROM email_logs l
                LEFT JOIN email_templates t ON t.id = l.template_id
                WHERE l.id::text = :id
            """),
            {"id": log_id},
        )
        log = result.mappings().first()

    if not log:
        raise HTTPException(status_code=404, detail="Log không tồn tại")
    if log["status"] != "failed":
        raise HTTPException(status_code=400, detail="Chỉ có thể thử lại email thất bại")

    if not log.get("html_content") or not log.get("email_type"):
        raise HTTPException(status_code=400, detail="Không thể gửi lại vì mẫu email gốc không còn hợp lệ")

    status, error_message, sent_at, success, _ = await render_and_deliver_email(
        template_id=log.get("template_id"),
        email_type=log.get("email_type"),
        to_email=log["receiver_email"],
        to_name=log["receiver_email"],
        variables={},
        subject=log["subject"],
        html_content=log["html_content"],
        text_content=log.get("text_content"),
        created_by=admin["email"],
    )

    # Ghi nhận log gửi lại email lỗi
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_LOG_RETRY",
        entity_type="email_logs",
        entity_id=log_id,
        ip_address=request.client.host if request.client else "-"
    )

    return {"success": success, "status": status, "log_id": log_id}


@router.get("/export-logs")
async def export_logs_csv(
    authorization: Optional[str] = Header(default=None),
    status: Optional[str] = Query(default=None),
):
    """Xuất lịch sử gửi email ra file CSV."""
    await require_admin(authorization)

    data = await list_logs(authorization, q=None, status=status, limit=1000, offset=0)
    output = io.StringIO()
    fieldnames = ["id", "receiver_email", "subject", "template_name", "status", "error_message", "sent_at", "created_by", "created_at"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(data["items"])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="email_logs.csv"'},
    )


@router.post("/import-recipients")
async def import_recipients(
    request: Request,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    """Import danh sách email từ CSV (format: email,full_name,role,status)."""
    admin = await require_admin(authorization)

    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    if not reader.fieldnames or "email" not in reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV phải có cột 'email'")

    valid = []
    invalid = []
    email_pattern = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    for index, row in enumerate(reader, start=2):
        email = (row.get("email") or "").strip()
        if not email_pattern.match(email):
            invalid.append({"row": index, "email": email, "error": "Email không hợp lệ"})
            continue
        valid.append({
            "email": email,
            "full_name": (row.get("full_name") or "").strip(),
            "role": (row.get("role") or "").strip(),
            "status": (row.get("status") or "active").strip(),
        })

    # Ghi nhận log import danh sách người nhận
    await log_activity(
        user_id=admin["id"],
        action="EMAIL_IMPORT_RECIPIENTS",
        entity_type="users",
        entity_id=admin["id"],
        ip_address=request.client.host if request.client else "-"
    )

    return {
        "valid_count": len(valid),
        "invalid_count": len(invalid),
        "valid": valid[:50],   # Trả về tối đa 50 để preview
        "invalid": invalid,
    }


@router.get("/variables")
async def list_variables(authorization: Optional[str] = Header(default=None)):
    """Lấy danh sách biến động được hỗ trợ."""
    await require_admin(authorization)

    variable_info = {
        "full_name": "Họ và tên người nhận",
        "otp": "Mã OTP 6 chữ số",
        "doctor_name": "Tên bác sĩ phụ trách",
        "heart_rate": "Nhịp tim (bpm)",
        "spo2": "Độ bão hòa oxy (%)",
        "alert_message": "Nội dung cảnh báo sức khỏe",
        "hospital_name": "Tên bệnh viện / hệ thống",
        "current_date": "Ngày giờ hiện tại (tự động điền)",
        "email": "Địa chỉ email người nhận",
        "appointment_date": "Ngày hẹn khám",
        "medication_name": "Tên thuốc",
        "patient_name": "Tên bệnh nhân",
    }

    return {
        "variables": [
            {"name": k, "syntax": "{{" + k + "}}", "description": v}
            for k, v in variable_info.items()
        ]
    }
