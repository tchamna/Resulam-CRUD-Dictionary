"""add auth verification + invites

Revision ID: 0006_auth_verification_invites
Revises: 0005_add_word_details
Create Date: 2025-12-27 00:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_auth_verification_invites"
down_revision = "0005_add_word_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("auth_provider", sa.String(), nullable=False, server_default="local"))
        batch.add_column(sa.Column("google_sub", sa.String(), nullable=True))
        batch.add_column(sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        batch.create_unique_constraint("uq_users_google_sub", ["google_sub"])

    op.create_table(
        "invite_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("used_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["used_by_id"], ["users.id"]),
        sa.UniqueConstraint("code", name="uq_invite_code"),
    )
    op.create_index("ix_invite_codes_code", "invite_codes", ["code"])

    op.create_table(
        "email_verifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("token", name="uq_email_verification_token"),
    )
    op.create_index("ix_email_verifications_token", "email_verifications", ["token"])


def downgrade() -> None:
    op.drop_index("ix_email_verifications_token", table_name="email_verifications")
    op.drop_table("email_verifications")
    op.drop_index("ix_invite_codes_code", table_name="invite_codes")
    op.drop_table("invite_codes")

    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_google_sub", type_="unique")
        batch.drop_column("is_verified")
        batch.drop_column("google_sub")
        batch.drop_column("auth_provider")
