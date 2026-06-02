# =============================================================================
# CardioGuard AI — Email Service
# File: backend/app/services/email_service.py
# Dịch vụ gửi email động sử dụng template từ DB và SMTP/Brevo
# =============================================================================

import asyncio
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
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
) -> bool:
    """Gửi email bất đồng bộ qua SMTP bằng cách chạy trong threadpool."""
    return await run_in_threadpool(
        send_smtp_email_sync, to_email, to_name, subject, html_body, cc, bcc
    )


def send_brevo_email_sync(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
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


async def send_system_email(
    email_type: str,
    to_email: str,
    to_name: str,
    variables: dict[str, str],
    fallback_subject: str,
    fallback_html: str,
) -> bool:
    """
    Gửi email hệ thống (Đăng ký, Quên mật khẩu, v.v.):
    1. Tìm template thích hợp đang được kích hoạt từ cơ sở dữ liệu.
    2. Nếu có, sử dụng nó; nếu không, fallback về template mặc định.
    3. Gửi qua Brevo (nếu có API Key) hoặc SMTP (nếu được cấu hình trong .env).
    4. Tự động lưu lịch sử gửi vào bảng `email_logs`.
    """
    # 1. Tìm template đang active trong DB
    query = """
        SELECT id, name, subject, html_content, is_active
        FROM email_templates
        WHERE type = :type AND is_active = TRUE
        ORDER BY updated_at DESC
        LIMIT 1
    """
    template = None
    try:
        template = await database.fetch_one(query=query, values={"type": email_type})
    except Exception as e:
        logger.warning("Failed to fetch email template for type=%s", email_type)

    # 2. Xác định subject và html_content
    if template:
        subject = template["subject"]
        html_content = template["html_content"]
        template_id = template["id"]
    else:
        subject = fallback_subject
        html_content = fallback_html
        template_id = None

    # 3. Render các biến động
    rendered_subject = render_template(subject, variables)
    rendered_html = render_template(html_content, variables)

    status = "pending"
    error_message = None
    sent_at = None

    # 4. Thực hiện gửi email
    try:
        if settings.BREVO_API_KEY:
            email_sent = await run_in_threadpool(
                send_brevo_email_sync, to_email, to_name, rendered_subject, rendered_html
            )
            status = "sent" if email_sent else "failed"
            sent_at = datetime.now(timezone.utc)
        elif settings.SMTP_HOST:
            email_sent = await send_smtp_email(to_email, to_name, rendered_subject, rendered_html)
            status = "sent" if email_sent else "failed"
            sent_at = datetime.now(timezone.utc)
        else:
            # Dev Mode / Fallback không gửi
            logger.info("Email delivery skipped in dev mode: type=%s", email_type)
            status = "sent"
            sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        status = "failed"
        error_message = str(exc)
        logger.exception("Email send crashed for type=%s", email_type)

    # 5. Ghi log lịch sử gửi vào DB
    log_id = str(uuid.uuid4())
    try:
        insert_query = """
            INSERT INTO email_logs (id, template_id, receiver_email, subject, status, error_message, sent_at, created_by)
            VALUES (:id, :template_id, :receiver_email, :subject, :status, :error_message, :sent_at, :created_by)
        """
        await database.execute(
            query=insert_query,
            values={
                "id": log_id,
                "template_id": template_id,
                "receiver_email": to_email,
                "subject": rendered_subject,
                "status": status,
                "error_message": error_message,
                "sent_at": sent_at,
                "created_by": "system",
            }
        )
    except Exception as exc:
        logger.exception("Failed to write email log for type=%s", email_type)

    return status == "sent"


async def send_doctor_status_email(email: str, full_name: str, status: str, note: Optional[str] = None) -> bool:
    """Gửi email thông báo trạng thái xác thực của bác sĩ."""
    hospital_name = settings.EMAIL_FROM_NAME or "CardioGuard AI"
    variables = {
        "full_name": full_name,
        "verification_note": note or "",
        "hospital_name": hospital_name,
        "role": "doctor"
    }
    
    if status == "pending_verification":
        subject = "CardioGuard AI - Hồ sơ bác sĩ của bạn đang chờ phê duyệt"
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
          <p style="color:#374151">Xin chào Bác sĩ <strong>{full_name}</strong>,</p>
          <p style="color:#374151">Hồ sơ bác sĩ của bạn đã được ghi nhận và đang chờ quản trị viên xác thực.</p>
          <p style="color:#374151">Chúng tôi sẽ thông báo cho bạn ngay sau khi tài khoản được phê duyệt.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {hospital_name}</p>
        </div>
        """
        return await send_system_email(
            email_type="doctor_pending_verification",
            to_email=email,
            to_name=full_name,
            variables=variables,
            fallback_subject=subject,
            fallback_html=html
        )
    elif status == "active":
        subject = "CardioGuard AI - Tài khoản bác sĩ của bạn đã được xác thực"
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
          <p style="color:#374151">Xin chào Bác sĩ <strong>{full_name}</strong>,</p>
          <p style="color:#374151">Tài khoản bác sĩ của bạn đã được xác thực và có thể sử dụng hệ thống CardioGuard AI.</p>
          <p style="color:#374151">Bây giờ bạn có thể đăng nhập vào cổng bác sĩ để làm việc.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
            <tr>
              <td align="center">
                <a href="{{{{login_url}}}}" 
                   style="display:inline-block;background:#1183C6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 34px;border-radius:999px;">
                  {{{{login_button_text}}}}
                </a>
              </td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {hospital_name}</p>
        </div>
        """
        return await send_system_email(
            email_type="doctor_verified",
            to_email=email,
            to_name=full_name,
            variables=variables,
            fallback_subject=subject,
            fallback_html=html
        )
    elif status == "rejected":
        subject = "CardioGuard AI - Hồ sơ bác sĩ của bạn chưa được phê duyệt"
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
          <p style="color:#374151">Xin chào Bác sĩ <strong>{full_name}</strong>,</p>
          <p style="color:#374151">Hồ sơ bác sĩ của bạn chưa được phê duyệt.</p>
          <p style="color:#374151;padding:12px;background-color:#fef2f2;border-left:4px solid #ef4444;margin:16px 0">
            <strong>Lý do:</strong> {note or "Không có lý do chi tiết."}
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {hospital_name}</p>
        </div>
        """
        return await send_system_email(
            email_type="doctor_rejected",
            to_email=email,
            to_name=full_name,
            variables=variables,
            fallback_subject=subject,
            fallback_html=html
        )
    elif status == "need_update":
        subject = "CardioGuard AI - Yêu cầu bổ sung thông tin hồ sơ bác sĩ"
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#d97706;margin-bottom:8px">CardioGuard AI</h2>
          <p style="color:#374151">Xin chào Bác sĩ <strong>{full_name}</strong>,</p>
          <p style="color:#374151">Hồ sơ bác sĩ cần bổ sung thông tin.</p>
          <p style="color:#374151;padding:12px;background-color:#fffbeb;border-left:4px solid #f59e0b;margin:16px 0">
            <strong>Nội dung cần bổ sung:</strong> {note or "Vui lòng xem lại hồ sơ."}
          </p>
          <p style="color:#374151">Vui lòng đăng nhập lại vào cổng bác sĩ để thực hiện chỉnh sửa và tải lại giấy tờ cần thiết.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
            <tr>
              <td align="center">
                <a href="{{{{login_url}}}}" 
                   style="display:inline-block;background:#1183C6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 34px;border-radius:999px;">
                  {{{{login_button_text}}}}
                </a>
              </td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {hospital_name}</p>
        </div>
        """
        return await send_system_email(
            email_type="doctor_need_update",
            to_email=email,
            to_name=full_name,
            variables=variables,
            fallback_subject=subject,
            fallback_html=html
        )
    return False

