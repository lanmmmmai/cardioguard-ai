"""Quản lý kết nối Redis cho Shared State (Rate Limiting, Cache).

MỤC ĐÍCH:
    Kết nối tới dịch vụ Redis (ví dụ Redis Cloud hoặc Render Redis).
    Nếu không có REDIS_URL hoặc kết nối lỗi, hệ thống sẽ tự động tắt
    và hoạt động ở chế độ Fallback (In-memory) để đảm bảo ứng dụng không bị crash.
"""

import logging
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self):
        self.url = settings.REDIS_URL
        self.client = None
        self.is_active = False

    async def initialize(self):
        """Khởi tạo kết nối tới Redis."""
        if not self.url or not self.url.strip():
            logger.warning("REDIS_URL trống. Redis client hoạt động ở chế độ OFFLINE (Fallback in-memory)")
            self.is_active = False
            return

        try:
            # decode_responses=True giúp tự động chuyển đổi bytes sang str
            self.client = redis.from_url(
                self.url,
                decode_responses=True,
                socket_connect_timeout=5.0,
                socket_timeout=5.0,
            )
            # Thử ping kiểm tra kết nối thực tế
            await self.client.ping()
            self.is_active = True
            logger.info("Kết nối thành công tới Redis: %s", self.url.split("@")[-1] if "@" in self.url else self.url)
        except Exception as e:
            logger.exception("Kết nối tới Redis thất bại. Redis client chuyển sang chế độ OFFLINE (Fallback in-memory)")
            self.is_active = False
            self.client = None

    async def close(self):
        """Đóng kết nối Redis."""
        if self.client:
            try:
                await self.client.close()
                logger.info("Đã đóng kết nối Redis client")
            except Exception:
                logger.exception("Lỗi khi đóng kết nối Redis")
            finally:
                self.client = None
                self.is_active = False

    async def ping(self) -> bool:
        if not self.is_active or not self.client:
            return False
        try:
            await self.client.ping()
            return True
        except Exception:
            return False

    async def get(self, key: str) -> str | None:
        if not self.is_active or not self.client:
            return None
        try:
            return await self.client.get(key)
        except Exception:
            logger.warning("Lỗi Redis get(%s)", key)
            return None

    async def set(self, key: str, value: str, expire: int = None) -> bool:
        if not self.is_active or not self.client:
            return False
        try:
            await self.client.set(key, value, ex=expire)
            return True
        except Exception:
            logger.warning("Lỗi Redis set(%s)", key)
            return False

    async def delete(self, key: str) -> bool:
        if not self.is_active or not self.client:
            return False
        try:
            await self.client.delete(key)
            return True
        except Exception:
            logger.warning("Lỗi Redis delete(%s)", key)
            return False

    async def incr(self, key: str) -> int | None:
        if not self.is_active or not self.client:
            return None
        try:
            return await self.client.incr(key)
        except Exception:
            logger.warning("Lỗi Redis incr(%s)", key)
            return None

    async def expire(self, key: str, seconds: int) -> bool:
        if not self.is_active or not self.client:
            return False
        try:
            return await self.client.expire(key, seconds)
        except Exception:
            logger.warning("Lỗi Redis expire(%s)", key)
            return False

    async def ttl(self, key: str) -> int:
        if not self.is_active or not self.client:
            return -1
        try:
            return await self.client.ttl(key)
        except Exception:
            logger.warning("Lỗi Redis ttl(%s)", key)
            return -1


# Thể hiện Redis client toàn cục
redis_client = RedisClient()
