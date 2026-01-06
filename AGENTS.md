# Agents.md

This document defines **agent responsibilities, interfaces, and guardrails** for a dictionary-entry web application where a **Word** contains multiple **independent Senses (Definitions)**, and each Sense owns its own examples, translations, and lexical relations (synonyms/antonyms/etc.).

---

## 1) Core Principle

**Sense-first modeling**: a *WordEntry* is a headword/lemma; each *Sense* (definition) is the atomic semantic unit.

- WordEntry → many Senses
- Sense → many Examples
- Sense → many Translations (per language)
- Sense → many Relations (synonyms, antonyms, variants, etc.)

---

## 2) Canonical Data Model (Source of Truth)

### Entities

- **WordEntry**
  - `id` (PK)
  - `language_id`
  - `lemma_raw` (exact user input; preserve Unicode)
  - `lemma_nfc` (Unicode-normalized for uniqueness/search)
  - optional: `pos`, `pronunciation`, `notes`
  - metadata: `created_by`, `updated_by`, timestamps, `status` (draft/published)

- **Sense**
  - `id` (PK)
  - `word_entry_id` (FK → WordEntry)
  - `sense_no` (ordering: 1..N)
  - `definition_text`
  - optional: `register`, `domain`, `notes`

- **SenseExample**
  - `id` (PK)
  - `sense_id` (FK → Sense)
  - `example_text`
  - optional: `translation_fr`, `translation_en`, `source`
  - `rank` (ordering)

- **SenseTranslation**
  - `id` (PK)
  - `sense_id` (FK → Sense)
  - `lang_code` (e.g., `fr`, `en`)
  - `translation_text`
  - `rank`

- **SenseRelation**
  - `id` (PK)
  - `sense_id` (FK → Sense)
  - `relation_type` (e.g., synonym, antonym, variant, hypernym, hyponym)
  - preferred: `related_word_entry_id` (FK → WordEntry)
  - fallback: `fallback_text` (free text if not yet in DB)
  - `rank`

### Constraints

- Uniqueness: `(language_id, lemma_nfc)` must be unique.
- Sense ordering: `(word_entry_id, sense_no)` must be unique.
- Foreign keys: cascading delete from WordEntry → Sense → children.

---

## 3) Agent Roles

### 3.1 UI/Form Agent (Frontend)
**Goal**: provide a robust UX for creating/editing WordEntries with multiple independent Senses.

Responsibilities:
- Render **Sense cards** (repeatable sections). Each card owns:
  - definition text
  - examples (repeatable)
  - translations per language (repeatable)
  - relations (repeatable, by type)
- Support reordering:
  - drag & drop senses → updates `sense_no`
  - drag & drop within lists → updates `rank`
- Autosave draft:
  - local draft (localStorage) + server draft (optional)
- Validate client-side:
  - required fields (lemma + at least one sense definition)
  - max length and safe characters (do **not** strip diacritics)
- Display normalization warnings:
  - show if lemma differs between raw vs NFC (rare but important)

Deliverables:
- A single “Word editor” view mirroring the schema (Word header + Sense cards).
- A nested JSON payload conforming to the API schemas.

---

### 3.2 API Orchestrator Agent (Backend)
**Goal**: accept nested payloads and persist them atomically.

Responsibilities:
- Provide **transactional** create/update for full WordEntry graph:
  - `POST /word-entries`
  - `PUT /word-entries/{id}`
- Validate payload (server-side is authoritative):
  - ensure `sense_no` is contiguous or reassign deterministically
  - validate `lang_code` values (e.g., fr/en)
  - enforce constraints (unique lemma, required fields)
- Persist in a single DB transaction:
  - either “replace children” strategy or “stable-ID diff” strategy (see below)
- Return normalized server representation:
  - IDs for all nested objects
  - resolved relations (when `related_word_entry_id` present)

Recommended update strategies:
- **Replace-children** (simple): delete senses + children, insert new.
- **Stable-ID diff** (best for audit): update by IDs, insert missing, delete removed.

---

### 3.3 Normalization & Search Agent
**Goal**: guarantee Unicode correctness and consistent search behavior.

Responsibilities:
- Normalize user input to NFC for deduplication:
  - compute `lemma_nfc = NFC(lemma_raw)`
- Optionally compute searchable forms:
  - `lemma_folded` (casefolded; diacritic-stripped only if needed for search UX)
- Provide search endpoints that use normalized fields:
  - `GET /dictionary?search=...`
- Provide collision detection:
  - if another entry already exists with same `(language_id, lemma_nfc)` → reject or merge.

Guardrails:
- Never destroy diacritics in stored “raw” text.
- If you do folding, keep it **secondary** (search-only).

---

### 3.4 Relations Resolution Agent
**Goal**: keep synonyms/antonyms consistent and linkable.

Responsibilities:
- When user types a synonym/antonym:
  - attempt to match existing `WordEntry` by `(language_id, lemma_nfc)`
  - if found → store `related_word_entry_id`
  - if not found → store `fallback_text`
- Provide UI-assisted linking:
  - autocomplete suggestions by lemma
  - ability to “create missing related word” later

---

### 3.5 QA/Test Agent
**Goal**: ensure correctness under real usage patterns.

Responsibilities:
- Unit tests:
  - Unicode normalization (NFD vs NFC)
  - uniqueness constraints
  - nested create/update behaviors
- Integration tests:
  - create WordEntry with multiple senses and children
  - update: reorder senses and examples
  - update: delete a sense and ensure cascade
- Security tests:
  - auth required for write endpoints
  - reject unauthorized writes
- Regression tests for known issues:
  - expired/invalid token flows (401 handling)
  - HAR capture scenarios

---

## 4) API Contract (Recommended)

### 4.1 Create / Update Payload (Nested)

```json
{
  "language_id": 1,
  "lemma_raw": "wúzɑ̄",
  "pos": "noun",
  "status": "draft",
  "senses": [
    {
      "id": null,
      "sense_no": 1,
      "definition_text": "…",
      "examples": [
        {"id": null, "example_text": "…", "rank": 1}
      ],
      "translations": [
        {"id": null, "lang_code": "fr", "translation_text": "…", "rank": 1},
        {"id": null, "lang_code": "en", "translation_text": "…", "rank": 1}
      ],
      "relations": [
        {"id": null, "relation_type": "synonym", "related_word_entry_id": null, "fallback_text": "…", "rank": 1}
      ]
    }
  ]
}
```

### 4.2 Responses
Return the same structure with server-assigned IDs and normalized fields (`lemma_nfc`).

---

## 5) Validation Rules

Minimum viable entry:
- `lemma_raw` is required
- at least **one** Sense with non-empty `definition_text`

Recommended limits:
- lemma: 1–128 chars
- definition: up to 10k chars
- example: up to 2k chars
- translation: up to 256 chars

Normalization:
- store raw as-is
- compute and store `lemma_nfc` server-side

---

## 6) Authentication & Authorization (Write Safety)

- All write endpoints (POST/PUT/DELETE) require **Bearer access token**
- Read endpoints may be public or partially public (your choice)
- Implement refresh-token flow:
  - if access token expired: refresh and retry once
- Log with `x-request-id` to correlate client and server.

---

## 7) Operational Notes

- Always use DB transactions for nested writes.
- Prefer Postgres with UTF-8 encoding.
- Add audit history if needed:
  - `word_entry_revision` storing JSON snapshots or diff logs.

---

## 8) Future Extensions (Designed-In)

This model supports:
- audio per Sense or per Example
- dialect/region tags per Sense
- usage frequency and corpus references
- export/import (JSON, CSV, LEX, XML)
- NLP pipelines (sense-aware translation, embedding per sense)

---

## 9) Definition of Done

An entry is “done” when:
- WordEntry saved with ≥ 1 Sense
- Each Sense can independently store its:
  - definition, examples, translations, relations
- UI accurately reflects DB structure (Sense cards)
- Unicode is preserved and normalized keys prevent duplicates
- Write endpoints are protected and tested
