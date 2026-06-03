"""Dịch vụ đồng bộ hóa chỉ mục cơ sở dữ liệu cho CardioGuard.

Mục đích:
    Đọc một tệp SQL di chuyển (008_optimize_performance_indexes.sql), phân tích ra
    các câu lệnh CREATE INDEX riêng lẻ và thực thi từng câu lệnh với cơ sở dữ liệu.
    Điều này đảm bảo tất cả các chỉ mục quan trọng về hiệu suất tồn tại mà không yêu cầu chạy
    di chuyển đầy đủ.

Luồng công việc:
    ensure_performance_indexes() định vị tệp SQL tương đối với thư mục gốc của gói
    phần mềm, chia nội dung trên dấu chấm phẩy, loại bỏ các dòng chú thích và
    khoảng trắng, sau đó thực thi từng câu lệnh không rỗng một cách tuần tự.

Quan hệ:
    - app.core.database.database: Được sử dụng để thực thi các câu lệnh SQL thô.
    - Tệp di chuyển nằm dưới backend/migrations/ và được kiểm soát phiên bản.
    - Thường được gọi trong khi khởi động ứng dụng hoặc như một phần của tác vụ bảo trì.
"""

import os
import logging
from app.core.database import database

logger = logging.getLogger(__name__)

async def ensure_performance_indexes() -> None:
    """Đồng bộ hóa các chỉ mục hiệu suất cơ sở dữ liệu từ tệp SQL di chuyển.

    Đọc file di chuyển 008_optimize_performance_indexes.sql, trích xuất mọi
    câu lệnh không phải chú thích, không trống và thực thi nó. Điều này đảm bảo rằng
    các chỉ mục được sử dụng bởi các truy vấn tần suất cao (ví dụ: trên sensor_data, alerts và
    audit_logs) tồn tại ngay cả khi quá trình di chuyển chưa được chạy trong một khung
    di chuyển truyền thống.

    Ngoại lệ:
        Không có ngoại lệ nào được truyền lên; các lỗi được ghi nhật ký và hàm
        trả về một cách im lặng.
    """
    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "migrations",
        "008_optimize_performance_indexes.sql"
    )
    
    if not os.path.exists(migration_path):
        logger.warning("Performance index migration file not found: %s", migration_path)
        return

    logger.info("Synchronizing performance indexes")
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

        logger.info("Performance indexes synchronized: count=%s", executed_count)
    except Exception as e:
        logger.exception("Failed to synchronize performance indexes")
