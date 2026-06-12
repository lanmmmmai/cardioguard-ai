"""Script kiểm tra kết nối database nhanh.

Chạy trong container:
    docker compose exec backend python scripts/test_db_connection.py
"""

import asyncio
import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import database


async def main():
    print("Đang kết nối database...")
    await database.connect()
    try:
        row = await database.fetch_one("SELECT 1 AS ok, NOW() AS server_time")
        print(f"Kết nối OK: {dict(row.items())}")

        version = await database.fetch_val("SELECT version()")
        print(f"PostgreSQL: {version}")
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối.")


if __name__ == "__main__":
    asyncio.run(main())
