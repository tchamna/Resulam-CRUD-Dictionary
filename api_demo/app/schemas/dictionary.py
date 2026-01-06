from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ============================================================================
# Sense-First Nested Schemas (AGENTS.md compliant)
# ============================================================================

class SenseExampleBase(BaseModel):
	example_text: str = Field(min_length=1, max_length=2000)
	translation_fr: Optional[str] = Field(None, max_length=2000)
	translation_en: Optional[str] = Field(None, max_length=2000)
	source: Optional[str] = Field(None, max_length=256)
	rank: int = 1


class SenseExampleCreate(SenseExampleBase):
	id: Optional[int] = None  # null for new examples


class SenseExampleOut(SenseExampleBase):
	id: int

	class Config:
		from_attributes = True


class SenseTranslationBase(BaseModel):
	lang_code: str = Field(min_length=2, max_length=5)  # "fr", "en", etc.
	translation_text: str = Field(min_length=1, max_length=256)
	rank: int = 1


class SenseTranslationCreate(SenseTranslationBase):
	id: Optional[int] = None


class SenseTranslationOut(SenseTranslationBase):
	id: int

	class Config:
		from_attributes = True


class SenseRelationBase(BaseModel):
	relation_type: str = Field(pattern="^(synonym|antonym|homonym|variant|hypernym|hyponym)$")
	related_word_entry_id: Optional[int] = None
	fallback_text: Optional[str] = Field(None, max_length=256)
	rank: int = 1


class SenseRelationCreate(SenseRelationBase):
	id: Optional[int] = None


class SenseRelationOut(SenseRelationBase):
	id: int

	class Config:
		from_attributes = True


class SenseBase(BaseModel):
	sense_no: int = Field(ge=1)
	pos: Optional[str] = Field(None, max_length=50)
	definition_text: str = Field(min_length=1, max_length=10000)
	register: Optional[str] = Field(None, max_length=50)
	domain: Optional[str] = Field(None, max_length=50)
	notes: Optional[str] = Field(None, max_length=1000)


class SenseCreate(SenseBase):
	id: Optional[int] = None
	examples: List[SenseExampleCreate] = []
	translations: List[SenseTranslationCreate] = []
	relations: List[SenseRelationCreate] = []


class SenseOut(SenseBase):
	definition_text: str = Field(min_length=0, max_length=10000)
	id: int
	examples: List[SenseExampleOut] = []
	translations: List[SenseTranslationOut] = []
	relations: List[SenseRelationOut] = []

	class Config:
		from_attributes = True


class WordEntryBase(BaseModel):
	language_id: int = Field(ge=1)
	lemma_raw: str = Field(min_length=1, max_length=128)
	pos: Optional[str] = Field(None, max_length=50)
	pronunciation: Optional[str] = Field(None, max_length=256)
	notes: Optional[str] = Field(None, max_length=1000)
	status: str = Field(default="draft", pattern="^(draft|published)$")


class WordEntryCreate(WordEntryBase):
	senses: List[SenseCreate] = Field(min_items=1)  # At least one sense


class WordEntryUpdate(WordEntryBase):
	senses: List[SenseCreate] = Field(min_items=1)


class WordEntryOut(WordEntryBase):
	id: int
	lemma_nfc: str
	created_by_id: Optional[int] = None
	updated_by_id: Optional[int] = None
	created_at: datetime
	updated_at: datetime
	senses: List[SenseOut] = []

	class Config:
		from_attributes = True


# ============================================================================
# Legacy schemas (for backwards compatibility during migration)
# ============================================================================

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
