"""add user soft delete fields

Revision ID: 0008_user_soft_delete
Revises: 0007_fix_auth_columns
Create Date: 2026-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_user_soft_delete"
down_revision = "0007_fix_auth_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("users", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
	op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))
	op.alter_column("users", "is_deleted", server_default=None)


def downgrade() -> None:
	op.drop_column("users", "deleted_at")
	op.drop_column("users", "is_deleted")
