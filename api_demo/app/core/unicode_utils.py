"""Unicode normalization utilities for dictionary entries."""

import unicodedata
from typing import Tuple


def normalize_lemma(lemma_raw: str) -> Tuple[str, str]:
	"""
	Normalize a lemma to NFC form for deduplication and search.
	
	Args:
		lemma_raw: Original user input (preserves diacritics and case)
	
	Returns:
		Tuple of (lemma_raw, lemma_nfc)
	"""
	lemma_nfc = unicodedata.normalize('NFC', lemma_raw.strip())
	return lemma_raw, lemma_nfc


def normalize_for_search(text: str) -> str:
	"""
	Normalize text for case-insensitive search (NFC + lowercase).
	
	Args:
		text: Input text
	
	Returns:
		Normalized text for search
	"""
	normalized = unicodedata.normalize('NFC', text.strip())
	return normalized.lower()


def check_unicode_equivalence(raw: str, nfc: str) -> bool:
	"""
	Check if raw and NFC forms are visually equivalent.
	
	Args:
		raw: Original form
		nfc: Normalized form
	
	Returns:
		True if they're equivalent (no diacritics were lost)
	"""
	normalized = unicodedata.normalize('NFC', raw.strip())
	return normalized == nfc
