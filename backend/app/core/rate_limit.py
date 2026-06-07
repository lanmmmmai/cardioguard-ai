"""Giới hạn tốc độ trong bộ nhớ và Redis cho các điểm cuối xác thực.

MỤC ĐÍCH:
    Bảo vệ các điểm cuối xác thực (đăng nhập, OTP) khỏi tấn công brute-force
    bằng cách giới hạn yêu cầu theo tổ hợp IP/email/điểm cuối trong
    một cửa sổ thời gian trượt. Hỗ trợ Redis làm Shared State và fallback In-memory.
"""

import asyncio
from collections import OrderedDict
import logging
import time
from fastapi import HTTPException, Request
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    parts = email.split("@", 1)
    local = parts[0]
    domain = parts[1]
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


# Bộ nhớ lưu trữ giới hạn tốc độ: { (ip, email, endpoint): [danh_sách_dấu_thời_gian] }
_rate_limits: "OrderedDict[tuple[str, str, str], list[float]]" = OrderedDict()
_RATE_LIMIT_STORE_MAX_KEYS = 2048
_RATE_LIMIT_RETENTION_SECONDS = 300
_rate_limit_lock = asyncio.Lock()


def _prune_rate_limits(now: float) -> None:
    """Dọn các key đã hết hạn và chặn tăng trưởng bộ nhớ vô hạn."""
    expired_keys = [
        key
        for key, timestamps in list(_rate_limits.items())
        if not [ts for ts in timestamps if now - ts < _RATE_LIMIT_RETENTION_SECONDS]
    ]
    for key in expired_keys:
        _rate_limits.pop(key, None)

    while len(_rate_limits) > _RATE_LIMIT_STORE_MAX_KEYS:
        _rate_limits.popitem(last=False)


def get_client_ip(request: Request) -> str:
    """Trích xuất địa chỉ IP thực của máy khách từ các header yêu cầu."""
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(ip: str, email: str, endpoint: str, max_requests: int = 5, window_seconds: int = 60):
    """Kiểm tra và thực thi giới hạn tốc độ cho một máy khách + hành động cụ thể.

    Nếu Redis được kết nối, sử dụng Redis làm Shared Rate Limiting.
    Ngược lại, tự động chuyển sang fallback In-memory.
    """
    normalized_email = email.lower().strip()

    # 1. Thử sử dụng Redis
    if redis_client.is_active:
        key = f"ratelimit:{ip}:{normalized_email}:{endpoint}"
        try:
            current = await redis_client.incr(key)
            if current is not None:
                if current == 1:
                    await redis_client.expire(key, window_seconds)
                if current > max_requests:
                    ttl = await redis_client.ttl(key)
                    if ttl < 0:
                        ttl = window_seconds
                    logger.warning("Vượt quá giới hạn tốc độ (Redis): ip=%s email=%s endpoint=%s chờ=%ds", ip, mask_email(email), endpoint, ttl)
                    raise HTTPException(
                        status_code=429,
                        detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {ttl} giây."
                    )
                logger.debug("check_rate_limit (Redis): allowed, key=%s count=%d/%d window=%ds", key, current, max_requests, window_seconds)
                return
        except HTTPException:
            raise
        except Exception:
            logger.exception("Lỗi khi kiểm tra rate limit bằng Redis, chuyển sang fallback bộ nhớ trong...")

    # 2. Fallback In-memory
    async with _rate_limit_lock:
        now = time.time()
        key_mem = (ip, normalized_email, endpoint)

        # Lấy danh sách dấu thời gian hiện tại hoặc khởi tạo danh sách rỗng
        timestamps = _rate_limits.get(key_mem, [])
        # Chỉ giữ lại các dấu thời gian còn trong cửa sổ
        timestamps = [t for t in timestamps if now - t < window_seconds]

        # Nếu số lượng yêu cầu đã đạt giới hạn, ném lỗi 429
        if len(timestamps) >= max_requests:
            wait_time = int(window_seconds - (now - timestamps[0]))
            if wait_time <= 0:
                wait_time = 1
            logger.warning("Vượt quá giới hạn tốc độ (In-memory Fallback): ip=%s email=%s endpoint=%s chờ=%ds", ip, mask_email(email), endpoint, wait_time)
            raise HTTPException(
                status_code=429,
                detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {wait_time} giây."
            )

        # Thêm dấu thời gian hiện tại vào danh sách
        timestamps.append(now)
        _rate_limits[key_mem] = timestamps
        _rate_limits.move_to_end(key_mem)
        _prune_rate_limits(now)
        logger.debug("check_rate_limit (In-memory Fallback): allowed, ip=%s email=%s endpoint=%s count=%d/%d window=%ds", ip, mask_email(email), endpoint, len(timestamps), max_requests, window_seconds)
