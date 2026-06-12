"""seed_domain_links: upsert chuẩn dữ liệu domain_links cho tất cả các route

Revision ID: a1b2c3d4e5f6
Revises: 7cbaf1cd4afc
Create Date: 2026-06-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7cbaf1cd4afc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DOMAIN_LINKS = [
    # Patient
    {
        'page_path': '/login',
        'role': 'patient',
        'title': 'CardioGuard AI - Đăng nhập bệnh nhân',
        'description': 'Đăng nhập để theo dõi sức khỏe tim mạch, lịch hẹn khám, cảnh báo sức khỏe và báo cáo cá nhân.',
        'target_url': 'https://giatky.site/login',
        'url': 'https://giatky.site/login',
        'og_type': 'website',
        'status': 'active',
    },
    {
        'page_path': '/register',
        'role': 'patient',
        'title': 'CardioGuard AI - Đăng ký bệnh nhân',
        'description': 'Tạo tài khoản bệnh nhân để theo dõi sức khỏe tim mạch thông minh cùng CardioGuard AI.',
        'target_url': 'https://giatky.site/register',
        'url': 'https://giatky.site/register',
        'og_type': 'website',
        'status': 'active',
    },
    # Doctor
    {
        'page_path': '/login-doctor',
        'role': 'doctor',
        'title': 'CardioGuard AI - Đăng nhập bác sĩ',
        'description': 'Cổng đăng nhập dành cho bác sĩ quản lý bệnh nhân, lịch hẹn, bệnh án và cảnh báo sức khỏe.',
        'target_url': 'https://giatky.site/login-doctor',
        'url': 'https://giatky.site/login-doctor',
        'og_type': 'website',
        'status': 'active',
    },
    {
        'page_path': '/register-doctor',
        'role': 'doctor',
        'title': 'CardioGuard AI - Đăng ký bác sĩ',
        'description': 'Đăng ký tài khoản bác sĩ, cập nhật chứng chỉ hành nghề và chờ admin xác thực hồ sơ.',
        'target_url': 'https://giatky.site/register-doctor',
        'url': 'https://giatky.site/register-doctor',
        'og_type': 'website',
        'status': 'active',
    },
    # Admin
    {
        'page_path': '/login-admin',
        'role': 'admin',
        'title': 'CardioGuard AI - Đăng nhập quản trị viên',
        'description': 'Cổng quản trị hệ thống CardioGuard AI dành cho admin quản lý người dùng, bác sĩ, dữ liệu và cấu hình hệ thống.',
        'target_url': 'https://giatky.site/login-admin',
        'url': 'https://giatky.site/login-admin',
        'og_type': 'website',
        'status': 'active',
    },
    # Public
    {
        'page_path': '/',
        'role': 'public',
        'title': 'CardioGuard AI - Nền tảng AIoT theo dõi sức khỏe tim mạch',
        'description': 'CardioGuard AI hỗ trợ theo dõi sức khỏe tim mạch, cảnh báo bất thường, kết nối thiết bị IoT và tư vấn y tế thông minh.',
        'target_url': 'https://giatky.site/',
        'url': 'https://giatky.site/',
        'og_type': 'website',
        'status': 'active',
    },
    {
        'page_path': '/privacy-policy',
        'role': 'public',
        'title': 'CardioGuard AI - Chính sách quyền riêng tư',
        'description': 'Tìm hiểu cách CardioGuard AI thu thập, bảo vệ và sử dụng dữ liệu sức khỏe cá nhân của người dùng.',
        'target_url': 'https://giatky.site/privacy-policy',
        'url': 'https://giatky.site/privacy-policy',
        'og_type': 'website',
        'status': 'active',
    },
    {
        'page_path': '/terms-of-service',
        'role': 'public',
        'title': 'CardioGuard AI - Điều khoản dịch vụ',
        'description': 'Các điều khoản sử dụng dịch vụ CardioGuard AI dành cho bệnh nhân, bác sĩ và quản trị viên.',
        'target_url': 'https://giatky.site/terms-of-service',
        'url': 'https://giatky.site/terms-of-service',
        'og_type': 'website',
        'status': 'active',
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # Đảm bảo cột url, target_url, page_path, role, title, description không null
    for col in ('url', 'target_url', 'page_path', 'role', 'title', 'description'):
        try:
            conn.execute(sa.text(
                f"ALTER TABLE domain_links ALTER COLUMN {col} SET NOT NULL"
            ))
        except Exception:
            pass  # cột chưa có hoặc DB không hỗ trợ — bỏ qua

    # Đảm bảo unique constraint trên (page_path, role)
    try:
        conn.execute(sa.text(
            "ALTER TABLE domain_links "
            "ADD CONSTRAINT uq_domain_links_path_role UNIQUE (page_path, role)"
        ))
    except Exception:
        pass  # constraint đã tồn tại

    # Upsert từng record — giữ bản ghi cũ nếu đã có, cập nhật title/description/url
    for row in DOMAIN_LINKS:
        conn.execute(sa.text("""
            INSERT INTO domain_links
                (page_path, role, title, description, target_url, url, og_type, status,
                 created_at, updated_at)
            VALUES
                (:page_path, :role, :title, :description, :target_url, :url, :og_type, :status,
                 NOW(), NOW())
            ON CONFLICT (page_path, role)
            DO UPDATE SET
                title       = EXCLUDED.title,
                description = EXCLUDED.description,
                target_url  = EXCLUDED.target_url,
                url         = EXCLUDED.url,
                og_type     = EXCLUDED.og_type,
                status      = EXCLUDED.status,
                updated_at  = NOW()
            WHERE domain_links.url IS NULL
               OR domain_links.title IS NULL
               OR domain_links.title = ''
        """), row)

    # Sửa mọi bản ghi url đang null bằng cách tổng hợp từ target_url
    conn.execute(sa.text("""
        UPDATE domain_links
        SET url = target_url, updated_at = NOW()
        WHERE url IS NULL AND target_url IS NOT NULL
    """))

    conn.execute(sa.text("""
        UPDATE domain_links
        SET target_url = url, updated_at = NOW()
        WHERE target_url IS NULL AND url IS NOT NULL
    """))


def downgrade() -> None:
    pass
