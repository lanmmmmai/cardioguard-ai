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


async def ensure_profile_schema() -> None:
    """Ensure role profile tables/columns exist before profile update flows run."""
    logger.info("Synchronizing role profile schema")
    try:
        await database.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    except Exception:
        logger.warning("Could not ensure pgcrypto extension; continuing if gen_random_uuid is available", exc_info=True)

    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        """
        CREATE TABLE IF NOT EXISTS patients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            full_name TEXT,
            age INTEGER,
            gender TEXT,
            phone TEXT,
            address TEXT,
            medical_history TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name TEXT",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INTEGER",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id)",
        """
        CREATE TABLE IF NOT EXISTS doctor_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            full_name TEXT,
            phone TEXT,
            gender TEXT,
            date_of_birth DATE,
            address TEXT,
            specialty TEXT,
            position TEXT,
            workplace TEXT,
            experience_years INTEGER,
            license_number TEXT,
            license_issued_date DATE,
            license_issued_by TEXT,
            license_certificate_url TEXT,
            cccd_front_url TEXT,
            cccd_back_url TEXT,
            avatar_url TEXT,
            is_verified BOOLEAN DEFAULT FALSE,
            verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
            verified_at TIMESTAMPTZ,
            verification_note TEXT,
            status TEXT DEFAULT 'pending_profile',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS patient_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            full_name TEXT,
            phone TEXT,
            gender TEXT,
            date_of_birth DATE,
            address TEXT,
            blood_type TEXT,
            medical_history TEXT,
            allergies TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            avatar_url TEXT,
            profile_completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS full_name TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS gender TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS specialty TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS position TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS workplace TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS license_number TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS license_issued_date DATE",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS license_issued_by TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS license_certificate_url TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS cccd_front_url TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS cccd_back_url TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS verification_note TEXT",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_profile'",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS full_name TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS gender TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS blood_type TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS medical_history TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS allergies TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id ON doctor_profiles(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id)",
        """
        CREATE OR REPLACE FUNCTION update_profile_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """,
        "DROP TRIGGER IF EXISTS trigger_update_doctor_profiles_updated_at ON doctor_profiles",
        """
        CREATE TRIGGER trigger_update_doctor_profiles_updated_at
        BEFORE UPDATE ON doctor_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_profile_updated_at()
        """,
        "DROP TRIGGER IF EXISTS trigger_update_patient_profiles_updated_at ON patient_profiles",
        """
        CREATE TRIGGER trigger_update_patient_profiles_updated_at
        BEFORE UPDATE ON patient_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_profile_updated_at()
        """,
    ]

    try:
        for statement in statements:
            await database.execute(statement)
        logger.info("Role profile schema synchronized")
    except Exception:
        logger.exception("Failed to synchronize role profile schema")
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
