"""Dịch vụ Quản lý Thông báo cho CardioGuard AI.

Mục đích:
    Cung cấp các hàm tạo, truy xuất, đánh dấu đã đọc và lọc thông báo.
    Tích hợp kiểm tra tuỳ chọn cấu hình thông báo (notification_preferences)
    của người dùng trước khi lưu trữ và phát trực tuyến qua WebSocket.

Luồng xử lý:
    1. Kiểm tra tuỳ chọn của người nhận từ trường `notification_preferences` trong bảng `users`.
    2. Áp dụng Tuyên bố từ chối trách nhiệm y tế (medical disclaimer) cho các thông báo y tế/AI.
    3. Thêm bản ghi thông báo mới vào bảng `notifications`.
    4. Kích hoạt phát sóng thời gian thực thông qua `ConnectionManager.broadcast_notification`.

Quan hệ:
    - app.core.database: Thực hiện các truy vấn DB.
    - app.websocket.connection_manager: Phát sóng WebSocket realtime.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.database import database
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)

# Tuyên bố từ chối trách nhiệm mặc định cho phân tích AI
AI_MEDICAL_DISCLAIMER = "\n\n*Lưu ý: Đây là phân tích tham khảo từ trợ lý AI, không thay thế cho chẩn đoán y khoa chuyên nghiệp.*"


def enforce_medical_disclaimer(message: str, notification_type: str) -> str:
    """Đảm bảo các thông báo liên quan đến phân tích AI đi kèm disclaimer y tế.

    Args:
        message: Nội dung thông báo gốc.
        notification_type: Loại thông báo (ví dụ: 'ai_recommendation', 'ai_analysis').

    Returns:
        Nội dung thông báo đã được chuẩn hóa với disclaimer nếu cần.
    """
    if "ai" in notification_type.lower() or "recommendation" in notification_type.lower():
        if AI_MEDICAL_DISCLAIMER not in message:
            logger.info("Đã tự động thêm tuyên bố từ chối trách nhiệm y tế vào thông báo loại=%s", notification_type)
            return message + AI_MEDICAL_DISCLAIMER
    return message


async def get_user_preferences(user_id: str) -> Dict[str, bool]:
    """Tìm nạp tuỳ chọn nhận thông báo của người dùng từ cơ sở dữ liệu.

    Args:
        user_id: ID của người dùng cần kiểm tra.

    Returns:
        Dictionary tuỳ chọn thông báo (ví dụ: {"health": True, "chat": False}).
    """
    logger.debug("Đang đọc tuỳ chọn thông báo cho user_id=%s", user_id)
    default_prefs = {
        "health": True,
        "appointment": True,
        "record": True,
        "chat": True,
        "system": True,
        "security": True
    }
    
    try:
        row = await database.fetch_one(
            "SELECT notification_preferences FROM users WHERE id = CAST(:user_id AS uuid)",
            {"user_id": user_id}
        )
        if not row or not row["notification_preferences"]:
            logger.debug("Không tìm thấy preferences cho user_id=%s, sử dụng mặc định", user_id)
            return default_prefs
            
        prefs = row["notification_preferences"]
        if isinstance(prefs, str):
            prefs = json.loads(prefs)
            
        # Merge với default để tránh thiếu key mới
        return {**default_prefs, **prefs}
    except Exception as e:
        logger.exception("Lỗi khi tìm nạp tuỳ chọn thông báo cho user_id=%s", user_id)
        return default_prefs


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    type: str,
    category: str,
    severity: str = "info",
    patient_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    action_url: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    cooldown_mins: int = 0
) -> Optional[dict]:
    """Tạo một thông báo mới, lưu vào DB và phát qua WebSocket nếu được kích hoạt.

    Args:
        user_id: ID người nhận.
        title: Tiêu đề thông báo.
        message: Nội dung thông báo.
        type: Phân loại chi tiết (ví dụ: 'alert_created', 'chat_received').
        category: Danh mục chính ('health', 'appointment', 'record', 'chat', 'system', 'security').
        severity: Mức độ nghiêm trọng ('info', 'success', 'warning', 'critical').
        patient_id: ID bệnh nhân liên kết (nếu có).
        actor_id: ID người tạo hành động (nếu có).
        source_table: Tên bảng nguồn liên kết.
        source_id: ID bản ghi nguồn liên kết.
        metadata: Siêu dữ liệu JSON bổ sung.
        action_url: URL điều hướng hành động.
        expires_at: Thời gian hết hạn của thông báo.
        cooldown_mins: Số phút giãn cách tối thiểu giữa hai thông báo cùng type cho cùng một user.

    Returns:
        Dict thông báo đã được lưu hoặc None nếu bị bỏ qua do tuỳ chọn hoặc do cooldown.
    """
    logger.info("Bắt đầu create_notification: user_id=%s category=%s type=%s severity=%s", user_id, category, type, severity)
    
    # 1. Kiểm tra tuỳ chọn nhận thông báo
    prefs = await get_user_preferences(user_id)
    if not prefs.get(category, True):
        logger.info("Thông báo bị bỏ qua do tuỳ chọn người dùng: user_id=%s category=%s", user_id, category)
        return None

    # 2. Kiểm tra Cooldown để chống spam
    if cooldown_mins > 0:
        recent = await database.fetch_one(
            """
            SELECT 1 FROM notifications 
            WHERE user_id = CAST(:user_id AS uuid) 
              AND type = :type 
              AND created_at > NOW() - CAST(:cooldown_interval AS interval)
            LIMIT 1
            """,
            {"user_id": user_id, "type": type, "cooldown_interval": f"{cooldown_mins} minutes"}
        )
        if recent:
            logger.info("Thông báo bị bỏ qua do cooldown (%d phút): user_id=%s type=%s", cooldown_mins, user_id, type)
            return None

    # 3. Enforce disclaimer cho AI thông báo
    message = enforce_medical_disclaimer(message, type)

    # 3. Tạo ID và chuẩn bị dữ liệu insert
    notification_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    query = """
    INSERT INTO notifications (
        id, user_id, patient_id, actor_id, type, category, severity,
        title, message, source_table, source_id, metadata, action_url,
        is_read, created_at, updated_at, expires_at
    ) VALUES (
        CAST(:id AS uuid), CAST(:user_id AS uuid), 
        CAST(:patient_id AS uuid), CAST(:actor_id AS uuid),
        :type, :category, :severity, :title, :message, :source_table,
        CAST(:source_id AS uuid), CAST(:metadata AS jsonb), :action_url,
        FALSE, :created_at, :updated_at, :expires_at
    )
    """
    
    values = {
        "id": notification_id,
        "user_id": user_id,
        "patient_id": patient_id,
        "actor_id": actor_id,
        "type": type,
        "category": category,
        "severity": severity,
        "title": title,
        "message": message,
        "source_table": source_table,
        "source_id": source_id,
        "metadata": json.dumps(metadata or {}),
        "action_url": action_url,
        "created_at": now,
        "updated_at": now,
        "expires_at": expires_at
    }

    try:
        await database.execute(query, values)
        logger.info("Đã lưu thông báo thành công: id=%s user_id=%s", notification_id, user_id)
        
        # Lấy bản ghi hoàn chỉnh từ DB để broadcast
        saved_row = await database.fetch_one(
            "SELECT * FROM notifications WHERE id = CAST(:id AS uuid)",
            {"id": notification_id}
        )
        if not saved_row:
            return None
            
        record = {key: saved_row[key] for key in saved_row.keys()}
        
        # Chuẩn hóa kiểu dữ liệu cho JSON tuần tự hóa
        from app.api.crud_api import to_jsonable
        jsonable_record = to_jsonable(record)
        
        # 4. Phát sóng thời gian thực qua WebSocket
        await manager.broadcast_notification(user_id, jsonable_record)
        logger.info("Đã phát sóng thông báo qua WebSocket: id=%s user_id=%s", notification_id, user_id)
        
        return jsonable_record
    except Exception as e:
        logger.exception("Lỗi khi tạo thông báo trong DB: user_id=%s error=%s", user_id, str(e))
        return None


async def notify_patient(
    patient_id: str,
    title: str,
    message: str,
    type: str,
    category: str,
    severity: str = "info",
    actor_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    action_url: Optional[str] = None,
    cooldown_mins: int = 0
) -> Optional[dict]:
    """Gửi thông báo đến tài khoản bệnh nhân cụ thể.

    Args:
        patient_id: ID bệnh nhân (ID trong bảng patients, trùng khớp user_id hoặc liên kết).
        title: Tiêu đề thông báo.
        message: Nội dung thông báo.
        type: Phân loại chi tiết.
        category: Danh mục chính.
        severity: Mức độ nghiêm trọng.
        actor_id: ID người thực hiện hành động.
        source_table: Tên bảng nguồn.
        source_id: ID bảng nguồn.
        metadata: Metadata bổ sung.
        action_url: URL hành động.
        cooldown_mins: Số phút giãn cách tối thiểu.

    Returns:
        Bản ghi thông báo đã được lưu.
    """
    logger.debug("Gọi notify_patient: patient_id=%s title=%s", patient_id, title)
    # Tìm user_id tương ứng với patient_id từ bảng patients
    try:
        row = await database.fetch_one(
            "SELECT user_id::text FROM patients WHERE id = CAST(:patient_id AS uuid)",
            {"patient_id": patient_id}
        )
        # Nếu bảng patients dùng id trùng khớp user_id hoặc cột user_id bị null, fallback về chính patient_id
        target_user_id = row["user_id"] if row and row["user_id"] else patient_id
        
        return await create_notification(
            user_id=target_user_id,
            title=title,
            message=message,
            type=type,
            category=category,
            severity=severity,
            patient_id=patient_id,
            actor_id=actor_id,
            source_table=source_table,
            source_id=source_id,
            metadata=metadata,
            action_url=action_url,
            cooldown_mins=cooldown_mins
        )
    except Exception as e:
        logger.exception("Lỗi trong notify_patient: patient_id=%s", patient_id)
        return None


async def notify_assigned_doctors(
    patient_id: str,
    title: str,
    message: str,
    type: str,
    category: str,
    severity: str = "info",
    actor_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    action_url: Optional[str] = None,
    cooldown_mins: int = 0
) -> List[dict]:
    """Gửi thông báo tới toàn bộ bác sĩ được phân công quản lý bệnh nhân này.

    Args:
        patient_id: ID bệnh nhân.
        title: Tiêu đề.
        message: Nội dung.
        type: Phân loại chi tiết.
        category: Danh mục chính.
        severity: Mức độ.
        actor_id: ID người thực hiện.
        source_table: Bảng nguồn.
        source_id: ID nguồn.
        metadata: Metadata.
        action_url: URL hành động.
        cooldown_mins: Số phút giãn cách tối thiểu.

    Returns:
        Danh sách thông báo đã lưu thành công.
    """
    logger.debug("Gọi notify_assigned_doctors: patient_id=%s", patient_id)
    results = []
    try:
        rows = await database.fetch_all(
            "SELECT doctor_id::text FROM doctor_patient WHERE patient_id = CAST(:patient_id AS uuid)",
            {"patient_id": patient_id}
        )
        doctor_ids = [row["doctor_id"] for row in rows if row["doctor_id"]]
        logger.info("Tìm thấy %d bác sĩ phụ trách cho patient_id=%s", len(doctor_ids), patient_id)
        
        for doc_id in doctor_ids:
            notif = await create_notification(
                user_id=doc_id,
                title=title,
                message=message,
                type=type,
                category=category,
                severity=severity,
                patient_id=patient_id,
                actor_id=actor_id,
                source_table=source_table,
                source_id=source_id,
                metadata=metadata,
                action_url=action_url,
                cooldown_mins=cooldown_mins
            )
            if notif:
                results.append(notif)
    except Exception as e:
        logger.exception("Lỗi trong notify_assigned_doctors: patient_id=%s", patient_id)
    return results


async def notify_admins(
    title: str,
    message: str,
    type: str,
    category: str,
    severity: str = "info",
    patient_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    action_url: Optional[str] = None,
    cooldown_mins: int = 0
) -> List[dict]:
    """Gửi thông báo đến toàn bộ các tài khoản admin trong hệ thống.

    Args:
        title: Tiêu đề.
        message: Nội dung.
        type: Phân loại chi tiết.
        category: Danh mục chính.
        severity: Mức độ.
        patient_id: ID bệnh nhân (nếu có).
        actor_id: ID người thực hiện.
        source_table: Bảng nguồn.
        source_id: ID nguồn.
        metadata: Metadata.
        action_url: URL hành động.
        cooldown_mins: Số phút giãn cách tối thiểu.

    Returns:
        Danh sách thông báo đã lưu thành công.
    """
    logger.debug("Gọi notify_admins: type=%s", type)
    results = []
    try:
        rows = await database.fetch_all(
            "SELECT id::text FROM users WHERE lower(role) = 'admin' AND status = 'active'"
        )
        admin_ids = [row["id"] for row in rows if row["id"]]
        logger.info("Tìm thấy %d tài khoản admin hoạt động", len(admin_ids))
        
        for admin_id in admin_ids:
            notif = await create_notification(
                user_id=admin_id,
                title=title,
                message=message,
                type=type,
                category=category,
                severity=severity,
                patient_id=patient_id,
                actor_id=actor_id,
                source_table=source_table,
                source_id=source_id,
                metadata=metadata,
                action_url=action_url,
                cooldown_mins=cooldown_mins
            )
            if notif:
                results.append(notif)
    except Exception as e:
        logger.exception("Lỗi trong notify_admins")
    return results


async def mark_as_read(notification_id: str, user_id: str) -> bool:
    """Đánh dấu một thông báo là đã đọc (chỉ nếu thuộc về user_id đó).

    Args:
        notification_id: ID thông báo.
        user_id: ID người sở hữu thông báo.

    Returns:
        True nếu thành công, False nếu không tìm thấy hoặc lỗi.
    """
    logger.info("Gọi mark_as_read: notification_id=%s user_id=%s", notification_id, user_id)
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        rows_updated = await database.execute(
            """
            UPDATE notifications 
            SET is_read = TRUE, read_at = :read_at 
            WHERE id = CAST(:id AS uuid) AND user_id = CAST(:user_id AS uuid) AND is_read = FALSE
            """,
            {"id": notification_id, "user_id": user_id, "read_at": now}
        )
        if rows_updated > 0:
            logger.info("Đã đánh dấu đã đọc thông báo: id=%s", notification_id)
            # Phát sóng trạng thái mới để cập nhật badge UI
            updated_row = await database.fetch_one(
                "SELECT * FROM notifications WHERE id = CAST(:id AS uuid)",
                {"id": notification_id}
            )
            if updated_row:
                from app.api.crud_api import to_jsonable
                await manager.broadcast_notification(user_id, to_jsonable({k: updated_row[k] for k in updated_row.keys()}))
            return True
        return False
    except Exception as e:
        logger.exception("Lỗi khi mark_as_read: notification_id=%s", notification_id)
        return False


async def mark_all_as_read(user_id: str) -> bool:
    """Đánh dấu tất cả thông báo chưa đọc của người dùng là đã đọc.

    Args:
        user_id: ID người dùng.

    Returns:
        True nếu thành công, False nếu lỗi.
    """
    logger.info("Gọi mark_all_as_read: user_id=%s", user_id)
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        await database.execute(
            """
            UPDATE notifications 
            SET is_read = TRUE, read_at = :read_at 
            WHERE user_id = CAST(:user_id AS uuid) AND is_read = FALSE
            """,
            {"user_id": user_id, "read_at": now}
        )
        logger.info("Đã đánh dấu đã đọc toàn bộ thông báo cho user_id=%s", user_id)
        
        # Phát thông báo cập nhật chung
        await manager.broadcast_notification(user_id, {"type": "read_all_sync", "user_id": user_id})
        return True
    except Exception as e:
        logger.exception("Lỗi khi mark_all_as_read: user_id=%s", user_id)
        return False
