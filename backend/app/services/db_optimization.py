import os
from app.core.database import database

async def ensure_performance_indexes() -> None:
    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "migrations",
        "008_optimize_performance_indexes.sql"
    )
    
    if not os.path.exists(migration_path):
        print(f"[Database Optimization] Migration file not found at {migration_path}")
        return

    print("[Database Optimization] Đang đồng bộ hóa các Index tối ưu hóa hiệu năng vào database...")
    try:
        with open(migration_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        # Tách các câu lệnh bằng dấu chấm phẩy
        statements = sql_content.split(";")
        executed_count = 0

        for statement in statements:
            # Tách dòng, lọc bỏ các dòng chú thích và dòng trống
            lines = statement.split("\n")
            clean_lines = [line.strip() for line in lines if line.strip() and not line.strip().startswith("--")]
            clean_stmt = " ".join(clean_lines).strip()
            
            # Bỏ qua dòng trống
            if not clean_stmt:
                continue
            
            # Thực thi từng câu lệnh tạo index
            await database.execute(clean_stmt)
            executed_count += 1

        print(f"[Database Optimization] Đã đồng bộ thành công {executed_count} Index tối ưu hóa hiệu năng!")
    except Exception as e:
        print(f"[Database Optimization] Gặp lỗi khi thiết lập các Index: {e}")
