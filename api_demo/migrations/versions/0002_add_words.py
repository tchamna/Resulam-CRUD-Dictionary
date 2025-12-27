"""add words table

Revision ID: 0002_add_words
Revises: 0001_init
Create Date: 2025-12-26 21:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_add_words"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_table(
		"words",
		sa.Column("id", sa.Integer(), primary_key=True, index=True),
		sa.Column("word", sa.String(), nullable=False),
		sa.Column("definition", sa.Text(), nullable=True),
		sa.Column("updated_by_id", sa.Integer(), nullable=True),
		sa.Column("updated_at", sa.DateTime(), nullable=True),
		sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
	)
	op.create_index("ix_words_id", "words", ["id"], unique=False)
	op.create_index("ix_words_word", "words", ["word"], unique=True)


def downgrade() -> None:
	op.drop_index("ix_words_word", table_name="words")
	op.drop_index("ix_words_id", table_name="words")
	op.drop_table("words")
