"""Dịch vụ nhật ký kiểm toán cho CardioGuard.

Mục đích:
    Cung cấp một điểm vào duy nhất để ghi lại hoạt động của người dùng trong bảng audit_logs.
    Sử dụng danh sách cột được lưu trong bộ nhớ đệm để xây dựng động các câu lệnh INSERT,
    giúp nó linh hoạt với các thay đổi lược đồ (ví dụ: các cột tùy chọn như `details`).

Luồng công việc:
    log_activity() trước tiên lấy tên cột của audit_logs thông qua information_schema
    (được lưu trong bộ nhớ đệm trong _audit_columns_cache trong suốt vòng đời của tiến trình), sau đó xây dựng
    danh sách cột và tham số ràng buộc từ các đối số được cung cấp và thực hiện INSERT.

Quan hệ:
    - app.core.database.database: Nhóm kết nối cơ sở dữ liệu được sử dụng cho tất cả các truy vấn.
    - Được gọi từ các trình xử lý tuyến API, phần mềm trung gian hoặc tác vụ nền để ghi lại sự kiện.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from app.core.database import database

_audit_columns_cache: Optional[set[str]] = None
logger = logging.getLogger(__name__)

async def log_activity(
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict[str, Any]] = None
) -> None:
    """Ghi một mục hoạt động trong bảng audit_logs.

    Khám phá động các cột của bảng khi gọi lần đầu và lưu kết quả vào bộ nhớ đệm.
    Xây dựng một câu lệnh INSERT chỉ chứa các cột tồn tại trong lược đồ,
    ngăn ngừa lỗi cứng khi các cột tùy chọn được thêm vào sau này.

    Args:
        user_id: Định danh của người dùng đã thực hiện hành động. Có thể là None
            cho các sự kiện ẩn danh hoặc do hệ thống kích hoạt.
        action: Một cụm từ động từ ngắn mô tả thao tác (ví dụ: "LOGIN",
            "UPDATE_PROFILE").
        entity_type: Loại thực thể đang được tác động (ví dụ: "user", "device").
        entity_id: Định danh tùy chọn của phiên bản thực thể cụ thể.
        ip_address: Địa chỉ IP nguồn tùy chọn của yêu cầu.
        details: Tải trọng khóa-giá trị tùy ý tùy chọn để lưu cùng với sự kiện.

    Ngoại lệ:
        Không có ngoại lệ nào được truyền lên; tất cả các lỗi đều được ghi nhật ký và bỏ qua một cách im lặng
        để kiểm toán không bao giờ làm gián đoạn luồng nghiệp vụ chính.
    """
    global _audit_columns_cache
    try:
        if _audit_columns_cache is None:
            rows = await database.fetch_all(
                """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'audit_logs'
                """
            )
            _audit_columns_cache = {row["column_name"] for row in rows}
            
        columns = _audit_columns_cache
        if not columns:
            logger.debug("audit_logs table is not available; skipping audit write")
            return
            
        payload = {}
        log_id = str(uuid.uuid4())
        
        if "id" in columns:
            payload["id"] = log_id
        if "user_id" in columns and user_id:
            payload["user_id"] = str(user_id)
        if "action" in columns:
            payload["action"] = action
        if "entity_type" in columns:
            payload["entity_type"] = entity_type
        if "entity_id" in columns and entity_id:
            payload["entity_id"] = str(entity_id)
        if "ip_address" in columns:
            payload["ip_address"] = ip_address or "-"
        if "created_at" in columns:
            payload["created_at"] = datetime.now(timezone.utc)
            
        # Tương thích ngược nếu sau này database bổ sung cột details
        if "details" in columns and details is not None:
            payload["details"] = json.dumps(details)

        insert_cols = ", ".join(f'"{k}"' for k in payload.keys())
        bind_cols = ", ".join(f":{k}" for k in payload.keys())
        
        await database.execute(
            f"INSERT INTO audit_logs ({insert_cols}) VALUES ({bind_cols})",
            payload
        )
        logger.debug("Audit log recorded: action=%s user_id=%s", action, user_id)
    except Exception as e:
        logger.exception("Failed to write audit log for action=%s user_id=%s", action, user_id)
