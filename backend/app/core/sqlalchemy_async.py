from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings


def async_database_url() -> str:
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


async_engine = create_async_engine(
    async_database_url(),
    connect_args={"statement_cache_size": 0},
    poolclass=NullPool,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
