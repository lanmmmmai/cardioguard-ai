"""Dịch vụ gửi email cho CardioGuard.

Mục đích:
    Gửi email giao dịch (OTP đăng ký, đặt lại mật khẩu, cảnh báo hệ thống)
    thông qua API REST Brevo (Sendinblue) hoặc kết nối SMTP trực tiếp.
    Các mẫu được lấy từ bảng email_templates trong cơ sở dữ liệu, hiển thị với
    các biến dành riêng cho người dùng và vai trò, và việc gửi được ghi lại trong email_logs.

Luồng công việc:
    1. send_system_email() tra cứu một mẫu hoạt động theo email_type trong DB.
    2. Dự phòng vào subject/html do người gọi cung cấp khi không tìm thấy mẫu.
    3. Các biến như {{full_name}}, {{otp}}, {{role_label}} được thay thế
       bởi render_template().
    4. Việc gửi được thực hiện qua Brevo trước (nếu BREVO_API_KEY được đặt), sau đó
       qua SMTP (nếu SMTP_HOST được cấu hình). Trong chế độ phát triển, việc gửi được bỏ qua.
    5. Mọi lần thử đều được ghi lại trong bảng email_logs.

Quan hệ:
    - app.core.config.settings: Thông tin xác thực SMTP và Brevo.
    - app.core.database.database: Được sử dụng để đọc mẫu và ghi nhật ký.
    - Được gọi từ các tuyến xác thực, bộ xử lý cảnh báo và luồng thông báo quản trị.
"""

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
    """Trả về nhãn vai trò và mô tả đã được bản địa hóa cho các mẫu email.

    Ánh xạ một chuỗi vai trò (ví dụ: "patient", "doctor", "admin") thành một
    nhãn hiển thị tiếng Việt và một mô tả ngắn được sử dụng trong các biến mẫu
    {{role_label}} và {{role_description}}.

    Args:
        role: Chuỗi vai trò thô từ bản ghi người dùng. Có thể là None hoặc
            chứa khoảng trắng — hàm chuẩn hóa bằng cách cắt và chuyển thành chữ thường.
            Các vai trò không xác định mặc định là "Người dùng".

    Trả về:
        Một dict với các khóa "role_label" (str) và "role_description" (str).
    """
    role_key = (role or "").strip().lower()

    return ROLE_EMAIL_MAP.get(
        role_key,
        {
            "role_label": "Người dùng",
            "role_description": "Sử dụng các chức năng phù hợp với tài khoản trong hệ thống CardioGuard AI.",
        },
    )


def render_template(html: str, variables: dict[str, str]) -> str:
    """Thay thế các chỗ giữ chỗ {{variable_name}} trong một mẫu email HTML.

    Thực hiện làm giàu tương thích chéo để "otp", "otp_code" và
    "new_password" đều phân giải thành cùng một giá trị bất kể khóa nào
    mẫu sử dụng. Cũng tiêm nhãn / mô tả vai trò, tên bệnh viện,
    ngày hiện tại và tên đầy đủ của người dùng làm mặc định.

    Args:
        html: Chuỗi mẫu HTML thô chứa các điểm đánh dấu {{...}}.
        variables: Dict các cặp tên biến → giá trị do người gọi cung cấp.

    Trả về:
        HTML đã được hiển thị với tất cả các chỗ giữ chỗ được nhận dạng đã được thay thế.
    """
    # Làm giàu biến để otp / otp_code / new_password có thể thay thế cho nhau
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
    """Gửi email đồng bộ qua SMTP.

    Xây dựng một tin nhắn MIME multipart/alternative, tùy chọn thêm người nhận CC/BCC,
    và kết nối với máy chủ SMTP đã cấu hình (thường hoặc SSL).
    Hỗ trợ STARTTLS trên cổng 587 và SSL trực tiếp trên cổng 465.

    Args:
        to_email: Địa chỉ email người nhận chính.
        to_name: Tên hiển thị cho người nhận chính.
        subject: Dòng chủ đề email.
        html_body: Nội dung HTML đã được hiển thị.
        cc: Địa chỉ CC phân cách bằng dấu phẩy hoặc None.
        bcc: Địa chỉ BCC phân cách bằng dấu phẩy hoặc None.

    Trả về:
        True nếu tin nhắn được máy chủ SMTP chấp nhận.

    Ngoại lệ:
        smtplib.SMTPException (hoặc lớp con): Được ném lại sau khi ghi nhật ký nếu
            quá trình hội thoại SMTP thất bại.
    """
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
    """Gửi email không đồng bộ qua SMTP sử dụng nhóm luồng.

    Bao bọc hàm send_smtp_email_sync đồng bộ trong run_in_threadpool để
    tránh chặn vòng lặp sự kiện không đồng bộ trong quá trình hội thoại SMTP.

    Args:
        Giống như send_smtp_email_sync.

    Trả về:
        True nếu tin nhắn được máy chủ SMTP chấp nhận.

    Ngoại lệ:
        Giống như send_smtp_email_sync.
    """
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
    """Gửi email đồng bộ qua API REST Brevo (Sendinblue).

    POST đến https://api.brevo.com/v3/smtp/email với người gửi, người nhận,
    chủ đề và nội dung HTML. Danh sách CC/BCC tùy chọn được bao gồm khi được cung cấp.

    Args:
        to_email: Địa chỉ email người nhận chính.
        to_name: Tên hiển thị cho người nhận chính.
        subject: Dòng chủ đề email.
        html_body: Nội dung HTML đã được hiển thị.
        cc: Địa chỉ CC phân cách bằng dấu phẩy hoặc None.
        bcc: Địa chỉ BCC phân cách bằng dấu phẩy hoặc None.

    Trả về:
        True khi có phản hồi HTTP 2xx.

    Ngoại lệ:
        requests.HTTPError: Được ném lại sau khi ghi nhật ký nếu cuộc gọi API thất bại.
    """
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
    """Gửi email do hệ thống tạo ra sử dụng các mẫu cơ sở dữ liệu.

    Luồng công việc:
        1. Tìm nạp mẫu hoạt động gần đây nhất khớp với email_type từ DB.
        2. Sử dụng subject/html_content của mẫu hoặc dự phòng vào các giá trị
           fallback_* do người gọi cung cấp.
        3. Hiển thị các biến mẫu ({{full_name}}, {{otp}}, {{role_label}},
           v.v.) qua render_template().
        4. Gửi qua API Brevo (ưu tiên) hoặc SMTP (dự phòng).
        5. Ghi bản ghi gửi vào bảng email_logs.

    Args:
        email_type: Khóa tra cứu mẫu (ví dụ: "register", "forgot_password").
        to_email: Địa chỉ email người nhận chính.
        to_name: Tên hiển thị cho người nhận.
        variables: Dict các thay thế biến mẫu.
        fallback_subject: Dòng chủ đề được sử dụng khi không tìm thấy mẫu DB.
        fallback_html: Nội dung HTML được sử dụng khi không tìm thấy mẫu DB.

    Trả về:
        True nếu email được gửi thành công (hoặc bị bỏ qua trong chế độ phát triển).
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
