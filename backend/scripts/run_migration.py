import sys
import os
import asyncio
import hashlib
from datetime import datetime, timezone

# Thêm thư mục hiện tại vào sys.path để python nhận dạng được package 'app'
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import database, connect_db, disconnect_db


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


async def main() -> int:
    if len(sys.argv) < 2:
        print("Sử dụng: python run_migration.py <đường_dẫn_file_sql>")
        return 1

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Lỗi: Không tìm thấy tệp {filepath}")
        return 1
    migration_name = os.path.basename(filepath)

    print(f"Đang kết nối cơ sở dữ liệu...")
    await connect_db()
    
    try:
        await ensure_migration_table()
        print(f"Đọc tệp {filepath}...")
        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()
        checksum = file_checksum(sql)

        applied = await get_applied_migration(migration_name)
        if applied:
            if applied["checksum"] == checksum:
                print(f"⏭️ Migration '{migration_name}' đã được áp dụng trước đó lúc {applied['applied_at']}. Bỏ qua.")
                return 0
            print(f"❌ Migration '{migration_name}' đã tồn tại nhưng checksum khác. Dừng để tránh drift schema.")
            return 1

        statements = split_sql_statements(sql)

        print(f"Tìm thấy {len(statements)} câu lệnh SQL cần thực thi.")
        async with database.transaction():
            for i, stmt in enumerate(statements, 1):
                # Hiển thị log ngắn gọn
                print(f"👉 [{i}/{len(statements)}] Đang thực thi: {stmt.splitlines()[0][:70]}...")
                await database.execute(stmt)

            await database.execute(
                """
                INSERT INTO schema_migrations(filename, checksum, applied_at)
                VALUES (:filename, :checksum, :applied_at)
                """,
                {
                    "filename": migration_name,
                    "checksum": checksum,
                    "applied_at": datetime.now(timezone.utc),
                },
            )
            
        print("🎉 Thực thi migration thành công tốt đẹp!")
        return 0
    except Exception as e:
        print(f"❌ Lỗi khi thực thi SQL: {e}")
        return 1
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu an toàn.")

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
