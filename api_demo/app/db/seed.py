from pathlib import Path
from typing import Iterable, Set

from sqlalchemy.orm import Session

from app.db.models import Word, Language


def resolve_word_list_path(project_dir: Path, configured_path: str) -> Path:
	path = Path(configured_path)
	if path.is_absolute() and path.exists():
		return path
	candidate = project_dir / configured_path
	if candidate.exists():
		return candidate
	parent_candidate = project_dir.parent / configured_path
	return parent_candidate


def _read_word_list(word_list_path: Path) -> Iterable[str]:
	try:
		text = word_list_path.read_text(encoding="utf-8-sig")
	except UnicodeDecodeError:
		text = word_list_path.read_text(encoding="latin-1")
	return text.splitlines()


def seed_languages(db: Session, names: Iterable[str]) -> int:
	existing = {row.name for row in db.query(Language).all()}
	count = 0
	for name in names:
		if name in existing:
			continue
		slug = name.lower().replace("'", "").replace(" ", "-")
		db.add(Language(name=name, slug=slug))
		count += 1
	if count:
		db.commit()
	return count


def seed_words(db: Session, word_list_path: Path, language: Language, force: bool = False) -> int:
	if not word_list_path.exists():
		return 0
	if not force and db.query(Word).filter(Word.language_id == language.id).count() > 0:
		return 0
	if force:
		db.query(Word).filter(Word.language_id == language.id).delete()
		db.commit()
	seen: Set[str] = set()
	words = []
	for line in _read_word_list(word_list_path):
		word = line.strip()
		if not word or word == "'":
			continue
		if word in seen:
			continue
		seen.add(word)
		words.append(Word(word=word, language_id=language.id))
	if words:
		db.bulk_save_objects(words)
		db.commit()
	return len(words)
