"""Quản lý kết nối cơ sở dữ liệu.

MỤC ĐÍCH:
    Quản lý vòng đời kết nối cơ sở dữ liệu PostgreSQL bất đồng bộ
    sử dụng thư viện `databases`. Cung cấp các hàm trợ giúp
    kết nối/ngắt kết nối được dùng khi ứng dụng khởi động/tắt.

LUỒNG XỬ LÝ:
    1. Tạo một thể hiện Database trỏ đến DATABASE_URL từ cấu hình.
    2. connect_db() được gọi khi ứng dụng khởi động.
    3. disconnect_db() được gọi khi ứng dụng tắt.

TỐI ƯU CHO SUPABASE POOLER:
    - Sử dụng Supabase pooled mode (port 6543) với connection pool nhỏ
    - pool_size=5, min_size=2: tiết kiệm kết nối cho Supabase Pooler
    - max_queries=50000: xoay vòng kết nối để tránh rò rỉ bộ nhớ
    - max_inactive_connection_lifetime=600: đóng kết nối không hoạt động sau 10 phút

QUAN HỆ:
    - URL cơ sở dữ liệu lấy từ: app.core.config.settings
    - Được sử dụng bởi: app.main (sự kiện khởi động/tắt),
      app.services.* (thực thi truy vấn trực tiếp qua database.execute/fetch)
"""

import logging
from databases import Database
from app.core.config import settings

logger = logging.getLogger(__name__)

# Thể hiện Database toàn cục với cấu hình pool tối ưu cho Supabase Pooler
# pool_size nhỏ để không vượt quá giới hạn kết nối Supabase (thường 15-30)
database = Database(
    settings.DATABASE_URL,
    statement_cache_size=0,
    min_size=2,
    max_size=5,
    max_queries=50000,
    max_inactive_connection_lifetime=600,
    command_timeout=30,
)


async def connect_db():
    """Thiết lập nhóm kết nối cơ sở dữ liệu khi ứng dụng khởi động."""
    logger.info("Đang kết nối đến cơ sở dữ liệu...")
    try:
        await database.connect()
        logger.info("Kết nối cơ sở dữ liệu thành công")
    except Exception as e:
        logger.exception("Kết nối cơ sở dữ liệu thất bại")
        raise


async def disconnect_db():
    """Đóng nhóm kết nối cơ sở dữ liệu khi ứng dụng tắt."""
    logger.info("Đang ngắt kết nối cơ sở dữ liệu...")
    try:
        await database.disconnect()
        logger.info("Ngắt kết nối cơ sở dữ liệu thành công")
    except Exception as e:
        logger.exception("Lỗi khi ngắt kết nối cơ sở dữ liệu")
