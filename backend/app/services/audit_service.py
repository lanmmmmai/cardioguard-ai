"""Dịch vụ nhật ký kiểm toán cho CardioGuard.

Mục đích:
    Cung cấp một điểm vào duy nhất để ghi lại hoạt động của người dùng trong bảng audit_logs.
    Sử dụng danh sách cột được lưu trong bộ nhớ đệm để xây dựng động các câu lệnh INSERT,
    giúp nó linh hoạt với các thay đổi lược đồ (ví dụ: các cột tùy chọn như `details`).

    Hỗ trợ ghi batch để giảm số lần round-trip đến database. Các bản ghi được
    buffer trong bộ nhớ và flush định kỳ hoặc khi buffer đầy.

Luồng công việc:
    log_activity() thêm bản ghi vào buffer. Khi buffer đầy (25 entries) hoặc
    sau 5 giây, buffer được flush xuống database trong một batch INSERT duy nhất.

Quan hệ:
    - app.core.database.database: Nhóm kết nối cơ sở dữ liệu được sử dụng cho tất cả các truy vấn.
    - Được gọi từ các trình xử lý tuyến API, phần mềm trung gian hoặc tác vụ nền để ghi lại sự kiện.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from app.core.database import database

_audit_columns_cache: Optional[set[str]] = None
logger = logging.getLogger(__name__)

_audit_buffer: list[dict[str, Any]] = []
_buffer_lock = asyncio.Lock()
_flush_task: Optional[asyncio.Task[None]] = None

BUFFER_MAX_SIZE = 25
FLUSH_INTERVAL_SECONDS = 5.0


async def _flush_buffer() -> None:
    """Flush audit log buffer xuống database."""
    global _audit_buffer
    async with _buffer_lock:
        if not _audit_buffer:
            return
        entries_to_flush = _audit_buffer[:]
        _audit_buffer.clear()

    if not entries_to_flush:
        return

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

        if len(entries_to_flush) == 1:
            entry = entries_to_flush[0]
            payload = {}
            if "id" in columns:
                payload["id"] = entry["id"]
            if "user_id" in columns and entry.get("user_id"):
                payload["user_id"] = str(entry["user_id"])
            if "action" in columns:
                payload["action"] = entry["action"]
            if "entity_type" in columns:
                payload["entity_type"] = entry["entity_type"]
            if "entity_id" in columns and entry.get("entity_id"):
                payload["entity_id"] = str(entry["entity_id"])
            if "ip_address" in columns:
                payload["ip_address"] = entry.get("ip_address") or "-"
            if "created_at" in columns:
                payload["created_at"] = entry["created_at"]
            if "details" in columns and entry.get("details") is not None:
                payload["details"] = json.dumps(entry["details"])

            insert_cols = ", ".join(f'"{k}"' for k in payload.keys())
            bind_cols = ", ".join(f":{k}" for k in payload.keys())
            await database.execute(
                f"INSERT INTO audit_logs ({insert_cols}) VALUES ({bind_cols})",
                payload,
            )
        else:
            batch_payloads = []
            for entry in entries_to_flush:
                payload = {}
                if "id" in columns:
                    payload["id"] = entry["id"]
                if "user_id" in columns and entry.get("user_id"):
                    payload["user_id"] = str(entry["user_id"])
                if "action" in columns:
                    payload["action"] = entry["action"]
                if "entity_type" in columns:
                    payload["entity_type"] = entry["entity_type"]
                if "entity_id" in columns and entry.get("entity_id"):
                    payload["entity_id"] = str(entry["entity_id"])
                if "ip_address" in columns:
                    payload["ip_address"] = entry.get("ip_address") or "-"
                if "created_at" in columns:
                    payload["created_at"] = entry["created_at"]
                if "details" in columns and entry.get("details") is not None:
                    payload["details"] = json.dumps(entry["details"])
                batch_payloads.append(payload)

            all_keys = list(batch_payloads[0].keys())
            insert_cols = ", ".join(f'"{k}"' for k in all_keys)
            placeholders = []
            flat_values = {}
            for i, payload in enumerate(batch_payloads):
                row_placeholders = []
                for key in all_keys:
                    param_name = f"p{i}_{key}"
                    row_placeholders.append(f":{param_name}")
                    flat_values[param_name] = payload[key]
                placeholders.append(f"({', '.join(row_placeholders)})")

            values_sql = ", ".join(placeholders)
            await database.execute(
                f"INSERT INTO audit_logs ({insert_cols}) VALUES {values_sql}",
                flat_values,
            )

        logger.debug("Audit batch flushed: count=%d", len(entries_to_flush))
    except Exception:
        logger.exception("Failed to flush audit log batch (count=%d)", len(entries_to_flush))


def _schedule_flush() -> None:
    """Lên lịch flush buffer sau FLUSH_INTERVAL_SECONDS nếu chưa có task chạy."""
    global _flush_task
    if _flush_task is not None and not _flush_task.done():
        return
    loop = asyncio.get_event_loop()
    _flush_task = loop.create_task(_delayed_flush())


async def _delayed_flush() -> None:
    """Đợi rồi flush buffer."""
    await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
    await _flush_buffer()


async def flush_audit_logs() -> None:
    """Flush thủ công audit buffer đang chờ."""
    await _flush_buffer()


async def shutdown_audit_logging() -> None:
    """Dừng task flush nền và flush nốt audit buffer trước khi shutdown."""
    global _flush_task
    flush_task = _flush_task
    _flush_task = None
    if flush_task is not None and not flush_task.done():
        flush_task.cancel()
        try:
            await flush_task
        except asyncio.CancelledError:
            logger.debug("Audit delayed flush task cancelled during shutdown")
    await _flush_buffer()


async def log_activity(
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    """Ghi một mục hoạt động vào buffer, flush tự động khi đầy hoặc hết giờ.

    Args:
        user_id: Định danh người dùng. Có thể None cho sự kiện ẩn danh.
        action: Cụm từ động từ ngắn (ví dụ: "LOGIN", "UPDATE_PROFILE").
        entity_type: Loại thực thể (ví dụ: "user", "device").
        entity_id: Định danh tùy chọn của thực thể.
        ip_address: Địa chỉ IP nguồn.
        details: Payload tùy ý tùy chọn.
    """
    try:
        entry = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id) if user_id else None,
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "ip_address": ip_address or "-",
            # Database columns are stored as timestamp without timezone in this deployment,
            # so persist a UTC-naive value to avoid asyncpg timezone coercion errors.
            "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "details": details,
        }

        async with _buffer_lock:
            _audit_buffer.append(entry)
            buffer_size = len(_audit_buffer)

        if buffer_size >= BUFFER_MAX_SIZE:
            asyncio.create_task(_flush_buffer())
        else:
            _schedule_flush()

        logger.debug("Audit log buffered: action=%s user_id=%s (buffer=%d)", action, user_id, buffer_size)
    except Exception as e:
        logger.exception("Failed to buffer audit log for action=%s user_id=%s", action, user_id)
