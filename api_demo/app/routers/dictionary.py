from fastapi import APIRouter, Depends, HTTPException, Query
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import Word, User, Language
from app.schemas.dictionary import WordUpdate, WordCreate, LanguageCreate
from app.core.security import get_current_user, get_optional_user, require_role, require_verified_user
from app.core.clafrica import load_clafrica_map
from app.core.config import settings
from app.db.seed import resolve_word_list_path, seed_words

router = APIRouter(prefix="/dictionary", tags=["dictionary"])


@router.get("")
def list_words(
	language_id: int = Query(..., ge=1),
	search: str | None = None,
	status: str = Query("all", pattern="^(all|defined|undefined)$"),
	limit: int = Query(50, ge=1, le=200),
	offset: int = Query(0, ge=0),
	db: Session = Depends(get_db),
):
	query = db.query(Word, User.email).outerjoin(User, Word.updated_by_id == User.id)
	query = query.filter(Word.language_id == language_id)
	if search:
		query = query.filter(func.lower(Word.word).like(f"%{search.lower()}%"))
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
			"updated_by_email": email,
			"updated_at": word.updated_at,
		}
		for word, email in rows
	]


@router.get("/random")
def random_words(
	language_id: int = Query(..., ge=1),
	limit: int = Query(10, ge=1, le=50),
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
			"updated_by_email": email,
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
	user=Depends(require_verified_user),
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
	word.updated_by_id = user.id
	if not was_defined and payload.definition.strip():
		user.defined_count = (user.defined_count or 0) + 1
	db.commit()
	db.refresh(word)
	return {"status": "OK", "id": word.id, "word": word.word}


@router.post("")
def create_word(
	payload: WordCreate,
	db: Session = Depends(get_db),
	user=Depends(require_verified_user),
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
		updated_by_id=user.id,
	)
	db.add(row)
	user.defined_count = (user.defined_count or 0) + 1
	db.commit()
	db.refresh(row)
	return {"status": "OK", "id": row.id, "word": row.word}


@router.get("/languages")
def list_languages(db: Session = Depends(get_db)):
	rows = db.query(Language).order_by(Language.name.asc()).all()
	return [{"id": r.id, "name": r.name, "slug": r.slug} for r in rows]


@router.post("/languages")
def create_language(
	payload: LanguageCreate,
	db: Session = Depends(get_db),
	user=Depends(require_verified_user),
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
	user=Depends(require_role("admin")),
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
	user=Depends(require_role("admin")),
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
