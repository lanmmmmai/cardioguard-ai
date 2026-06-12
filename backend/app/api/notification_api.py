"""API Router quản lý thông báo.

Mục đích:
    Cung cấp các endpoints để truy vấn thông báo, đếm số thông báo chưa đọc,
    đánh dấu đã đọc đơn lẻ/tất cả, và cập nhật cấu hình tuỳ chọn nhận thông báo.

Luồng xử lý:
    1. Xác thực người dùng bằng token Bearer qua get_user_from_token.
    2. Thực thi các truy vấn SQL thô có lọc phân quyền theo user_id.
    3. Hỗ trợ cập nhật preferences động qua thao tác nối JSONB.

Quan hệ:
    - Phụ thuộc: app.api.auth_api.get_user_from_token
    - Phụ thuộc: app.services.notification_service
    - Bảng: notifications, users
"""

import logging
import json
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from app.core.database import database
from app.api.auth_api import get_user_from_token
from app.api.crud_api import to_jsonable
from app.services import notification_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


class PreferencesUpdate(BaseModel):
    """Lược đồ dữ liệu yêu cầu cập nhật tuỳ chọn thông báo."""
    health: Optional[bool] = None
    appointment: Optional[bool] = None
    record: Optional[bool] = None
    chat: Optional[bool] = None
    system: Optional[bool] = None
    security: Optional[bool] = None


@router.get("")
async def list_notifications(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    is_read: Optional[bool] = Query(default=None),
    category: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None)
):
    """Liệt kê các thông báo của người dùng đã đăng nhập với bộ lọc tuỳ chọn.

    Args:
        limit: Số lượng tối đa bản ghi trả về.
        offset: Độ lệch phân trang.
        is_read: Lọc theo trạng thái đã đọc/chưa đọc.
        category: Lọc theo danh mục chính.
        severity: Lọc theo mức độ nghiêm trọng.
        authorization: Token xác thực Bearer.

    Returns:
        Envelope phân trang chứa danh sách thông báo.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.info("list_notifications: user_id=%s limit=%d offset=%d filters=(is_read=%s, cat=%s, sev=%s)",
                user_id, limit, offset, is_read, category, severity)

    where_clauses = ["user_id = CAST(:user_id AS uuid)"]
    values = {"user_id": user_id}

    if is_read is not None:
        where_clauses.append("is_read = :is_read")
        values["is_read"] = is_read

    if category:
        where_clauses.append("category = :category")
        values["category"] = category

    if severity:
        where_clauses.append("severity = :severity")
        values["severity"] = severity

    where_sql = " AND ".join(where_clauses)

    count_query = f"SELECT COUNT(*)::int FROM notifications WHERE {where_sql}"
    total = await database.fetch_val(count_query, values)

    query = f"""
        SELECT *
        FROM notifications
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    
    values["limit"] = limit
    values["offset"] = offset
    
    rows = await database.fetch_all(query, values)
    items = [to_jsonable({k: row[k] for k in row.keys()}) for row in rows]
    
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/unread-count")
async def get_unread_count(authorization: Optional[str] = Header(default=None)):
    """Đếm số lượng thông báo chưa đọc của người dùng hiện tại.

    Args:
        authorization: Token xác thực Bearer.

    Returns:
        Dict chứa `count`.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.debug("get_unread_count: user_id=%s", user_id)

    query = "SELECT COUNT(*)::int FROM notifications WHERE user_id = CAST(:user_id AS uuid) AND is_read = FALSE"
    count = await database.fetch_val(query, {"user_id": user_id})
    
    return {"count": count}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    authorization: Optional[str] = Header(default=None)
):
    """Đánh dấu một thông báo cụ thể là đã đọc.

    Args:
        notification_id: ID của thông báo cần đánh dấu.
        authorization: Token xác thực Bearer.

    Returns:
        Trạng thái thành công.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.info("mark_notification_read: notif_id=%s user_id=%s", notification_id, user_id)

    success = await notification_service.mark_as_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo hoặc thông báo đã được đọc")
        
    return {"success": True}


@router.patch("/read-all")
async def mark_all_notifications_read(authorization: Optional[str] = Header(default=None)):
    """Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc.

    Args:
        authorization: Token xác thực Bearer.

    Returns:
        Trạng thái thành công.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.info("mark_all_notifications_read: user_id=%s", user_id)

    await notification_service.mark_all_as_read(user_id)
    return {"success": True}


@router.get("/preferences")
async def get_preferences(authorization: Optional[str] = Header(default=None)):
    """Lấy cấu hình tuỳ chọn nhận thông báo của người dùng hiện tại.

    Args:
        authorization: Token xác thực Bearer.

    Returns:
        Dict tuỳ chọn thông báo.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.debug("get_preferences: user_id=%s", user_id)

    prefs = await notification_service.get_user_preferences(user_id)
    return prefs


@router.patch("/preferences")
async def update_preferences(
    payload: PreferencesUpdate,
    authorization: Optional[str] = Header(default=None)
):
    """Cập nhật tuỳ chọn nhận thông báo của người dùng hiện tại.

    Mã thực hiện merge đè vào trường JSONB của user trong DB.

    Args:
        payload: Lược đồ các tuỳ chọn cần bật/tắt.
        authorization: Token xác thực Bearer.

    Returns:
        Cấu hình tuỳ chọn mới sau khi cập nhật.
    """
    current_user = await get_user_from_token(authorization)
    user_id = current_user["id"]
    logger.info("update_preferences: user_id=%s payload=%s", user_id, payload)

    update_dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_dict:
        # Trả về preferences hiện tại nếu không thay đổi gì
        return await notification_service.get_user_preferences(user_id)

    try:
        # Nối đối tượng jsonb bằng toán tử ||
        await database.execute(
            """
            UPDATE users 
            SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || CAST(:prefs AS jsonb)
            WHERE id = CAST(:user_id AS uuid)
            """,
            {"user_id": user_id, "prefs": json.dumps(update_dict)}
        )
        logger.info("Đã cập nhật preferences thành công cho user_id=%s", user_id)
        
        # Trả về preferences mới
        return await notification_service.get_user_preferences(user_id)
    except Exception as e:
        logger.exception("Lỗi khi cập nhật tuỳ chọn thông báo: user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Không thể lưu cấu hình tuỳ chọn")
