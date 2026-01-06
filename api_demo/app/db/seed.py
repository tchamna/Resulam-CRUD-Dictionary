from pathlib import Path
from typing import Iterable, Set

from sqlalchemy.orm import Session

from app.db.models import WordEntry, Sense, Word, Language
from app.core.unicode_utils import normalize_lemma


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
	"""Seed both WordEntry (new) and Word (legacy) tables with lemmas from word list."""
	if not word_list_path.exists():
		return 0
	
	existing_words: Set[str] = set()
	existing_entries: Set[str] = set()
	
	if force:
		db.query(Word).filter(Word.language_id == language.id).delete()
		db.query(WordEntry).filter(WordEntry.language_id == language.id).delete()
		db.commit()
	else:
		existing_words = {
			row[0]
			for row in db.query(Word.word).filter(Word.language_id == language.id).all()
		}
		existing_entries = {
			row[0]
			for row in db.query(WordEntry.lemma_nfc).filter(WordEntry.language_id == language.id).all()
		}
	
	seen: Set[str] = set()
	words_to_add = []
	entries_to_add = []
	
	for line in _read_word_list(word_list_path):
		lemma_raw = line.strip()
		if not lemma_raw or lemma_raw == "'":
			continue
		
		# Normalize to NFC for deduplication
		_, lemma_nfc = normalize_lemma(lemma_raw)
		
		if lemma_nfc in seen:
			continue
		seen.add(lemma_nfc)
		if lemma_raw not in existing_words:
			words_to_add.append(lemma_raw)
		if lemma_nfc not in existing_entries:
			entries_to_add.append((lemma_raw, lemma_nfc))
	
	# Bulk insert legacy Word entries (for existing UI)
	if words_to_add:
		word_objects = [
			Word(language_id=language.id, word=w, definition=None)
			for w in words_to_add
		]
		db.bulk_save_objects(word_objects)
		db.commit()
		
	# Also create WordEntry + Sense for each (for new API), in batches to reduce commits.
	batch_size = 500
	batch_count = 0
	for lemma_raw, lemma_nfc in entries_to_add:
		word_entry = WordEntry(
			language_id=language.id,
			lemma_raw=lemma_raw,
			lemma_nfc=lemma_nfc,
			status="draft"
		)
		word_entry.senses.append(Sense(sense_no=1, definition_text=""))
		db.add(word_entry)
		batch_count += 1
		if batch_count >= batch_size:
			db.commit()
			db.expunge_all()
			batch_count = 0
	if batch_count:
		db.commit()
		db.expunge_all()
	
	return len(entries_to_add)
