import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from app.core.database import database

_audit_columns_cache: Optional[set[str]] = None

async def log_activity(
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict[str, Any]] = None
) -> None:
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
            print("[Audit Service] Table audit_logs does not exist in database")
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
            payload["created_at"] = datetime.utcnow()
            
        # Tương thích ngược nếu sau này database bổ sung cột details
        if "details" in columns and details is not None:
            payload["details"] = json.dumps(details)

        insert_cols = ", ".join(f'"{k}"' for k in payload.keys())
        bind_cols = ", ".join(f":{k}" for k in payload.keys())
        
        await database.execute(
            f"INSERT INTO audit_logs ({insert_cols}) VALUES ({bind_cols})",
            payload
        )
        print(f"[Audit Service] Ghi log thành công: {action} (User: {user_id})")
    except Exception as e:
        # Xử lý ngoại lệ an toàn để không làm hỏng luồng nghiệp vụ chính của người dùng
        print(f"[Audit Service] Lỗi khi ghi log hoạt động hệ thống: {e}")
