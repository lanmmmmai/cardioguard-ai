"""add facebook_id and last_login_at to users table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # facebook_id — nullable, unique per user
    try:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT"
        ))
        conn.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_facebook_id "
            "ON users (facebook_id) WHERE facebook_id IS NOT NULL"
        ))
    except Exception:
        pass

    # last_login_at — nullable timestamp
    try:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ"
        ))
    except Exception:
        pass

    # provider — for tracking login method ('email', 'google', 'facebook', 'apple')
    try:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email'"
        ))
    except Exception:
        pass


def downgrade() -> None:
    pass
