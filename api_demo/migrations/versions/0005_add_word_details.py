"""add word detail fields

Revision ID: 0005_add_word_details
Revises: 0004_add_defined_count
Create Date: 2025-12-27 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_add_word_details"
down_revision = "0004_add_defined_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("words") as batch:
        batch.add_column(sa.Column("examples", sa.Text(), nullable=True))
        batch.add_column(sa.Column("synonyms", sa.Text(), nullable=True))
        batch.add_column(sa.Column("translation_fr", sa.Text(), nullable=True))
        batch.add_column(sa.Column("translation_en", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("words") as batch:
        batch.drop_column("translation_en")
        batch.drop_column("translation_fr")
        batch.drop_column("synonyms")
        batch.drop_column("examples")
