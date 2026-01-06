"""Add pos column to senses.

Revision ID: 0010_add_sense_pos
Revises: 0009_sense_first_architecture
Create Date: 2026-01-06 01:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0010_add_sense_pos'
down_revision = '0009_sense_first_architecture'
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column('senses', sa.Column('pos', sa.String(), nullable=True))


def downgrade() -> None:
	op.drop_column('senses', 'pos')
