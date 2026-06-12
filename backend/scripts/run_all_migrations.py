"""Trình chạy tất cả các tệp SQL di chuyển (migration) theo thứ tự bảng chữ cái.

Mục đích:
  Tự động tìm kiếm tất cả các tệp di chuyển trong thư mục migrations/
  và thực thi chúng một cách tuần tự sử dụng cơ chế kiểm tra checksum của run_migration.py.
"""

import sys
import os
import asyncio
import hashlib
from datetime import datetime, timezone

# Đưa thư mục 'backend' vào sys.path để import gói 'app'
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import database, connect_db

MIGRATION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

async def ensure_migration_table() -> None:
    await database.execute(MIGRATION_TABLE_SQL)

def file_checksum(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

async def get_applied_migration(filename: str):
    return await database.fetch_one(
        "SELECT filename, checksum, applied_at FROM schema_migrations WHERE filename = :filename",
        {"filename": filename},
    )

def split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_single = False
    in_double = False
    in_line_comment = False
    in_block_comment = False
    dollar_tag: str | None = None

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
                buf.append(ch)
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch)
            i += 1
            continue

        if in_single:
            buf.append(ch)
            if ch == "'" and nxt == "'":
                buf.append(nxt)
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        if in_double:
            buf.append(ch)
            if ch == '"' and nxt == '"':
                buf.append(nxt)
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "-" and nxt == "-":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue

        if ch == '"':
            in_double = True
            buf.append(ch)
            i += 1
            continue

        if ch == "$":
            j = i + 1
            while j < n and (sql[j].isalnum() or sql[j] == "_"):
                j += 1
            if j < n and sql[j] == "$":
                tag = sql[i : j + 1]
                dollar_tag = tag
                buf.append(tag)
                i = j + 1
                continue

        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements

async def apply_migration_file(filepath: str, force: bool = False) -> bool:
    filename = os.path.basename(filepath)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()
        checksum = file_checksum(sql)

        applied = await get_applied_migration(filename)
        if applied:
            if applied["checksum"] == checksum:
                print(f"✅ Migration '{filename}' đã được áp dụng trước đó. Bỏ qua.")
                return True
            
            if force:
                print(f"⚠️ Migration '{filename}' đã tồn tại nhưng CHECKSUM KHÁC NHAU! Đang cập nhật checksum mới lên DB (--force)...")
                await database.execute(
                    "UPDATE schema_migrations SET checksum = :checksum WHERE filename = :filename",
                    {"filename": filename, "checksum": checksum}
                )
                print(f"✅ Đã cập nhật checksum mới cho '{filename}'.")
                return True
            else:
                print(f"❌ Migration '{filename}' đã tồn tại nhưng CHECKSUM KHÁC NHAU! Dừng để tránh drift schema.")
                print(f"💡 Mẹo: Chạy với tham số --force để tự động cập nhật checksum mới nếu cấu trúc DB thực tế đã khớp.")
                return False

        statements = split_sql_statements(sql)
        print(f"🚀 Đang chạy '{filename}' ({len(statements)} câu lệnh)...")
        
        has_concurrently = any("concurrently" in stmt.lower() for stmt in statements)
        
        if has_concurrently:
            print(f"⚠️ Phát hiện câu lệnh CONCURRENTLY. Thực thi ngoài transaction block...")
            for i, stmt in enumerate(statements, 1):
                await database.execute(stmt)
                
            await database.execute(
                """
                INSERT INTO schema_migrations(filename, checksum, applied_at)
                VALUES (:filename, :checksum, :applied_at)
                """,
                {
                    "filename": filename,
                    "checksum": checksum,
                    "applied_at": datetime.now(timezone.utc),
                },
            )
        else:
            async with database.transaction():
                for i, stmt in enumerate(statements, 1):
                    await database.execute(stmt)

                await database.execute(
                    """
                    INSERT INTO schema_migrations(filename, checksum, applied_at)
                    VALUES (:filename, :checksum, :applied_at)
                    """,
                    {
                        "filename": filename,
                        "checksum": checksum,
                        "applied_at": datetime.now(timezone.utc),
                    },
                )
        print(f"🎉 Đã áp dụng thành công '{filename}'!")
        return True
    except Exception as e:
        print(f"💥 Lỗi khi thực thi file '{filename}': {e}")
        return False

async def main():
    migrations_dir = os.path.join(backend_dir, "migrations")
    if not os.path.exists(migrations_dir):
        print(f"Lỗi: Thư mục migrations không tồn tại ở {migrations_dir}")
        sys.exit(1)

    # Tìm tất cả các file .sql
    files = [f for f in os.listdir(migrations_dir) if f.endswith(".sql")]
    # Sắp xếp theo tên để đảm bảo thứ tự chạy đúng (001, 002, ...)
    files.sort()

    print(f"Tìm thấy {len(files)} file migration trong thư mục {migrations_dir}")
    print("Đang kết nối cơ sở dữ liệu...")
    await connect_db()
    
    force = "--force" in sys.argv or "-f" in sys.argv
    try:
        await ensure_migration_table()
        
        success_count = 0
        skipped_count = 0
        
        for file in files:
            filepath = os.path.join(migrations_dir, file)
            # Kiểm tra xem file đã chạy chưa
            with open(filepath, "r", encoding="utf-8") as f:
                checksum = file_checksum(f.read())
            
            applied = await get_applied_migration(file)
            if applied and applied["checksum"] == checksum:
                skipped_count += 1
                continue
                
            success = await apply_migration_file(filepath, force=force)
            if not success:
                print("⛔ Dừng chạy migrations do có lỗi xảy ra.")
                sys.exit(1)
            success_count += 1
            
        print("\n====================================")
        print(f"Tổng kết: Đã áp dụng mới: {success_count}, Bỏ qua (đã chạy): {skipped_count}, Tổng số file: {len(files)}")
        print("Mọi migrations đã được xử lý thành công!")
        print("====================================")
        
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu.")

if __name__ == "__main__":
    asyncio.run(main())
