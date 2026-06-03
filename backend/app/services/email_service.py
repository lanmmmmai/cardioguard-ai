# =============================================================================
# CardioGuard AI — Email Service
# File: backend/app/services/email_service.py
# Dịch vụ gửi email động sử dụng template từ DB và SMTP/Brevo
# =============================================================================

import asyncio
import json
import re
import logging
import smtplib
import uuid
import requests
from datetime import datetime, timezone
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings
from app.core.database import database

logger = logging.getLogger(__name__)

ROLE_EMAIL_MAP = {
    "patient": {
        "role_label": "Bệnh nhân",
        "role_description": "Theo dõi sức khỏe cá nhân, nhận cảnh báo thông minh, quản lý hồ sơ sức khỏe và lịch sử chăm sóc.",
    },
    "benh_nhan": {
        "role_label": "Bệnh nhân",
        "role_description": "Theo dõi sức khỏe cá nhân, nhận cảnh báo thông minh, quản lý hồ sơ sức khỏe và lịch sử chăm sóc.",
    },
    "doctor": {
        "role_label": "Bác sĩ",
        "role_description": "Theo dõi danh sách bệnh nhân, xem dữ liệu sức khỏe, quản lý lịch hẹn và hỗ trợ tư vấn điều trị.",
    },
    "bac_si": {
        "role_label": "Bác sĩ",
        "role_description": "Theo dõi danh sách bệnh nhân, xem dữ liệu sức khỏe, quản lý lịch hẹn và hỗ trợ tư vấn điều trị.",
    },
    "admin": {
        "role_label": "Quản trị viên",
        "role_description": "Quản lý hệ thống, tài khoản người dùng, thiết bị IoT, mẫu email, báo cáo và nhật ký hoạt động.",
    },
    "quan_tri_vien": {
        "role_label": "Quản trị viên",
        "role_description": "Quản lý hệ thống, tài khoản người dùng, thiết bị IoT, mẫu email, báo cáo và nhật ký hoạt động.",
    },
}

EMAIL_TEMPLATE_CATALOG = {
    "otp_register": {"cms_email_id": "EMAIL_OTP_REGISTER", "label": "OTP Đăng ký"},
    "otp_login": {"cms_email_id": "EMAIL_OTP_LOGIN", "label": "OTP Đăng nhập"},
    "welcome": {"cms_email_id": "EMAIL_WELCOME", "label": "Welcome Email"},
    "reset_password": {"cms_email_id": "EMAIL_RESET_PASSWORD", "label": "Đặt lại mật khẩu"},
    "emergency_alert": {"cms_email_id": "EMAIL_EMERGENCY_ALERT", "label": "Cảnh báo khẩn cấp"},
    "appointment_reminder": {"cms_email_id": "EMAIL_APPOINTMENT_REMINDER", "label": "Nhắc lịch hẹn"},
    "doctor_assignment": {"cms_email_id": "EMAIL_DOCTOR_ASSIGNMENT", "label": "Phân công bác sĩ"},
    "health_alert": {"cms_email_id": "EMAIL_HEALTH_ALERT", "label": "Cảnh báo sức khỏe"},
    "monthly_report": {"cms_email_id": "EMAIL_MONTHLY_REPORT", "label": "Báo cáo tháng"},
    "doctor_pending_verification": {"cms_email_id": "EMAIL_DOCTOR_PENDING_VERIFICATION", "label": "Bác sĩ chờ duyệt"},
    "doctor_verified": {"cms_email_id": "EMAIL_DOCTOR_VERIFIED", "label": "Bác sĩ đã xác thực"},
    "doctor_rejected": {"cms_email_id": "EMAIL_DOCTOR_REJECTED", "label": "Bác sĩ bị từ chối"},
    "doctor_need_update": {"cms_email_id": "EMAIL_DOCTOR_NEED_UPDATE", "label": "Bác sĩ cần bổ sung"},
    "doctor_verified_success": {"cms_email_id": "EMAIL_DOCTOR_VERIFIED", "label": "Bác sĩ đã được xác thực"},
    "doctor_verified_rejected": {"cms_email_id": "EMAIL_DOCTOR_REJECTED", "label": "Bác sĩ bị từ chối xác thực"},
    "doctor_profile_require_update": {"cms_email_id": "EMAIL_DOCTOR_NEED_UPDATE", "label": "Bác sĩ cần bổ sung hồ sơ"},
}

EMAIL_TYPE_ALIASES = {
    "password_reset": "reset_password",
    "alert_critical": "emergency_alert",
    "doctor_assigned": "doctor_assignment",
    "health_warning": "health_alert",
    "doctor_verified_success": "doctor_verified",
    "doctor_verified_rejected": "doctor_rejected",
    "doctor_profile_require_update": "doctor_need_update",
}

DEFAULT_TEMPLATE_VARIABLES = [
    "full_name",
    "otp",
    "doctor_name",
    "heart_rate",
    "spo2",
    "alert_message",
    "hospital_name",
    "current_date",
    "email",
    "appointment_date",
    "medication_name",
    "patient_name",
    "login_url",
    "login_button_text",
    "role_label",
    "role_description",
    "verification_note",
]

DOCTOR_STATUS_TEMPLATE_MAP = {
    "pending_verification": "doctor_pending_verification",
    "active": "doctor_verified_success",
    "rejected": "doctor_verified_rejected",
    "need_update": "doctor_profile_require_update",
}


def get_role_email_context(role: Optional[str]) -> dict[str, str]:
    role_key = (role or "").strip().lower()

    return ROLE_EMAIL_MAP.get(
        role_key,
        {
            "role_label": "Người dùng",
            "role_description": "Sử dụng các chức năng phù hợp với tài khoản trong hệ thống CardioGuard AI.",
        },
    )


def get_login_info(role: Optional[str]) -> dict[str, str]:
    """Lấy link đăng nhập và text tương ứng theo vai trò."""
    role_key = (role or "").strip().lower()
    
    # Chuẩn hóa vai trò
    if role_key in {"benh_nhan", "patient"}:
        target_role = "patient"
    elif role_key in {"bac_si", "doctor"}:
        target_role = "doctor"
    elif role_key in {"quan_tri_vien", "admin"}:
        target_role = "admin"
    else:
        target_role = "patient"

    # Lấy base URL từ FRONTEND_ORIGINS hoặc mặc định
    base_url = "https://giatky.site"
    if settings.FRONTEND_ORIGINS:
        origins = [o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()]
        if origins:
            base_url = origins[0]

    # Loại bỏ slash cuối cùng nếu có
    if base_url.endswith("/"):
        base_url = base_url[:-1]

    login_map = {
        "patient": {
            "url": f"{base_url}/login",
            "button_text": "Đăng nhập Cổng Bệnh nhân",
        },
        "doctor": {
            "url": f"{base_url}/login-doctor",
            "button_text": "Đăng nhập Cổng Bác sĩ",
        },
        "admin": {
            "url": f"{base_url}/login-admin",
            "button_text": "Đăng nhập Cổng Quản trị",
        },
    }
    return login_map.get(target_role, {
        "url": f"{base_url}/login",
        "button_text": "Đăng nhập hệ thống",
    })


def normalize_email_type(email_type: Optional[str]) -> str:
    normalized = (email_type or "").strip().lower()
    if normalized in EMAIL_TYPE_ALIASES:
        normalized = EMAIL_TYPE_ALIASES[normalized]
    return normalized


def normalize_cms_email_id(cms_email_id: Optional[str], email_type: Optional[str] = None) -> str:
    normalized = (cms_email_id or "").strip().upper()
    if normalized:
        return normalized

    canonical_type = normalize_email_type(email_type)
    catalog = EMAIL_TEMPLATE_CATALOG.get(canonical_type)
    if catalog:
        return catalog["cms_email_id"]

    fallback = canonical_type or "CUSTOM"
    return "EMAIL_" + re.sub(r"[^A-Z0-9]+", "_", fallback.upper()).strip("_")


def parse_variables(raw_variables: Any) -> list[str]:
    if raw_variables is None:
        return []
    if isinstance(raw_variables, list):
        return [str(item).strip() for item in raw_variables if str(item).strip()]
    if isinstance(raw_variables, str):
        text = raw_variables.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [part.strip() for part in re.split(r"[\n,;]+", text) if part.strip()]
    return [str(raw_variables).strip()]


def format_variables(variables: Any) -> list[str]:
    return parse_variables(variables)


def extract_plain_text(html: str) -> str:
    text = re.sub(r"<\s*br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def resolve_template_identifier(email_type: Optional[str] = None, cms_email_id: Optional[str] = None) -> tuple[str, str]:
    canonical_type = normalize_email_type(email_type)
    canonical_cms_id = normalize_cms_email_id(cms_email_id, canonical_type)
    return canonical_type, canonical_cms_id


async def find_email_template(
    email_type: Optional[str] = None,
    cms_email_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    canonical_type, canonical_cms_id = resolve_template_identifier(email_type, cms_email_id)
    query = """
        SELECT id::text as id, function_id, cms_email_id, email_type, target_role, name, subject, html_content, text_content,
               variables, is_active, created_at, updated_at
        FROM email_templates
        WHERE is_active = TRUE
          AND (
            lower(cms_email_id) = lower(:cms_email_id)
            OR lower(email_type) = lower(:email_type)
            OR lower(type) = lower(:email_type)
          )
        ORDER BY updated_at DESC
        LIMIT 1
    """
    try:
        row = await database.fetch_one(
            query,
            {"cms_email_id": canonical_cms_id, "email_type": canonical_type},
        )
        if not row:
            return None
        result = dict(row)
        result["variables"] = format_variables(result.get("variables"))
        return result
    except Exception:
        logger.exception(
            "Failed to resolve email template",
            extra={"email_type": canonical_type, "cms_email_id": canonical_cms_id},
        )
        raise


def render_template(html: str, variables: dict[str, str]) -> str:
    """Thay thế các biến động dạng {{variable_name}} trong template HTML."""
    # Làm giàu biến để tương thích chéo giữa otp, otp_code và new_password
    enriched = dict(variables)
    if "otp" in enriched:
        enriched["otp_code"] = enriched["otp"]
    elif "otp_code" in enriched:
        enriched["otp"] = enriched["otp_code"]
        
    if "new_password" in enriched:
        enriched["otp"] = enriched["new_password"]
        enriched["otp_code"] = enriched["new_password"]

    # Làm giàu biến role
    role_value = (
        enriched.get("role")
        or enriched.get("user_role")
        or enriched.get("account_role")
        or ""
    )

    role_context = get_role_email_context(role_value)

    if not enriched.get("role_label"):
        enriched["role_label"] = role_context["role_label"]

    if not enriched.get("role_description"):
        enriched["role_description"] = role_context["role_description"]

    # Làm giàu biến link đăng nhập động
    login_info = get_login_info(role_value)
    if not enriched.get("login_url"):
        enriched["login_url"] = login_info["url"]
    if not enriched.get("login_button_text"):
        enriched["login_button_text"] = login_info["button_text"]

    defaults = {
        "hospital_name": settings.EMAIL_FROM_NAME or "CardioGuard AI",
        "current_date": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M"),
        "full_name": enriched.get("full_name") or "Người dùng",
    }
    merged = {**defaults, **enriched}

    def replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(merged.get(key, match.group(0)))

    return re.sub(r"\{\{(\w+)\}\}", replacer, html)


def send_smtp_email_sync(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
) -> bool:
    """Gửi email đồng bộ qua máy chủ SMTP Gmail hoặc cấu hình khác trong .env."""
    host = settings.SMTP_HOST
    port = int(settings.SMTP_PORT or 587)
    user = settings.SMTP_USERNAME
    password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or settings.EMAIL_FROM_EMAIL or "noreply@cardioguard.ai"
    from_name = settings.SMTP_FROM_NAME or settings.EMAIL_FROM_NAME or "CardioGuard AI"

    if not host:
        logger.warning("SMTP_HOST is not configured; SMTP send skipped")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{Header(from_name, 'utf-8').encode()} <{from_email}>"
    msg["To"] = f"{Header(to_name, 'utf-8').encode()} <{to_email}>"

    recipients = [to_email]

    if cc:
        msg["Cc"] = cc
        cc_list = [addr.strip() for addr in cc.split(",") if addr.strip()]
        recipients.extend(cc_list)

    if bcc:
        bcc_list = [addr.strip() for addr in bcc.split(",") if addr.strip()]
        recipients.extend(bcc_list)

    plain_text = text_body or extract_plain_text(html_body)
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        import ssl
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()

        if user and password:
            server.login(user, password)

        server.sendmail(from_email, recipients, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        logger.exception("SMTP send failed")
        raise e


async def send_smtp_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
) -> bool:
    """Gửi email bất đồng bộ qua SMTP bằng cách chạy trong threadpool."""
    return await run_in_threadpool(
        send_smtp_email_sync, to_email, to_name, subject, html_body, text_body, cc, bcc
    )


def send_brevo_email_sync(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
) -> bool:
    """Gửi email đồng bộ qua Brevo API."""
    if not settings.BREVO_API_KEY:
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
    if text_body:
        payload["textContent"] = text_body
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


async def render_and_deliver_email(
    *,
    template_id: Optional[str],
    email_type: str,
    to_email: str,
    to_name: str,
    variables: dict[str, str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    created_by: str = "system",
) -> tuple[str, Optional[str], Optional[datetime], bool]:
    rendered_subject = render_template(subject, variables)
    rendered_html = render_template(html_content, variables)
    rendered_text = render_template(text_content, variables) if text_content else None

    status = "pending"
    error_message = None
    sent_at = None

    try:
        if settings.BREVO_API_KEY:
            email_sent = await run_in_threadpool(
                send_brevo_email_sync,
                to_email,
                to_name,
                rendered_subject,
                rendered_html,
                rendered_text,
                cc,
                bcc,
            )
            status = "sent" if email_sent else "failed"
            sent_at = datetime.now(timezone.utc)
        elif settings.SMTP_HOST:
            email_sent = await send_smtp_email(
                to_email,
                to_name,
                rendered_subject,
                rendered_html,
                rendered_text,
                cc,
                bcc,
            )
            status = "sent" if email_sent else "failed"
            sent_at = datetime.now(timezone.utc)
        else:
            logger.info("Email delivery skipped in dev mode: type=%s", email_type)
            status = "sent"
            sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        status = "failed"
        error_message = str(exc)
        logger.exception("Email send crashed for type=%s", email_type)

    log_id = str(uuid.uuid4())
    try:
        await database.execute(
            """
            INSERT INTO email_logs (id, template_id, receiver_email, subject, status, error_message, sent_at, created_by)
            VALUES (:id, :template_id, :receiver_email, :subject, :status, :error_message, :sent_at, :created_by)
            """,
            {
                "id": log_id,
                "template_id": template_id,
                "receiver_email": to_email,
                "subject": rendered_subject,
                "status": status,
                "error_message": error_message,
                "sent_at": sent_at,
                "created_by": created_by,
            },
        )
    except Exception:
        logger.exception("Failed to write email log for type=%s", email_type)

    return status, error_message, sent_at, status == "sent", log_id


async def send_system_email(
    email_type: str,
    to_email: str,
    to_name: str,
    variables: dict[str, str],
    fallback_subject: Optional[str] = None,
    fallback_html: Optional[str] = None,
    target_role: Optional[str] = None,
) -> bool:
    """
    Gửi email hệ thống bằng template CMS.
    fallback_* được giữ lại để tương thích ngược, nhưng template CMS phải tồn tại.
    """
    template = await find_email_template(email_type=email_type)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu email CMS cho chức năng này")
    if target_role and template.get("target_role") and str(template["target_role"]).lower() not in {"all", str(target_role).lower()}:
        raise HTTPException(status_code=403, detail="Template không phù hợp với vai trò người nhận")

    subject = template["subject"]
    html_content = template["html_content"]
    text_content = template.get("text_content")
    template_id = template["id"]

    _, _, _, success, _ = await render_and_deliver_email(
        template_id=template_id,
        email_type=email_type,
        to_email=to_email,
        to_name=to_name,
        variables=variables,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        created_by="system",
    )
    return success


async def send_doctor_status_email(email: str, full_name: str, status: str, note: Optional[str] = None) -> bool:
    """Gửi email thông báo trạng thái xác thực của bác sĩ."""
    email_type = DOCTOR_STATUS_TEMPLATE_MAP.get(status)
    if not email_type:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu email CMS cho chức năng này")

    hospital_name = settings.EMAIL_FROM_NAME or "CardioGuard AI"
    variables = {
        "full_name": full_name,
        "verification_note": note or "",
        "hospital_name": hospital_name,
        "role": "doctor"
    }
    return await send_system_email(
        email_type=email_type,
        to_email=email,
        to_name=full_name,
        variables=variables,
        target_role="doctor",
    )


async def send_email_by_type(
    email_type: str,
    to_email: str,
    to_name: str,
    variables: dict[str, str],
    target_role: Optional[str] = None,
) -> bool:
    return await send_system_email(
        email_type=email_type,
        to_email=to_email,
        to_name=to_name,
        variables=variables,
        target_role=target_role,
    )


async def send_email_by_cms_id(
    cms_email_id: str,
    to_email: str,
    to_name: str,
    variables: dict[str, str],
    target_role: Optional[str] = None,
) -> bool:
    template = await find_email_template(cms_email_id=cms_email_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu email CMS cho chức năng này")
    return await send_system_email(
        email_type=template["email_type"],
        to_email=to_email,
        to_name=to_name,
        variables=variables,
        target_role=target_role,
    )
