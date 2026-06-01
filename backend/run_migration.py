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

async def main():
    if len(sys.argv) < 2:
        print("Sử dụng: python run_migration.py <đường_dẫn_file_sql>")
        return

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Lỗi: Không tìm thấy tệp {filepath}")
        return
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
                return
            print(f"❌ Migration '{migration_name}' đã tồn tại nhưng checksum khác. Dừng để tránh drift schema.")
            return

        # Loại bỏ các comment SQL dòng đơn (-- comment) và dòng nhiều dòng (/* comment */)
        # để tránh việc tách dấu chấm phẩy nhầm lẫn trong comment
        lines = []
        for line in sql.split("\n"):
            if line.strip().startswith("--"):
                continue
            lines.append(line)
        cleaned_sql = "\n".join(lines)

        # Tách các câu lệnh theo dấu chấm phẩy
        raw_statements = cleaned_sql.split(";")
        statements = []
        for stmt in raw_statements:
            cleaned = stmt.strip()
            if cleaned:
                statements.append(cleaned)

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
    except Exception as e:
        print(f"❌ Lỗi khi thực thi SQL: {e}")
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu an toàn.")

if __name__ == "__main__":
    asyncio.run(main())
