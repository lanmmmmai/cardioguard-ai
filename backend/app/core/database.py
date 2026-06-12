"""Quản lý kết nối cơ sở dữ liệu sử dụng SQLAlchemy 2.0 Async engine.

MỤC ĐÍCH:
    Cung cấp lớp Database đóng gói giả lập API của thư viện `databases` cũ.
    Điều này cho phép ứng dụng giữ nguyên toàn bộ các câu lệnh truy vấn thô (raw SQL)
    và quản lý giao dịch mà không cần refactor toàn bộ hệ thống API/Services.

TỐI ƯU CHO SUPABASE POOLER (PgBouncer):
    - Supabase PgBouncer pooled mode (port 6543) hoạt động ở chế độ Transaction,
      không hỗ trợ Prepared Statements. Do đó, statement_cache_size và
      prepared_statement_cache_size được thiết lập bằng 0.
    - Sử dụng NullPool vì PgBouncer đã tự quản lý connection pool ở phía DB,
      giúp giải phóng kết nối ngay lập tức và tránh lỗi cạn kiệt pool của Supabase Free Tier (giới hạn 15-30).
"""

import contextvars
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)

# Quản lý connection và transaction mức Task-local bằng ContextVar
_connection_var = contextvars.ContextVar("db_connection", default=None)
_transaction_var = contextvars.ContextVar("db_transaction", default=None)


class DatabaseRow:
    """Đại diện cho một hàng kết quả truy vấn, hỗ trợ cả truy cập dạng chuỗi và chỉ mục."""
    def __init__(self, row, keys):
        self._row = row
        self._keys = list(keys)
        self._mapping = {k: v for k, v in zip(self._keys, row)}

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._row[key]
        return self._mapping[key]

    def __getattr__(self, name):
        if name in self._mapping:
            return self._mapping[name]
        raise AttributeError(f"'DatabaseRow' object has no attribute '{name}'")

    def keys(self):
        return self._keys

    def values(self):
        return self._mapping.values()

    def items(self):
        return self._mapping.items()

    def __contains__(self, key):
        return key in self._mapping

    def __len__(self):
        return len(self._row)

    def __iter__(self):
        return iter(self._row)

    def __repr__(self):
        return repr(self._mapping)


class TransactionContext:
    """Quản lý khối giao dịch lồng nhau hoặc mức cao nhất thông qua `async with database.transaction():`"""
    def __init__(self, db):
        self.db = db
        self.conn = None
        self.trans = None
        self.token_conn = None
        self.token_trans = None

    async def __aenter__(self):
        conn = _connection_var.get()
        if conn is None:
            # Giao dịch mức cao nhất (Top-level)
            self.conn = await self.db._engine.connect()
            self.trans = await self.conn.begin()
            self.token_conn = _connection_var.set(self.conn)
            self.token_trans = _transaction_var.set(self.trans)
        else:
            # Giao dịch lồng nhau (Nested Transaction / Savepoint)
            self.conn = conn
            self.trans = await conn.begin_nested()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                await self.trans.rollback()
                logger.warning("Giao dịch bị rollback do lỗi: %s", exc_val)
            else:
                await self.trans.commit()
        finally:
            if self.token_conn is not None:
                # Dọn dẹp connection sau khi hoàn thành giao dịch gốc
                _connection_var.reset(self.token_conn)
                _transaction_var.reset(self.token_trans)
                await self.conn.close()


class Database:
    """Lớp giả lập `databases.Database` dựa trên SQLAlchemy Async Engine."""
    def __init__(self, url: str, **kwargs):
        self.url = url
        self._engine = None

    async def connect(self):
        """Khởi tạo SQLAlchemy Engine."""
        if self._engine is not None:
            return

        async_url = self.url
        if async_url.startswith("postgresql://"):
            async_url = async_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif async_url.startswith("postgres://"):
            async_url = async_url.replace("postgres://", "postgresql+asyncpg://", 1)

        # Sử dụng NullPool tối ưu cho Supabase PgBouncer (Transaction mode)
        self._engine = create_async_engine(
            async_url,
            poolclass=NullPool,
            connect_args={
                "statement_cache_size": 0,
                "prepared_statement_cache_size": 0,
            },
            pool_pre_ping=True,
        )
        logger.info("Đã tạo SQLAlchemy engine thành công (NullPool, Cache size = 0)")

    async def disconnect(self):
        """Giải phóng các tài nguyên của Engine."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            logger.info("Đã đóng SQLAlchemy engine thành công")

    @property
    def is_connected(self) -> bool:
        return self._engine is not None

    async def _get_conn(self):
        """Lấy connection hiện tại từ context, hoặc tạo mới nếu ngoài giao dịch."""
        conn = _connection_var.get()
        if conn is not None:
            return conn, False
        return await self._engine.connect(), True

    async def execute(self, query: str, values: dict = None) -> int:
        conn, should_close = await self._get_conn()
        try:
            result = await conn.execute(text(query), values or {})
            if should_close:
                await conn.commit()
            return result.rowcount
        finally:
            if should_close:
                await conn.close()

    async def execute_many(self, query: str, values: list[dict]) -> int:
        conn, should_close = await self._get_conn()
        try:
            result = await conn.execute(text(query), values or [])
            if should_close:
                await conn.commit()
            return result.rowcount
        finally:
            if should_close:
                await conn.close()

    async def fetch_all(self, query: str, values: dict = None) -> list[DatabaseRow]:
        conn, should_close = await self._get_conn()
        try:
            result = await conn.execute(text(query), values or {})
            keys = result.keys()
            rows = result.all()
            return [DatabaseRow(row, keys) for row in rows]
        finally:
            if should_close:
                await conn.close()

    async def fetch_one(self, query: str, values: dict = None) -> DatabaseRow | None:
        conn, should_close = await self._get_conn()
        try:
            result = await conn.execute(text(query), values or {})
            keys = result.keys()
            row = result.first()
            return DatabaseRow(row, keys) if row else None
        finally:
            if should_close:
                await conn.close()

    async def fetch_val(self, query: str, values: dict = None, column: int = 0):
        conn, should_close = await self._get_conn()
        try:
            result = await conn.execute(text(query), values or {})
            row = result.first()
            return row[column] if row else None
        finally:
            if should_close:
                await conn.close()

    def transaction(self) -> TransactionContext:
        """Trả về context manager phục vụ khối giao dịch."""
        return TransactionContext(self)


# Thể hiện Database toàn cục tương thích với codebase hiện tại
database = Database(settings.DATABASE_URL)


async def connect_db():
    await database.connect()


async def disconnect_db():
    await database.disconnect()
