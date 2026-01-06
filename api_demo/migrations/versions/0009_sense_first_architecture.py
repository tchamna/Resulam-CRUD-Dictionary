"""Sense-first architecture: add Sense, SenseExample, SenseTranslation, SenseRelation tables.

Revision ID: 0009_sense_first_architecture
Revises: 0008_user_soft_delete
Create Date: 2026-01-05 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0009_sense_first_architecture'
down_revision = '0008_user_soft_delete'
branch_labels = None
depends_on = None


def upgrade() -> None:
	# Rename 'words' table to 'word_entries' and add new columns
	op.rename_table('words', 'word_entries')
	
	# Add new columns to word_entries
	op.add_column('word_entries', sa.Column('lemma_raw', sa.String(), nullable=True))
	op.add_column('word_entries', sa.Column('lemma_nfc', sa.String(), nullable=True))
	op.add_column('word_entries', sa.Column('pos', sa.String(), nullable=True))
	op.add_column('word_entries', sa.Column('pronunciation', sa.String(), nullable=True))
	op.add_column('word_entries', sa.Column('notes', sa.Text(), nullable=True))
	op.add_column('word_entries', sa.Column('status', sa.String(), nullable=True, server_default='draft'))
	op.add_column('word_entries', sa.Column('created_by_id', sa.Integer(), nullable=True))
	op.add_column('word_entries', sa.Column('created_at', sa.DateTime(), nullable=True))
	
	# Migrate data: populate lemma_raw and lemma_nfc from 'word' column
	op.execute("""
		UPDATE word_entries 
		SET lemma_raw = word, lemma_nfc = word 
		WHERE lemma_raw IS NULL
	""")
	
	# Make new columns NOT NULL after migration
	op.alter_column('word_entries', 'lemma_raw', nullable=False)
	op.alter_column('word_entries', 'lemma_nfc', nullable=False)
	op.alter_column('word_entries', 'created_at', nullable=False)
	
	# Create unique constraint on (language_id, lemma_nfc)
	op.create_unique_constraint('uq_language_lemma_nfc', 'word_entries', ['language_id', 'lemma_nfc'])
	
	# Add foreign key for created_by
	op.create_foreign_key('fk_word_entries_created_by', 'word_entries', 'users', ['created_by_id'], ['id'])
	
	# Drop old unique constraint
	op.drop_constraint('uq_language_word', 'word_entries', type_='unique')
	
	# Drop 'word' column (no longer needed)
	op.drop_column('word_entries', 'word')
	op.drop_column('word_entries', 'examples')
	op.drop_column('word_entries', 'synonyms')
	op.drop_column('word_entries', 'translation_fr')
	op.drop_column('word_entries', 'translation_en')
	
	# Create 'senses' table
	op.create_table(
		'senses',
		sa.Column('id', sa.Integer(), nullable=False),
		sa.Column('word_entry_id', sa.Integer(), nullable=False),
		sa.Column('sense_no', sa.Integer(), nullable=False),
		sa.Column('definition_text', sa.Text(), nullable=False),
		sa.Column('register', sa.String(), nullable=True),
		sa.Column('domain', sa.String(), nullable=True),
		sa.Column('notes', sa.Text(), nullable=True),
		sa.ForeignKeyConstraint(['word_entry_id'], ['word_entries.id'], name='fk_senses_word_entry'),
		sa.PrimaryKeyConstraint('id'),
		sa.UniqueConstraint('word_entry_id', 'sense_no', name='uq_word_sense_no')
	)
	op.create_index('ix_senses_word_entry_id', 'senses', ['word_entry_id'])
	
	# Create 'sense_examples' table
	op.create_table(
		'sense_examples',
		sa.Column('id', sa.Integer(), nullable=False),
		sa.Column('sense_id', sa.Integer(), nullable=False),
		sa.Column('example_text', sa.Text(), nullable=False),
		sa.Column('translation_fr', sa.Text(), nullable=True),
		sa.Column('translation_en', sa.Text(), nullable=True),
		sa.Column('source', sa.String(), nullable=True),
		sa.Column('rank', sa.Integer(), nullable=False, server_default='1'),
		sa.ForeignKeyConstraint(['sense_id'], ['senses.id'], name='fk_examples_sense'),
		sa.PrimaryKeyConstraint('id')
	)
	op.create_index('ix_sense_examples_sense_id', 'sense_examples', ['sense_id'])
	
	# Create 'sense_translations' table
	op.create_table(
		'sense_translations',
		sa.Column('id', sa.Integer(), nullable=False),
		sa.Column('sense_id', sa.Integer(), nullable=False),
		sa.Column('lang_code', sa.String(), nullable=False),
		sa.Column('translation_text', sa.Text(), nullable=False),
		sa.Column('rank', sa.Integer(), nullable=False, server_default='1'),
		sa.ForeignKeyConstraint(['sense_id'], ['senses.id'], name='fk_translations_sense'),
		sa.PrimaryKeyConstraint('id')
	)
	op.create_index('ix_sense_translations_sense_id', 'sense_translations', ['sense_id'])
	
	# Create 'sense_relations' table
	op.create_table(
		'sense_relations',
		sa.Column('id', sa.Integer(), nullable=False),
		sa.Column('sense_id', sa.Integer(), nullable=False),
		sa.Column('relation_type', sa.String(), nullable=False),
		sa.Column('related_word_entry_id', sa.Integer(), nullable=True),
		sa.Column('fallback_text', sa.String(), nullable=True),
		sa.Column('rank', sa.Integer(), nullable=False, server_default='1'),
		sa.ForeignKeyConstraint(['sense_id'], ['senses.id'], name='fk_relations_sense'),
		sa.ForeignKeyConstraint(['related_word_entry_id'], ['word_entries.id'], name='fk_relations_word_entry'),
		sa.PrimaryKeyConstraint('id')
	)
	op.create_index('ix_sense_relations_sense_id', 'sense_relations', ['sense_id'])
	op.create_index('ix_sense_relations_related_word_entry_id', 'sense_relations', ['related_word_entry_id'])
	
	# Create index on word_entries for search
	op.create_index('ix_word_entries_lemma_nfc', 'word_entries', ['lemma_nfc'])
	
	# Update languages foreign key reference if needed
	op.create_index('ix_word_entries_language_id', 'word_entries', ['language_id'])


def downgrade() -> None:
	# Reverse: recreate old 'words' table structure
	
	# Drop new tables
	op.drop_table('sense_relations')
	op.drop_table('sense_translations')
	op.drop_table('sense_examples')
	op.drop_table('senses')
	
	# Drop indexes
	op.drop_index('ix_word_entries_language_id', table_name='word_entries')
	op.drop_index('ix_word_entries_lemma_nfc', table_name='word_entries')
	
	# Rename table back
	op.rename_table('word_entries', 'words')
	
	# Drop new columns
	op.drop_column('words', 'created_at')
	op.drop_column('words', 'created_by_id')
	op.drop_column('words', 'status')
	op.drop_column('words', 'notes')
	op.drop_column('words', 'pronunciation')
	op.drop_column('words', 'pos')
	op.drop_column('words', 'lemma_nfc')
	op.drop_column('words', 'lemma_raw')
	
	# Drop new constraint
	op.drop_constraint('uq_language_lemma_nfc', 'words', type_='unique')
	op.drop_constraint('fk_word_entries_created_by', 'words', type_='foreignkey')
	
	# Recreate old columns (set to empty/null for migration)
	op.add_column('words', sa.Column('word', sa.String(), nullable=False, server_default=''))
	op.add_column('words', sa.Column('examples', sa.Text(), nullable=True))
	op.add_column('words', sa.Column('synonyms', sa.Text(), nullable=True))
	op.add_column('words', sa.Column('translation_fr', sa.Text(), nullable=True))
	op.add_column('words', sa.Column('translation_en', sa.Text(), nullable=True))
	
	# Recreate old unique constraint
	op.create_unique_constraint('uq_language_word', 'words', ['language_id', 'word'])
