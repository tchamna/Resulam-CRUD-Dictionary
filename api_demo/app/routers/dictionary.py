from fastapi import APIRouter, Depends, HTTPException, Query
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import WordEntry, Sense, SenseExample, SenseTranslation, SenseRelation, User, Language, Word
from app.schemas.dictionary import (
	WordEntryCreate, WordEntryUpdate, WordEntryOut,
	SenseCreate, SenseOut,
	WordUpdate, WordCreate, LanguageCreate
)
from app.core.security import get_optional_user
from app.core.clafrica import load_clafrica_map
from app.core.config import settings
from app.core.logging import log_event
from app.core.unicode_utils import normalize_lemma
from app.db.seed import resolve_word_list_path, seed_words

router = APIRouter(prefix="/dictionary", tags=["dictionary"])


# ============================================================================
# New Sense-First API Endpoints (AGENTS.md compliant)
# ============================================================================

@router.post("/word-entries", response_model=WordEntryOut)
def create_word_entry(
	payload: WordEntryCreate,
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	"""Create a new WordEntry with nested Senses, Examples, Translations, Relations."""
	language = db.query(Language).filter(Language.id == payload.language_id).first()
	if not language:
		raise HTTPException(status_code=404, detail="Language not found")
	
	# Normalize lemma
	lemma_raw, lemma_nfc = normalize_lemma(payload.lemma_raw)
	
	# Check uniqueness
	existing = db.query(WordEntry).filter(
		WordEntry.language_id == payload.language_id,
		WordEntry.lemma_nfc == lemma_nfc
	).first()
	if existing:
		raise HTTPException(status_code=409, detail=f"WordEntry already exists for lemma '{lemma_raw}'")
	
	# Create WordEntry
	user_id = user.id if user else None
	word_entry = WordEntry(
		language_id=payload.language_id,
		lemma_raw=lemma_raw,
		lemma_nfc=lemma_nfc,
		pos=payload.pos,
		pronunciation=payload.pronunciation,
		notes=payload.notes,
		status=payload.status,
		created_by_id=user_id,
		updated_by_id=user_id,
	)
	db.add(word_entry)
	db.flush()  # Get the ID before adding children
	
	# Add Senses and their children
	for sense_payload in payload.senses:
		sense = Sense(
			word_entry_id=word_entry.id,
			sense_no=sense_payload.sense_no,
			pos=sense_payload.pos,
			definition_text=sense_payload.definition_text,
			register=sense_payload.register,
			domain=sense_payload.domain,
			notes=sense_payload.notes,
		)
		db.add(sense)
		db.flush()
		
		# Add Examples
		for ex_payload in sense_payload.examples:
			example = SenseExample(
				sense_id=sense.id,
				example_text=ex_payload.example_text,
				translation_fr=ex_payload.translation_fr,
				translation_en=ex_payload.translation_en,
				source=ex_payload.source,
				rank=ex_payload.rank,
			)
			db.add(example)
		
		# Add Translations
		for trans_payload in sense_payload.translations:
			translation = SenseTranslation(
				sense_id=sense.id,
				lang_code=trans_payload.lang_code,
				translation_text=trans_payload.translation_text,
				rank=trans_payload.rank,
			)
			db.add(translation)
		
		# Add Relations (with resolution logic)
		for rel_payload in sense_payload.relations:
			related_word_entry_id = rel_payload.related_word_entry_id
			
			# If fallback_text provided but no ID, try to resolve it
			if not related_word_entry_id and rel_payload.fallback_text:
				_, fallback_nfc = normalize_lemma(rel_payload.fallback_text)
				resolved = db.query(WordEntry).filter(
					WordEntry.language_id == payload.language_id,
					WordEntry.lemma_nfc == fallback_nfc,
				).first()
				if resolved:
					related_word_entry_id = resolved.id
			
			relation = SenseRelation(
				sense_id=sense.id,
				relation_type=rel_payload.relation_type,
				related_word_entry_id=related_word_entry_id,
				fallback_text=rel_payload.fallback_text if not related_word_entry_id else None,
				rank=rel_payload.rank,
			)
			db.add(relation)
	
	db.commit()
	db.refresh(word_entry)
	
	log_event(
		"word_entry_create",
		word_entry_id=word_entry.id,
		language_id=word_entry.language_id,
		lemma=lemma_raw,
		sense_count=len(payload.senses),
		user_id=user_id,
	)
	
	return word_entry


@router.put("/word-entries/{word_entry_id}", response_model=WordEntryOut)
def update_word_entry(
	word_entry_id: int,
	payload: WordEntryUpdate,
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	"""Update a WordEntry with nested children (stable-ID diff strategy)."""
	word_entry = db.query(WordEntry).filter(WordEntry.id == word_entry_id).first()
	if not word_entry:
		raise HTTPException(status_code=404, detail="WordEntry not found")
	
	# Update basic fields
	word_entry.pos = payload.pos
	word_entry.pronunciation = payload.pronunciation
	word_entry.notes = payload.notes
	word_entry.status = payload.status
	user_id = user.id if user else None
	word_entry.updated_by_id = user_id
	
	# Ensure sense_no is contiguous
	for i, sense_payload in enumerate(payload.senses, 1):
		sense_payload.sense_no = i
	
	# Stable-ID diff: update by IDs, insert missing, delete removed
	incoming_sense_ids = {s.id for s in payload.senses if s.id}
	existing_sense_ids = {s.id for s in word_entry.senses}
	
	# Delete senses not in incoming payload
	deleted_any = False
	for sense in word_entry.senses[:]:
		if sense.id not in incoming_sense_ids:
			db.delete(sense)
			deleted_any = True
	if deleted_any:
		db.flush()
	
	# Update or insert senses
	for sense_payload in payload.senses:
		if sense_payload.id:
			# Update existing
			sense = db.query(Sense).filter(Sense.id == sense_payload.id).first()
			if not sense:
				raise HTTPException(status_code=404, detail=f"Sense {sense_payload.id} not found")
		else:
			# Create new
			sense = Sense(word_entry_id=word_entry.id)
			db.add(sense)
		
		sense.sense_no = sense_payload.sense_no
		sense.pos = sense_payload.pos
		sense.definition_text = sense_payload.definition_text
		sense.register = sense_payload.register
		sense.domain = sense_payload.domain
		sense.notes = sense_payload.notes
		if not sense_payload.id:
			db.flush()
		
		# Update examples
		incoming_example_ids = {ex.id for ex in sense_payload.examples if ex.id}
		for example in sense.examples[:]:
			if example.id not in incoming_example_ids:
				db.delete(example)
		
		for ex_payload in sense_payload.examples:
			if ex_payload.id:
				example = db.query(SenseExample).filter(SenseExample.id == ex_payload.id).first()
				if example:
					example.example_text = ex_payload.example_text
					example.translation_fr = ex_payload.translation_fr
					example.translation_en = ex_payload.translation_en
					example.source = ex_payload.source
					example.rank = ex_payload.rank
			else:
				example = SenseExample(
					sense_id=sense.id,
					example_text=ex_payload.example_text,
					translation_fr=ex_payload.translation_fr,
					translation_en=ex_payload.translation_en,
					source=ex_payload.source,
					rank=ex_payload.rank,
				)
				db.add(example)
		
		# Update translations
		incoming_trans_ids = {t.id for t in sense_payload.translations if t.id}
		for translation in sense.translations[:]:
			if translation.id not in incoming_trans_ids:
				db.delete(translation)
		
		for trans_payload in sense_payload.translations:
			if trans_payload.id:
				translation = db.query(SenseTranslation).filter(SenseTranslation.id == trans_payload.id).first()
				if translation:
					translation.lang_code = trans_payload.lang_code
					translation.translation_text = trans_payload.translation_text
					translation.rank = trans_payload.rank
			else:
				translation = SenseTranslation(
					sense_id=sense.id,
					lang_code=trans_payload.lang_code,
					translation_text=trans_payload.translation_text,
					rank=trans_payload.rank,
				)
				db.add(translation)
		
		# Update relations
		incoming_rel_ids = {r.id for r in sense_payload.relations if r.id}
		for relation in sense.relations[:]:
			if relation.id not in incoming_rel_ids:
				db.delete(relation)
		
		for rel_payload in sense_payload.relations:
			related_word_entry_id = rel_payload.related_word_entry_id
			
			# Try to resolve fallback_text if needed
			if not related_word_entry_id and rel_payload.fallback_text:
				_, fallback_nfc = normalize_lemma(rel_payload.fallback_text)
				resolved = db.query(WordEntry).filter(
					WordEntry.language_id == word_entry.language_id,
					WordEntry.lemma_nfc == fallback_nfc,
				).first()
				if resolved:
					related_word_entry_id = resolved.id
			
			if rel_payload.id:
				relation = db.query(SenseRelation).filter(SenseRelation.id == rel_payload.id).first()
				if relation:
					relation.relation_type = rel_payload.relation_type
					relation.related_word_entry_id = related_word_entry_id
					relation.fallback_text = rel_payload.fallback_text if not related_word_entry_id else None
					relation.rank = rel_payload.rank
			else:
				relation = SenseRelation(
					sense_id=sense.id,
					relation_type=rel_payload.relation_type,
					related_word_entry_id=related_word_entry_id,
					fallback_text=rel_payload.fallback_text if not related_word_entry_id else None,
					rank=rel_payload.rank,
				)
				db.add(relation)
	
	db.commit()
	db.refresh(word_entry)
	
	log_event(
		"word_entry_update",
		word_entry_id=word_entry.id,
		language_id=word_entry.language_id,
		lemma=word_entry.lemma_raw,
		sense_count=len(word_entry.senses),
		user_id=user_id,
	)
	
	return word_entry


@router.get("/word-entries/{word_entry_id}", response_model=WordEntryOut)
def get_word_entry(
	word_entry_id: int,
	db: Session = Depends(get_db),
):
	"""Retrieve a WordEntry with all nested Senses, Examples, Translations, Relations."""
	word_entry = db.query(WordEntry).filter(WordEntry.id == word_entry_id).first()
	if not word_entry:
		raise HTTPException(status_code=404, detail="WordEntry not found")
	return word_entry


@router.get("/word-entries", response_model=list[WordEntryOut])
def list_word_entries(
	language_id: int = Query(..., ge=1),
	search: str | None = None,
	status: str | None = None,
	limit: int = Query(50, ge=1, le=200),
	offset: int = Query(0, ge=0),
	db: Session = Depends(get_db),
):
	"""List WordEntries with optional search and filtering."""
	query = db.query(WordEntry).filter(WordEntry.language_id == language_id)
	
	if search:
		search_nfc = normalize_lemma(search)[1]
		query = query.filter(WordEntry.lemma_nfc.ilike(f"%{search_nfc}%"))
	
	if status:
		query = query.filter(WordEntry.status == status)
	
	query = query.order_by(WordEntry.id.asc())
	return query.offset(offset).limit(limit).all()


# ============================================================================
# Legacy Flat-Word API Endpoints (for backwards compatibility)
# ============================================================================

@router.get("")
def list_words(
	language_id: int = Query(..., ge=1),
	search: str | None = None,
	exact: bool = Query(False),
	status: str = Query("all", pattern="^(all|defined|undefined)$"),
	limit: int = Query(50, ge=1, le=200),
	offset: int = Query(0, ge=0),
	db: Session = Depends(get_db),
):
	query = db.query(Word, User.email).outerjoin(User, Word.updated_by_id == User.id)
	query = query.filter(Word.language_id == language_id)
	if search:
		search_value = search.lower()
		if exact:
			query = query.filter(func.lower(Word.word) == search_value)
		else:
			query = query.filter(func.lower(Word.word).like(f"%{search_value}%"))
	if status == "defined":
		query = query.filter(Word.definition.is_not(None)).filter(Word.definition != "")
	elif status == "undefined":
		query = query.filter((Word.definition.is_(None)) | (Word.definition == ""))
	query = query.order_by(Word.id.asc())
	rows = query.offset(offset).limit(limit).all()
	return [
		{
			"id": word.id,
			"language_id": word.language_id,
			"word": word.word,
			"definition": word.definition,
			"examples": word.examples,
			"synonyms": word.synonyms,
			"translation_fr": word.translation_fr,
			"translation_en": word.translation_en,
			"updated_by_email": email or "anonymous",
			"updated_at": word.updated_at,
		}
		for word, email in rows
	]


@router.get("/random")
def random_words(
	language_id: int = Query(..., ge=1),
	limit: int = Query(10, ge=1, le=200),
	db: Session = Depends(get_db),
):
	query = (
		db.query(Word, User.email)
		.outerjoin(User, Word.updated_by_id == User.id)
		.filter(Word.language_id == language_id)
		.filter((Word.definition.is_(None)) | (Word.definition == ""))
		.order_by(func.random())
	)
	rows = query.limit(limit).all()
	return [
		{
			"id": word.id,
			"language_id": word.language_id,
			"word": word.word,
			"definition": word.definition,
			"examples": word.examples,
			"synonyms": word.synonyms,
			"translation_fr": word.translation_fr,
			"translation_en": word.translation_en,
			"updated_by_email": email or "anonymous",
			"updated_at": word.updated_at,
		}
		for word, email in rows
	]


@router.get("/clafrica-map")
def clafrica_map():
	project_dir = Path(__file__).resolve().parents[2]
	return load_clafrica_map(project_dir)


@router.put("/{word_id}")
def update_word(
	word_id: int,
	payload: WordUpdate,
	language_id: int = Query(..., ge=1),
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	word = db.query(Word).filter(Word.id == word_id, Word.language_id == language_id).first()
	if not word:
		raise HTTPException(status_code=404, detail="Word not found")
	was_defined = bool(word.definition and word.definition.strip())
	word.definition = payload.definition
	word.examples = payload.examples
	word.synonyms = payload.synonyms
	word.translation_fr = payload.translation_fr
	word.translation_en = payload.translation_en
	user_id = user.id if user else None
	word.updated_by_id = user_id
	if user and not was_defined and payload.definition.strip():
		user.defined_count = (user.defined_count or 0) + 1
	db.commit()
	db.refresh(word)
	log_event(
		"dictionary_update",
		word_id=word.id,
		language_id=word.language_id,
		user_id=user_id,
		definition_len=len(payload.definition or ""),
		examples_len=len(payload.examples or ""),
		synonyms_len=len(payload.synonyms or ""),
		translation_fr_len=len(payload.translation_fr or ""),
		translation_en_len=len(payload.translation_en or ""),
	)
	return {"status": "OK", "id": word.id, "word": word.word}


@router.post("")
def create_word(
	payload: WordCreate,
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	language = db.query(Language).filter(Language.id == payload.language_id).first()
	if not language:
		raise HTTPException(status_code=404, detail="Language not found")
	exists = (
		db.query(Word)
		.filter(Word.language_id == payload.language_id, Word.word == payload.word)
		.first()
	)
	if exists:
		raise HTTPException(status_code=409, detail="Word already exists")
	row = Word(
		language_id=payload.language_id,
		word=payload.word,
		definition=payload.definition,
		examples=payload.examples,
		synonyms=payload.synonyms,
		translation_fr=payload.translation_fr,
		translation_en=payload.translation_en,
		updated_by_id=(user.id if user else None),
	)
	db.add(row)
	if user:
		user.defined_count = (user.defined_count or 0) + 1
	db.commit()
	db.refresh(row)
	log_event(
		"dictionary_create",
		word_id=row.id,
		language_id=row.language_id,
		user_id=(user.id if user else None),
		definition_len=len(payload.definition or ""),
		examples_len=len(payload.examples or ""),
		synonyms_len=len(payload.synonyms or ""),
		translation_fr_len=len(payload.translation_fr or ""),
		translation_en_len=len(payload.translation_en or ""),
	)
	return {"status": "OK", "id": row.id, "word": row.word}


@router.get("/languages")
def list_languages(db: Session = Depends(get_db)):
	rows = db.query(Language).order_by(Language.name.asc()).all()
	return [{"id": r.id, "name": r.name, "slug": r.slug} for r in rows]


@router.post("/languages")
def create_language(
	payload: LanguageCreate,
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	slug = payload.name.lower().replace("'", "").replace(" ", "-")
	exists = db.query(Language).filter(Language.slug == slug).first()
	if exists:
		raise HTTPException(status_code=409, detail="Language already exists")
	row = Language(name=payload.name, slug=slug)
	db.add(row)
	db.commit()
	db.refresh(row)
	return {"id": row.id, "name": row.name, "slug": row.slug}


@router.delete("/languages/{language_id}")
def delete_language(
	language_id: int,
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	row = db.query(Language).filter(Language.id == language_id).first()
	if not row:
		raise HTTPException(status_code=404, detail="Language not found")
	# Delete words first to avoid orphaned entries
	db.query(Word).filter(Word.language_id == row.id).delete()
	db.delete(row)
	db.commit()
	return {"status": "OK", "id": language_id}


@router.post("/reseed")
def reseed_words(
	confirm: bool = False,
	language_id: int = Query(..., ge=1),
	db: Session = Depends(get_db),
	user=Depends(get_optional_user),
):
	if not confirm:
		raise HTTPException(status_code=400, detail="Set confirm=true to reseed")
	project_dir = Path(__file__).resolve().parents[2]
	word_list_path = resolve_word_list_path(project_dir, settings.WORD_LIST_PATH)
	language = db.query(Language).filter(Language.id == language_id).first()
	if not language:
		raise HTTPException(status_code=404, detail="Language not found")
	count = seed_words(db, word_list_path, language, force=True)
	return {"status": "OK", "count": count}
