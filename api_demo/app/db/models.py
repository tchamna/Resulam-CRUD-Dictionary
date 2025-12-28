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
