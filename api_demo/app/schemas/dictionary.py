from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WordUpdate(BaseModel):
	definition: str = Field(min_length=1)
	examples: Optional[str] = None
	synonyms: Optional[str] = None
	translation_fr: Optional[str] = None
	translation_en: Optional[str] = None


class WordCreate(BaseModel):
	language_id: int
	word: str = Field(min_length=1, max_length=120)
	definition: str = Field(min_length=1)
	examples: Optional[str] = None
	synonyms: Optional[str] = None
	translation_fr: Optional[str] = None
	translation_en: Optional[str] = None


class WordOut(BaseModel):
	id: int
	language_id: int
	word: str
	definition: Optional[str] = None
	examples: Optional[str] = None
	synonyms: Optional[str] = None
	translation_fr: Optional[str] = None
	translation_en: Optional[str] = None
	updated_by_email: Optional[str] = None
	updated_at: Optional[datetime] = None

	class Config:
		from_attributes = True


class LanguageCreate(BaseModel):
	name: str = Field(min_length=2, max_length=100)


class LanguageOut(BaseModel):
	id: int
	name: str
	slug: str
