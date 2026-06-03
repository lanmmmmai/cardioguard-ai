"""Engine SQLAlchemy bất đồng bộ và nhà máy phiên làm việc.

MỤC ĐÍCH:
    Tạo engine SQLAlchemy bất đồng bộ có thể tái sử dụng với nhóm kết nối
    và sessionmaker để tiêm phụ thuộc trong các điểm cuối bất đồng bộ.
    Tự động chuyển đổi URL postgresql:// sang định dạng tương thích asyncpg.

LUỒNG XỬ LÝ:
    1. async_database_url() chuyển đổi DATABASE_URL sang scheme asyncpg nếu cần.
    2. create_async_engine() xây dựng nhóm kết nối (10 pool / 20 overflow).
    3. AsyncSessionLocal được sử dụng bởi FastAPI dependency injection.

QUAN HỆ:
    - URL lấy từ: app.core.config.settings.DATABASE_URL
    - Được sử dụng bởi: migration Alembic, điểm cuối admin/CRUD với SQLAlchemy
"""

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings


def async_database_url() -> str:
    """Chuyển đổi DATABASE_URL sang URL tương thích asyncpg.

    Tự động chuyển sang trình điều khiển asyncpg bằng cách thay thế scheme.

    Trả về:
        Chuỗi URL cơ sở dữ liệu với scheme postgresql+asyncpg://.
    """
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Engine bất đồng bộ toàn cục với cấu hình pool tối ưu cho Supabase Pooler
# pool_size=3 + max_overflow=5: tối đa 8 kết nối, tránh vượt giới hạn Supabase (~15-30)
# pool_recycle=3600: xoay vòng kết nối mỗi giờ để tránh timeout từ Supabase pooler
async_engine = create_async_engine(
    async_database_url(),
    connect_args={
        "statement_cache_size": 0,
        "command_timeout": 30,
    },
    pool_size=3,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)
# Nhà máy tạo phiên làm việc bất đồng bộ, tắt tự động làm mới đối tượng sau khi commit
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
