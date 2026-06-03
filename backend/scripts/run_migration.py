"""Trình chạy di chuyển cơ sở dữ liệu với tính chất không thay đổi và xác minh checksum.

Mục đích:
  Áp dụng các tệp SQL di chuyển vào cơ sở dữ liệu PostgreSQL đúng một lần.
  Theo dõi các lần di chuyển đã được áp dụng trong bảng ``schema_migrations`` với checksum
  SHA-256 để phát hiện sai lệch và ngăn chặn thực thi lại.

Luồng công việc:
  1. Chèn thư mục script vào ``sys.path`` và kết nối với cơ sở dữ liệu.
  2. Đảm bảo bảng theo dõi ``schema_migrations`` tồn tại.
  3. Đọc tệp SQL, tính toán checksum SHA-256 và kiểm tra xem
     lần di chuyển đã được áp dụng hay chưa.
     - Nếu đã áp dụng với cùng checksum → bỏ qua (không thay đổi).
     - Nếu đã áp dụng với checksum khác → hủy bỏ (bảo vệ sai lệch lược đồ).
  4. Chia SQL thô thành các câu lệnh riêng lẻ (nhận biết
     ký tự chuỗi, dollar-quoting và chú thích) và thực thi chúng bên trong
     một giao dịch DB duy nhất.
  5. Chèn một bản ghi vào ``schema_migrations`` khi thành công.

Quan hệ:
  - app.core.database — cung cấp động cơ cơ sở dữ liệu không đồng bộ (asyncpg).
  - Các tệp SQL di chuyển nằm trong ``backend/migrations/`` (theo quy ước).
"""

import sys
import os
import asyncio
import hashlib
from datetime import datetime, timezone

# Chèn thư mục cha để gói ``app`` có thể được giải quyết
# bất kể thư mục làm việc hiện tại.
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import database, connect_db, disconnect_db


# DDL để tạo bảng theo dõi di chuyển nếu nó chưa tồn tại.
MIGRATION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


async def ensure_migration_table() -> None:
    """Tạo ``schema_migrations`` nếu nó chưa tồn tại."""
    await database.execute(MIGRATION_TABLE_SQL)


def file_checksum(content: str) -> str:
    """Trả về thông báo SHA-256 hex của nội dung tệp.

    Args:
        content: Văn bản UTF-8 thô của tệp SQL.

    Trả về:
        Chuỗi hex 64 ký tự.
    """
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def get_applied_migration(filename: str):
    """Tìm nạp bản ghi di chuyển cho *filename* nếu nó tồn tại.

    Args:
        filename: Tên cơ sở của tệp SQL.

    Trả về:
        Một dict hàng với các khóa ``filename``, ``checksum``, ``applied_at``,
        hoặc ``None`` nếu chưa được áp dụng.
    """
    return await database.fetch_one(
        "SELECT filename, checksum, applied_at FROM schema_migrations WHERE filename = :filename",
        {"filename": filename},
    )


def split_sql_statements(sql: str) -> list[str]:
    """Chia một chuỗi SQL thành các câu lệnh riêng lẻ tại dấu chấm phẩy.

    Trình phân tích xử lý chính xác:
    - Chuỗi trong dấu nháy đơn với dấu nháy được thoát (``''``).
    - Định danh trong dấu nháy kép với dấu nháy được thoát (``""``).
    - Chú thích dòng SQL bắt đầu bằng ``--``.
    - Chú thích khối ``/* ... */``.
    - Dollar-quoting của PostgreSQL (``$tag$...$tag$``).

    Args:
        sql: Toàn bộ văn bản SQL.

    Trả về:
        Một danh sách các chuỗi câu lệnh (không rỗng, đã được cắt bỏ khoảng trắng).
    """
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_single = False      # Bên trong chuỗi trong dấu nháy đơn
    in_double = False      # Bên trong định danh trong dấu nháy kép
    in_line_comment = False
    in_block_comment = False
    dollar_tag: str | None = None  # Ví dụ: ``$func$``

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        # Chú thích dòng --
        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
                buf.append(ch)
            i += 1
            continue

        # Chú thích khối /* */
        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        # Bên trong khối dollar-quote — tìm thẻ đóng
        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch)
            i += 1
            continue

        # Chuỗi trong dấu nháy đơn: '' là dấu nháy được thoát
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

        # Định danh trong dấu nháy kép: "" là dấu nháy được thoát
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

        # Bắt đầu chú thích dòng
        if ch == "-" and nxt == "-":
            in_line_comment = True
            i += 2
            continue

        # Bắt đầu chú thích khối
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        # Vào chuỗi trong dấu nháy đơn
        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue

        # Vào định danh trong dấu nháy kép
        if ch == '"':
            in_double = True
            buf.append(ch)
            i += 1
            continue

        # Phát hiện mở dollar-quote, ví dụ: $func$
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

        # Dấu chấm phẩy bên ngoài bất kỳ chuỗi/chú thích nào → ranh giới câu lệnh
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    # Xả bộ đệm còn lại sau dấu chấm phẩy cuối cùng (hoặc nếu không có)
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


async def main() -> int:
    """Chạy di chuyển: kết nối, xác minh, chia, thực thi và ghi lại.

    Cách sử dụng:
        python run_migration.py <đường_dẫn_đến_tệp_sql>

    Trả về:
        0 khi thành công, 1 khi có lỗi.
    """
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
                print(f"Migration '{migration_name}' đã được áp dụng trước đó lúc {applied['applied_at']}. Bỏ qua.")
                return 0
            print(f"Migration '{migration_name}' đã tồn tại nhưng checksum khác. Dừng để tránh drift schema.")
            return 1

        statements = split_sql_statements(sql)

        print(f"Tìm thấy {len(statements)} câu lệnh SQL cần thực thi.")
        async with database.transaction():
            for i, stmt in enumerate(statements, 1):
                # Ghi nhật ký dòng đầu tiên đã cắt làm chỉ báo tiến trình
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
            
        print("Thực thi migration thành công tốt đẹp!")
        return 0
    except Exception as e:
        print(f"Lỗi khi thực thi SQL: {e}")
        return 1
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu an toàn.")

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
