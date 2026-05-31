import sys
import os
import asyncio

# Thêm thư mục hiện tại vào sys.path để python nhận dạng được package 'app'
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import database, connect_db, disconnect_db

async def main():
    if len(sys.argv) < 2:
        print("Sử dụng: python run_migration.py <đường_dẫn_file_sql>")
        return

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Lỗi: Không tìm thấy tệp {filepath}")
        return

    print(f"Đang kết nối cơ sở dữ liệu...")
    await connect_db()
    
    try:
        print(f"Đọc tệp {filepath}...")
        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()

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
        for i, stmt in enumerate(statements, 1):
            # Hiển thị log ngắn gọn
            print(f"👉 [{i}/{len(statements)}] Đang thực thi: {stmt.splitlines()[0][:70]}...")
            await database.execute(stmt)
            
        print("🎉 Thực thi migration thành công tốt đẹp!")
    except Exception as e:
        print(f"❌ Lỗi khi thực thi SQL: {e}")
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu an toàn.")

if __name__ == "__main__":
    asyncio.run(main())
