"""add user defined_count

Revision ID: 0004_add_defined_count
Revises: 0003_add_languages
Create Date: 2025-12-27 00:05:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_defined_count"
down_revision = "0003_add_languages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("defined_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("defined_count")
