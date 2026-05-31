# =============================================================================
# CardioGuard AI — Email Service
# File: backend/app/services/email_service.py
# Dịch vụ gửi email động sử dụng template từ DB và SMTP/Brevo
# =============================================================================

import asyncio
import re
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


def render_template(html: str, variables: dict[str, str]) -> str:
    """Thay thế các biến động dạng {{variable_name}} trong template HTML."""
    defaults = {
        "hospital_name": settings.EMAIL_FROM_NAME or "CardioGuard AI",
        "current_date": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M"),
    }
    merged = {**defaults, **variables}

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
    user = settings.SMTP_USERNAME or settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or settings.EMAIL_FROM_EMAIL or "noreply@cardioguard.ai"
    from_name = settings.SMTP_FROM_NAME or settings.EMAIL_FROM_NAME or "CardioGuard AI"

    if not host:
        print("[SMTP WARN] SMTP_HOST is not configured.")
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
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        if user and password:
            server.login(user, password)

        server.sendmail(from_email, recipients, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[SMTP SEND ERROR] Failed to send email to {to_email}: {e}")
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
        "sender": {"name": settings.EMAIL_FROM_NAME or "CardioGuard AI", "email": settings.EMAIL_FROM_EMAIL or "noreply@cardioguard.ai"},
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
        print(f"[DB WARN] Failed to fetch email template: {e}")

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
            print(f"[DEV EMAIL LOG] To: {to_email} | Subject: {rendered_subject}")
            status = "sent"
            sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        status = "failed"
        error_message = str(exc)
        print(f"[EMAIL SEND CRASH] Error sending to {to_email}: {exc}")

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
        print(f"[DB LOG ERROR] Failed to write email log for {to_email}: {exc}")

    return status == "sent"
