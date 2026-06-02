import os
import logging
from app.core.database import database

logger = logging.getLogger(__name__)


async def ensure_user_account_timestamps() -> None:
    """Keep account timestamps available and server-driven for admin screens."""
    logger.info("Synchronizing users account timestamp columns")
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW()",
        "UPDATE users SET created_at = NOW() WHERE created_at IS NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW()",
        "UPDATE users SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL",
        """
        CREATE OR REPLACE FUNCTION update_users_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """,
        "DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users",
        """
        CREATE TRIGGER trigger_update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_users_updated_at()
        """,
    ]

    try:
        for statement in statements:
            await database.execute(statement)
        logger.info("Users account timestamp columns synchronized")
    except Exception:
        logger.exception("Failed to synchronize users account timestamp columns")
        raise

async def ensure_performance_indexes() -> None:
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
