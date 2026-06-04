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
import json
import logging
from app.core.database import database

logger = logging.getLogger(__name__)


async def ensure_user_account_timestamps() -> None:
    """Keep account timestamps available and server-driven for admin screens."""
    existing = await database.fetch_val(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at' AND column_default IS NOT NULL)"
    )
    if existing:
        logger.info("Users account timestamp columns already exist, skipping DDL")
        return
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
    existing = await database.fetch_val(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='doctor_profiles')"
    )
    if existing:
        logger.info("Role profile schema already exists, skipping DDL")
        return
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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT",
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


async def ensure_email_cms_schema() -> None:
    """Ensure the email CMS schema supports cms_email_id/email_type lookups."""
    existing = await database.fetch_val(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cms_email_functions')"
    )
    if existing:
        logger.info("Email CMS schema already exists, skipping DDL")
        return
    logger.info("Synchronizing email CMS schema")
    try:
        await database.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    except Exception:
        logger.warning("Could not ensure pgcrypto extension for email CMS schema", exc_info=True)

    statements = [
        """
        CREATE TABLE IF NOT EXISTS cms_email_functions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email_type TEXT NOT NULL,
            cms_email_id TEXT NOT NULL,
            name TEXT NOT NULL,
            group_key TEXT NOT NULL DEFAULT 'custom',
            target_role TEXT NOT NULL DEFAULT 'all',
            description TEXT DEFAULT '',
            required_variables JSONB DEFAULT '[]'::jsonb,
            optional_variables JSONB DEFAULT '[]'::jsonb,
            is_system BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS email_type TEXT",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS cms_email_id TEXT",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS name TEXT",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS group_key TEXT DEFAULT 'custom'",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'all'",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS required_variables JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS optional_variables JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE",
        "ALTER TABLE cms_email_functions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
        """
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name='cms_email_functions' AND column_name='default_cms_email_id'
            ) THEN 
                ALTER TABLE cms_email_functions ALTER COLUMN default_cms_email_id DROP NOT NULL;
            END IF; 
        END $$;
        """,
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS function_id UUID REFERENCES cms_email_functions(id) ON DELETE SET NULL",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'all'",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS sample_variables JSONB DEFAULT '{}'::jsonb",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS cms_email_id TEXT",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS email_type TEXT",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS text_content TEXT DEFAULT ''",
        "ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb",
        "UPDATE email_templates SET target_role = COALESCE(NULLIF(target_role, ''), 'all')",
        "UPDATE email_templates SET email_type = COALESCE(NULLIF(email_type, ''), NULLIF(type, '')) WHERE email_type IS NULL OR email_type = ''",
        """
        UPDATE email_templates
        SET cms_email_id = CASE
            WHEN cms_email_id IS NOT NULL AND cms_email_id <> '' THEN cms_email_id
            ELSE 'EMAIL_' || upper(regexp_replace(COALESCE(NULLIF(email_type, ''), NULLIF(type, ''), 'CUSTOM'), '[^A-Za-z0-9]+', '_', 'g'))
        END
        WHERE cms_email_id IS NULL OR cms_email_id = ''
        """,
        """
        UPDATE email_templates
        SET cms_email_id = cms_email_id || '_' || id::text
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY cms_email_id ORDER BY updated_at DESC) as rn
                FROM email_templates
            ) t WHERE t.rn > 1
        )
        """,
        "ALTER TABLE email_templates ALTER COLUMN html_content SET DEFAULT ''",
        "ALTER TABLE email_templates ALTER COLUMN text_content SET DEFAULT ''",
        "ALTER TABLE email_templates ALTER COLUMN variables SET DEFAULT '[]'::jsonb",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_cms_email_id ON email_templates(cms_email_id)",
        "CREATE INDEX IF NOT EXISTS idx_email_templates_email_type_active ON email_templates(email_type, is_active DESC, updated_at DESC)",
        """
        CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """,
        "DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates",
        """
        CREATE TRIGGER trg_email_templates_updated_at
        BEFORE UPDATE ON email_templates
        FOR EACH ROW
        EXECUTE FUNCTION update_email_templates_updated_at()
        """,
    ]

    try:
        for statement in statements:
            await database.execute(statement)
    except Exception:
        logger.exception("Failed to synchronize email CMS schema")
        raise


async def ensure_domain_links_schema() -> None:
    """Ensure domain_links supports preview routing, soft delete and public SEO images."""
    existing = await database.fetch_val(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='domain_links' AND column_name='path')"
    )
    if existing:
        logger.info("Domain_links schema already exists, skipping DDL")
        return
    logger.info("Synchronizing domain_links schema")
    try:
        await database.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    except Exception:
        logger.warning("Could not ensure pgcrypto extension for domain_links schema", exc_info=True)

    statements = [
        "ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS path TEXT DEFAULT ''",
        "ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
        "ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
        "ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS cache_version INTEGER DEFAULT 1",
        "ALTER TABLE domain_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "UPDATE domain_links SET path = COALESCE(path, '') WHERE path IS NULL",
        """
        UPDATE domain_links
        SET path = CASE
            WHEN path IS NOT NULL AND BTRIM(path) <> '' THEN path
            WHEN url IS NOT NULL AND POSITION('://' IN url) > 0 THEN
                '/' || REGEXP_REPLACE(SPLIT_PART(url, '://', 2), '^([^/]+)', '')
            ELSE path
        END
        WHERE path IS NULL OR BTRIM(path) = ''
        """,
        "UPDATE domain_links SET is_active = COALESCE(is_active, TRUE)",
        "UPDATE domain_links SET cache_version = COALESCE(cache_version, 1)",
        """
        CREATE OR REPLACE FUNCTION update_domain_links_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """,
        "DROP TRIGGER IF EXISTS trg_domain_links_updated_at ON domain_links",
        """
        CREATE TRIGGER trg_domain_links_updated_at
        BEFORE UPDATE ON domain_links
        FOR EACH ROW
        EXECUTE FUNCTION update_domain_links_updated_at()
        """,
        """
        UPDATE domain_links
        SET path = '/' || LTRIM(path, '/')
        WHERE path IS NOT NULL AND BTRIM(path) <> ''
        """,
        """
        UPDATE domain_links
        SET deleted_at = NOW()
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(path) ORDER BY updated_at DESC) as rn
                FROM domain_links
                WHERE deleted_at IS NULL AND BTRIM(path) <> ''
            ) t WHERE t.rn > 1
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_links_path_unique ON domain_links (LOWER(path)) WHERE deleted_at IS NULL AND BTRIM(path) <> ''",
        "CREATE INDEX IF NOT EXISTS idx_domain_links_is_active ON domain_links (is_active)",
        "CREATE INDEX IF NOT EXISTS idx_domain_links_deleted_at ON domain_links (deleted_at)",
    ]

    try:
        for statement in statements:
            await database.execute(statement)
        logger.info("domain_links schema synchronized")
    except Exception:
        logger.exception("Failed to synchronize domain_links schema")
        raise

    default_functions = [
        {"email_type": "otp_register", "cms_email_id": "EMAIL_OTP_REGISTER", "name": "OTP Đăng ký", "group_key": "auth", "target_role": "patient", "description": "Gửi OTP khi đăng ký tài khoản bệnh nhân.", "required_variables": ["full_name", "otp"], "optional_variables": ["hospital_name", "current_date"], "is_system": True},
        {"email_type": "otp_login", "cms_email_id": "EMAIL_OTP_LOGIN", "name": "OTP Đăng nhập", "group_key": "auth", "target_role": "all", "description": "Gửi OTP khi đăng nhập.", "required_variables": ["full_name", "otp"], "optional_variables": ["hospital_name", "current_date"], "is_system": True},
        {"email_type": "welcome", "cms_email_id": "EMAIL_WELCOME", "name": "Welcome Email", "group_key": "auth", "target_role": "all", "description": "Chào mừng tài khoản mới.", "required_variables": ["full_name", "role_label"], "optional_variables": ["login_url", "login_button_text"], "is_system": True},
        {"email_type": "reset_password", "cms_email_id": "EMAIL_RESET_PASSWORD", "name": "Đặt lại mật khẩu", "group_key": "auth", "target_role": "all", "description": "Gửi mật khẩu tạm thời hoặc link đặt lại.", "required_variables": ["full_name", "otp"], "optional_variables": [], "is_system": True},
        {"email_type": "emergency_alert", "cms_email_id": "EMAIL_EMERGENCY_ALERT", "name": "Cảnh báo khẩn cấp", "group_key": "health", "target_role": "doctor", "description": "Cảnh báo chỉ số bất thường khẩn cấp.", "required_variables": ["full_name", "alert_message"], "optional_variables": ["heart_rate", "spo2"], "is_system": True},
        {"email_type": "appointment_reminder", "cms_email_id": "EMAIL_APPOINTMENT_REMINDER", "name": "Nhắc lịch hẹn", "group_key": "appointment", "target_role": "all", "description": "Nhắc lịch tái khám.", "required_variables": ["full_name", "appointment_date"], "optional_variables": ["doctor_name"], "is_system": True},
        {"email_type": "doctor_assignment", "cms_email_id": "EMAIL_DOCTOR_ASSIGNMENT", "name": "Phân công bác sĩ", "group_key": "appointment", "target_role": "all", "description": "Thông báo bác sĩ phụ trách.", "required_variables": ["full_name", "doctor_name"], "optional_variables": [], "is_system": True},
        {"email_type": "health_alert", "cms_email_id": "EMAIL_HEALTH_ALERT", "name": "Cảnh báo sức khỏe", "group_key": "health", "target_role": "patient", "description": "Cảnh báo sức khỏe theo dõi định kỳ.", "required_variables": ["full_name", "alert_message"], "optional_variables": [], "is_system": True},
        {"email_type": "monthly_report", "cms_email_id": "EMAIL_MONTHLY_REPORT", "name": "Báo cáo tháng", "group_key": "report", "target_role": "all", "description": "Báo cáo sức khỏe tháng.", "required_variables": ["full_name", "current_date"], "optional_variables": [], "is_system": True},
        {"email_type": "doctor_pending_verification", "cms_email_id": "EMAIL_DOCTOR_PENDING_VERIFICATION", "name": "Bác sĩ chờ duyệt", "group_key": "account", "target_role": "doctor", "description": "Thông báo hồ sơ đang chờ xác thực.", "required_variables": ["full_name"], "optional_variables": [], "is_system": True},
        {"email_type": "doctor_verified", "cms_email_id": "EMAIL_DOCTOR_VERIFIED", "name": "Bác sĩ đã xác thực", "group_key": "account", "target_role": "doctor", "description": "Thông báo hồ sơ bác sĩ đã được xác thực.", "required_variables": ["full_name"], "optional_variables": ["login_url", "login_button_text"], "is_system": True},
        {"email_type": "doctor_rejected", "cms_email_id": "EMAIL_DOCTOR_REJECTED", "name": "Bác sĩ bị từ chối", "group_key": "account", "target_role": "doctor", "description": "Thông báo hồ sơ bị từ chối.", "required_variables": ["full_name", "verification_note"], "optional_variables": [], "is_system": True},
        {"email_type": "doctor_need_update", "cms_email_id": "EMAIL_DOCTOR_NEED_UPDATE", "name": "Bác sĩ cần bổ sung hồ sơ", "group_key": "doctor_account", "target_role": "doctor", "description": "Yêu cầu bổ sung hồ sơ bác sĩ.", "required_variables": ["full_name", "verification_note"], "optional_variables": ["update_profile_url", "support_email"], "is_system": True},
        {"email_type": "doctor_verified_success", "cms_email_id": "EMAIL_DOCTOR_VERIFIED", "name": "Bác sĩ đã được xác thực", "group_key": "account", "target_role": "doctor", "description": "Alias xác thực thành công.", "required_variables": ["full_name"], "optional_variables": ["login_url", "login_button_text"], "is_system": True},
        {"email_type": "doctor_verified_rejected", "cms_email_id": "EMAIL_DOCTOR_REJECTED", "name": "Bác sĩ bị từ chối xác thực", "group_key": "account", "target_role": "doctor", "description": "Alias từ chối xác thực.", "required_variables": ["full_name", "verification_note"], "optional_variables": [], "is_system": True},
        {"email_type": "doctor_profile_require_update", "cms_email_id": "EMAIL_DOCTOR_NEED_UPDATE", "name": "Bác sĩ cần bổ sung hồ sơ", "group_key": "doctor_account", "target_role": "doctor", "description": "Gửi email yêu cầu bác sĩ bổ sung hồ sơ.", "required_variables": ["full_name", "verification_note"], "optional_variables": ["update_profile_url", "support_email"], "is_system": True},
    ]

    try:
        for function in default_functions:
            await database.execute(
                """
                INSERT INTO cms_email_functions (
                    email_type, cms_email_id, name, group_key, target_role, description,
                    required_variables, optional_variables, is_system, is_active
                )
                VALUES (
                    :email_type, :cms_email_id, :name, :group_key, :target_role, :description,
                    CAST(:required_variables AS jsonb), CAST(:optional_variables AS jsonb), :is_system, TRUE
                )
                ON CONFLICT (email_type) DO NOTHING
                """,
                {
                    "email_type": function["email_type"],
                    "cms_email_id": function["cms_email_id"],
                    "name": function["name"],
                    "group_key": function["group_key"],
                    "target_role": function["target_role"],
                    "description": function["description"],
                    "required_variables": json.dumps(function["required_variables"]),
                    "optional_variables": json.dumps(function["optional_variables"]),
                    "is_system": function["is_system"],
                },
            )
    except Exception:
        logger.exception("Failed to seed default email functions")
        raise

    default_templates = [
        {
            "cms_email_id": "EMAIL_OTP_REGISTER",
            "email_type": "otp_register",
            "name": "OTP Đăng ký",
            "subject": "CardioGuard AI - Mã OTP đăng ký của bạn",
            "text_content": "Xin chào {{full_name}},\nMã OTP đăng ký tài khoản của bạn là {{otp}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Mã OTP đăng ký tài khoản của bạn là:</p>
                  <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#e11d48">{{otp}}</div>
                  <p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                  <p style="color:#9ca3af;font-size:12px">CardioGuard AI — {{hospital_name}}</p>
                </div>
            """,
            "variables": ["full_name", "otp", "hospital_name", "current_date"],
        },
        {
            "cms_email_id": "EMAIL_OTP_LOGIN",
            "email_type": "otp_login",
            "name": "OTP Đăng nhập",
            "subject": "CardioGuard AI - Mã OTP đăng nhập của bạn",
            "text_content": "Xin chào {{full_name}},\nMã OTP đăng nhập của bạn là {{otp}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Mã OTP đăng nhập của bạn là:</p>
                  <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;padding:24px 0;color:#0f766e">{{otp}}</div>
                  <p style="color:#6b7280;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>.</p>
                </div>
            """,
            "variables": ["full_name", "otp", "hospital_name", "current_date"],
        },
        {
            "cms_email_id": "EMAIL_WELCOME",
            "email_type": "welcome",
            "name": "Welcome Email",
            "subject": "Chào mừng {{full_name}} đến với CardioGuard AI",
            "text_content": "Xin chào {{full_name}}, chào mừng bạn đến với CardioGuard AI.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Tài khoản của bạn đã được kích hoạt thành công. Bạn có thể đăng nhập và bắt đầu sử dụng hệ thống.</p>
                  <p style="color:#374151">Vai trò của bạn: <strong>{{role_label}}</strong></p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
                    <tr>
                      <td align="center">
                        <a href="{{login_url}}" style="display:inline-block;background:#1183C6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 34px;border-radius:999px;">{{login_button_text}}</a>
                      </td>
                    </tr>
                  </table>
                </div>
            """,
            "variables": ["full_name", "role_label", "login_url", "login_button_text"],
        },
        {
            "cms_email_id": "EMAIL_RESET_PASSWORD",
            "email_type": "reset_password",
            "name": "Đặt lại mật khẩu",
            "subject": "CardioGuard AI - Mật khẩu mới của bạn",
            "text_content": "Xin chào {{full_name}}, mật khẩu mới của bạn là {{otp}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Mật khẩu tạm thời của bạn là:</p>
                  <div style="font-size:24px;font-weight:700;text-align:center;padding:24px 0;color:#e11d48;letter-spacing:4px">{{otp}}</div>
                  <p style="color:#6b7280;font-size:13px">Vui lòng đăng nhập và đổi mật khẩu ngay sau khi đăng nhập thành công.</p>
                </div>
            """,
            "variables": ["full_name", "otp"],
        },
        {
            "cms_email_id": "EMAIL_EMERGENCY_ALERT",
            "email_type": "emergency_alert",
            "name": "Cảnh báo khẩn cấp",
            "subject": "CardioGuard AI - CẢNH BÁO: Chỉ số bất thường",
            "text_content": "Bệnh nhân {{full_name}} có cảnh báo sức khỏe: {{alert_message}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:2px solid #e11d48;border-radius:12px">
                  <h2 style="color:#e11d48;margin-bottom:8px">⚠️ CẢNH BÁO SỨC KHỎE</h2>
                  <p style="color:#374151">Bệnh nhân <strong>{{full_name}}</strong> có chỉ số bất thường:</p>
                  <p style="color:#374151;padding:12px;background:#fef2f2;border-radius:8px;font-size:14px"><strong>Thông báo:</strong> {{alert_message}}</p>
                </div>
            """,
            "variables": ["full_name", "alert_message", "heart_rate", "spo2"],
        },
        {
            "cms_email_id": "EMAIL_APPOINTMENT_REMINDER",
            "email_type": "appointment_reminder",
            "name": "Nhắc lịch hẹn",
            "subject": "CardioGuard AI - Nhắc lịch hẹn khám",
            "text_content": "Xin chào {{full_name}}, bạn có lịch hẹn vào {{appointment_date}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Bạn có lịch hẹn khám vào <strong>{{appointment_date}}</strong>.</p>
                </div>
            """,
            "variables": ["full_name", "appointment_date", "doctor_name"],
        },
        {
            "cms_email_id": "EMAIL_DOCTOR_ASSIGNMENT",
            "email_type": "doctor_assignment",
            "name": "Phân công bác sĩ",
            "subject": "CardioGuard AI - Bạn đã được phân công bác sĩ",
            "text_content": "Xin chào {{full_name}}, bác sĩ phụ trách của bạn là {{doctor_name}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Bác sĩ phụ trách của bạn là <strong>{{doctor_name}}</strong>.</p>
                </div>
            """,
            "variables": ["full_name", "doctor_name"],
        },
        {
            "cms_email_id": "EMAIL_HEALTH_ALERT",
            "email_type": "health_alert",
            "name": "Cảnh báo sức khỏe",
            "subject": "CardioGuard AI - Cảnh báo sức khỏe",
            "text_content": "Xin chào {{full_name}}, {{alert_message}}",
            "html_content": """
                <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#d97706;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">{{alert_message}}</p>
                </div>
            """,
            "variables": ["full_name", "alert_message"],
        },
        {
            "cms_email_id": "EMAIL_MONTHLY_REPORT",
            "email_type": "monthly_report",
            "name": "Báo cáo tháng",
            "subject": "CardioGuard AI - Báo cáo sức khỏe tháng",
            "text_content": "Xin chào {{full_name}}, đây là báo cáo tháng của bạn.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Đây là báo cáo sức khỏe tháng của bạn.</p>
                </div>
            """,
            "variables": ["full_name", "current_date"],
        },
        {
            "cms_email_id": "EMAIL_DOCTOR_PENDING_VERIFICATION",
            "email_type": "doctor_pending_verification",
            "name": "Bác sĩ chờ duyệt",
            "subject": "CardioGuard AI - Hồ sơ bác sĩ đang chờ phê duyệt",
            "text_content": "Xin chào {{full_name}}, hồ sơ của bạn đang chờ phê duyệt.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào Bác sĩ <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Hồ sơ bác sĩ của bạn đã được ghi nhận và đang chờ quản trị viên xác thực.</p>
                </div>
            """,
            "variables": ["full_name", "hospital_name"],
        },
        {
            "cms_email_id": "EMAIL_DOCTOR_VERIFIED",
            "email_type": "doctor_verified",
            "name": "Bác sĩ đã xác thực",
            "subject": "CardioGuard AI - Tài khoản bác sĩ đã được xác thực",
            "text_content": "Xin chào {{full_name}}, tài khoản của bạn đã được xác thực.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#0f766e;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào Bác sĩ <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Tài khoản bác sĩ của bạn đã được xác thực và có thể sử dụng hệ thống CardioGuard AI.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
                    <tr>
                      <td align="center">
                        <a href="{{login_url}}" style="display:inline-block;background:#1183C6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 34px;border-radius:999px;">{{login_button_text}}</a>
                      </td>
                    </tr>
                  </table>
                </div>
            """,
            "variables": ["full_name", "login_url", "login_button_text"],
        },
        {
            "cms_email_id": "EMAIL_DOCTOR_REJECTED",
            "email_type": "doctor_rejected",
            "name": "Bác sĩ bị từ chối",
            "subject": "CardioGuard AI - Hồ sơ bác sĩ chưa được phê duyệt",
            "text_content": "Xin chào {{full_name}}, hồ sơ của bạn chưa được phê duyệt: {{verification_note}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào Bác sĩ <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Hồ sơ bác sĩ của bạn chưa được phê duyệt.</p>
                  <p style="color:#374151;padding:12px;background-color:#fef2f2;border-left:4px solid #ef4444;margin:16px 0">
                    <strong>Lý do:</strong> {{verification_note}}
                  </p>
                </div>
            """,
            "variables": ["full_name", "verification_note"],
        },
        {
            "cms_email_id": "EMAIL_DOCTOR_NEED_UPDATE",
            "email_type": "doctor_need_update",
            "name": "Bác sĩ cần bổ sung",
            "subject": "CardioGuard AI - Yêu cầu bổ sung hồ sơ bác sĩ",
            "text_content": "Xin chào {{full_name}}, vui lòng cập nhật hồ sơ: {{verification_note}}.",
            "html_content": """
                <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
                  <h2 style="color:#d97706;margin-bottom:8px">CardioGuard AI</h2>
                  <p style="color:#374151">Xin chào Bác sĩ <strong>{{full_name}}</strong>,</p>
                  <p style="color:#374151">Hồ sơ bác sĩ cần bổ sung thông tin.</p>
                  <p style="color:#374151;padding:12px;background-color:#fffbeb;border-left:4px solid #f59e0b;margin:16px 0">
                    <strong>Nội dung cần bổ sung:</strong> {{verification_note}}
                  </p>
                </div>
            """,
            "variables": ["full_name", "verification_note", "login_url", "login_button_text"],
        },
    ]

    try:
        for template in default_templates:
            function_row = await database.fetch_one(
                "SELECT id, target_role FROM cms_email_functions WHERE lower(email_type) = lower(:email_type) LIMIT 1",
                {"email_type": template["email_type"]},
            )
            function_id = str(function_row["id"]) if function_row else None
            template_target_role = str(function_row["target_role"]) if function_row and function_row["target_role"] else "all"
            await database.execute(
                """
                INSERT INTO email_templates (
                    function_id, target_role, cms_email_id, email_type, name, subject, html_content, text_content, variables, type, is_active
                )
                VALUES (
                    :function_id, :target_role, :cms_email_id, :email_type, :name, :subject, :html_content, :text_content, CAST(:variables AS jsonb), :type, TRUE
                )
                ON CONFLICT (cms_email_id) DO NOTHING
                """,
                {
                    "function_id": function_id,
                    "target_role": template_target_role,
                    "cms_email_id": template["cms_email_id"],
                    "email_type": template["email_type"],
                    "name": template["name"],
                    "subject": template["subject"],
                    "html_content": template["html_content"].strip(),
                    "text_content": template["text_content"].strip(),
                    "variables": json.dumps(template["variables"]),
                    "type": template["email_type"],
                },
            )
    except Exception:
        logger.exception("Failed to seed default email CMS templates")
        raise


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
