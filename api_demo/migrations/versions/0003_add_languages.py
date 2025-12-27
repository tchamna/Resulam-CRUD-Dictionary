"""add languages and link words

Revision ID: 0003_add_languages
Revises: 0002_add_words
Create Date: 2025-12-26 22:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_languages"
down_revision = "0002_add_words"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "languages",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_languages_id", "languages", ["id"], unique=False)
    op.create_index("ix_languages_name", "languages", ["name"], unique=True)
    op.create_index("ix_languages_slug", "languages", ["slug"], unique=True)

    op.execute(
        "INSERT INTO languages (name, slug) VALUES "
        "('Nufi', 'nufi'), ('Medumba', 'medumba'), ('Ghomala''', 'ghomala'), ('Yoruba', 'yoruba')"
    )

    with op.batch_alter_table("words") as batch:
        batch.add_column(sa.Column("language_id", sa.Integer(), nullable=True))

    op.execute(
        "UPDATE words SET language_id = (SELECT id FROM languages WHERE slug = 'nufi') "
        "WHERE language_id IS NULL"
    )

    with op.batch_alter_table("words") as batch:
        batch.create_foreign_key("fk_words_language_id", "languages", ["language_id"], ["id"])
        batch.drop_index("ix_words_word")
        batch.create_unique_constraint("uq_language_word", ["language_id", "word"])
        batch.alter_column("language_id", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("words") as batch:
        batch.drop_constraint("uq_language_word", type_="unique")
        batch.drop_constraint("fk_words_language_id", type_="foreignkey")
        batch.create_index("ix_words_word", ["word"], unique=True)
        batch.drop_column("language_id")

    op.drop_index("ix_languages_slug", table_name="languages")
    op.drop_index("ix_languages_name", table_name="languages")
    op.drop_index("ix_languages_id", table_name="languages")
    op.drop_table("languages")