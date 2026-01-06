from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class User(Base):
	__tablename__ = "users"

	id = Column(Integer, primary_key=True, index=True)
	email = Column(String, unique=True, index=True, nullable=False)
	password_hash = Column(String, nullable=False)
	role = Column(String, nullable=False, default="user")  # "user" or "admin"
	auth_provider = Column(String, nullable=False, default="local")
	google_sub = Column(String, unique=True, nullable=True)
	is_verified = Column(Boolean, nullable=False, default=False)
	is_deleted = Column(Boolean, nullable=False, default=False)
	deleted_at = Column(DateTime, nullable=True)
	created_at = Column(DateTime, default=datetime.utcnow)
	defined_count = Column(Integer, nullable=False, default=0)

	items = relationship("Item", back_populates="owner")

class Item(Base):
	__tablename__ = "items"

	id = Column(Integer, primary_key=True, index=True)
	name = Column(String, nullable=False)
	owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

	owner = relationship("User", back_populates="items")

class WordEntry(Base):
	__tablename__ = "word_entries"
	__table_args__ = (UniqueConstraint("language_id", "lemma_nfc", name="uq_language_lemma_nfc"),)

	id = Column(Integer, primary_key=True, index=True)
	language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
	lemma_raw = Column(String, index=True, nullable=False)  # Original user input
	lemma_nfc = Column(String, index=True, nullable=False)  # Unicode NFC normalized
	pos = Column(String, nullable=True)  # Part of speech
	pronunciation = Column(String, nullable=True)
	notes = Column(Text, nullable=True)
	status = Column(String, default="draft")  # "draft" or "published"
	created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
	updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
	created_at = Column(DateTime, default=datetime.utcnow)
	updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

	created_by = relationship("User", foreign_keys=[created_by_id])
	updated_by = relationship("User", foreign_keys=[updated_by_id])
	language = relationship("Language", back_populates="word_entries")
	senses = relationship("Sense", back_populates="word_entry", cascade="all, delete-orphan")


class Sense(Base):
	__tablename__ = "senses"
	__table_args__ = (UniqueConstraint("word_entry_id", "sense_no", name="uq_word_sense_no"),)

	id = Column(Integer, primary_key=True, index=True)
	word_entry_id = Column(Integer, ForeignKey("word_entries.id"), nullable=False)
	sense_no = Column(Integer, nullable=False)  # 1, 2, 3, ...
	pos = Column(String, nullable=True)  # Part of speech per sense
	definition_text = Column(Text, nullable=False)
	register = Column(String, nullable=True)  # formal, informal, etc.
	domain = Column(String, nullable=True)  # technical, medical, etc.
	notes = Column(Text, nullable=True)

	word_entry = relationship("WordEntry", back_populates="senses")
	examples = relationship("SenseExample", back_populates="sense", cascade="all, delete-orphan")
	translations = relationship("SenseTranslation", back_populates="sense", cascade="all, delete-orphan")
	relations = relationship("SenseRelation", back_populates="sense", cascade="all, delete-orphan")


class SenseExample(Base):
	__tablename__ = "sense_examples"

	id = Column(Integer, primary_key=True, index=True)
	sense_id = Column(Integer, ForeignKey("senses.id"), nullable=False)
	example_text = Column(Text, nullable=False)
	translation_fr = Column(Text, nullable=True)
	translation_en = Column(Text, nullable=True)
	source = Column(String, nullable=True)
	rank = Column(Integer, default=1)

	sense = relationship("Sense", back_populates="examples")


class SenseTranslation(Base):
	__tablename__ = "sense_translations"

	id = Column(Integer, primary_key=True, index=True)
	sense_id = Column(Integer, ForeignKey("senses.id"), nullable=False)
	lang_code = Column(String, nullable=False)  # "fr", "en", etc.
	translation_text = Column(Text, nullable=False)
	rank = Column(Integer, default=1)

	sense = relationship("Sense", back_populates="translations")


class SenseRelation(Base):
	__tablename__ = "sense_relations"

	id = Column(Integer, primary_key=True, index=True)
	sense_id = Column(Integer, ForeignKey("senses.id"), nullable=False)
	relation_type = Column(String, nullable=False)  # "synonym", "antonym", "variant", "hypernym", "hyponym"
	related_word_entry_id = Column(Integer, ForeignKey("word_entries.id"), nullable=True)
	fallback_text = Column(String, nullable=True)  # Free text if not yet in DB
	rank = Column(Integer, default=1)

	sense = relationship("Sense", back_populates="relations")
	related_word_entry = relationship("WordEntry", foreign_keys=[related_word_entry_id])


# Legacy flat Word model (for backwards compatibility with old UI)
class Word(Base):
	__tablename__ = "words"
	__table_args__ = (UniqueConstraint("language_id", "word", name="uq_language_word"),)

	id = Column(Integer, primary_key=True, index=True)
	language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
	word = Column(String, index=True, nullable=False)
	definition = Column(Text, nullable=True)
	examples = Column(Text, nullable=True)
	synonyms = Column(Text, nullable=True)
	translation_fr = Column(Text, nullable=True)
	translation_en = Column(Text, nullable=True)
	updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
	updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

	updated_by = relationship("User")
	language = relationship("Language", back_populates="words")

class Language(Base):
	__tablename__ = "languages"

	id = Column(Integer, primary_key=True, index=True)
	name = Column(String, unique=True, index=True, nullable=False)
	slug = Column(String, unique=True, index=True, nullable=False)
	created_at = Column(DateTime, default=datetime.utcnow)

	word_entries = relationship("WordEntry", back_populates="language")
	words = relationship("Word", back_populates="language")

class InviteCode(Base):
	__tablename__ = "invite_codes"

	id = Column(Integer, primary_key=True, index=True)
	code = Column(String, unique=True, index=True, nullable=False)
	created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
	used_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
	created_at = Column(DateTime, default=datetime.utcnow)
	used_at = Column(DateTime, nullable=True)

	created_by = relationship("User", foreign_keys=[created_by_id])
	used_by = relationship("User", foreign_keys=[used_by_id])

class EmailVerification(Base):
	__tablename__ = "email_verifications"

	id = Column(Integer, primary_key=True, index=True)
	user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
	token = Column(String, unique=True, index=True, nullable=False)
	expires_at = Column(DateTime, nullable=False)
	used_at = Column(DateTime, nullable=True)
	created_at = Column(DateTime, default=datetime.utcnow)

	user = relationship("User")
