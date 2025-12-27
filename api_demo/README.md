# Resulam Dictionaries

FastAPI demo for building an African language dictionary with JWT auth and a lightweight UI.

## Features
- Register/login with access + refresh tokens.
- Role-based access with admin and super admin.
- Preloaded word list from a local file (Nufi by default).
- Case-insensitive search + pagination on word lists.
- Status filter (defined/undefined/all).
- Contributors can fill/update definitions and translations.
- Admin role management by email.
- Simple UI for contributing definitions with Clafrica input.

## Requirements
- Python 3.10+

## Setup
```bash
python -m venv venv
```

```bash
venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

## Run (local, SQLite)
```bash
uvicorn app.main:app --reload
```

Then open: http://localhost:8000/

## Run with Postgres (Docker)
```bash
docker compose up --build
```

The API will be available at http://localhost:8000/

## Configuration
Environment variables (defaults shown):
- `DATABASE_URL=sqlite:///./app.db`
- `JWT_SECRET=dev-secret-change-me`
- `ACCESS_TOKEN_EXPIRES_MIN=30`
- `REFRESH_TOKEN_EXPIRES_DAYS=14`
- `SUPER_ADMIN_EMAIL=superadmin@example.com`
- `SUPER_ADMIN_PASSWORD=superadmin`
- `WORD_LIST_PATH=nufi_word_list.txt`

## Super admin
On startup, the app creates (or updates) a super admin account using the env vars above.
The super admin bypasses role checks and can always manage roles.

## Database
SQLite database lives at `api_demo/app.db` when running locally.
Postgres is used when `DATABASE_URL` points to it (Docker compose does this by default).

## Word list preload
The app loads words from `WORD_LIST_PATH` into the Nufi language on startup if empty.
Default path: `nufi_word_list.txt` (project root).
Default languages: Nufi, Medumba, Ghomala', Yoruba.

## Dictionary fields
Each word can include:
- Definition
- Examples
- Synonyms
- Translation in French
- Translation in English

## Migrations (Postgres)
```bash
alembic upgrade head
```

If you change models:
```bash
alembic revision --autogenerate -m "your change"
alembic upgrade head
```

## Pagination + search
- `GET /dictionary?language_id=1&search=term&limit=50&offset=0`
- `GET /dictionary?language_id=1&status=defined`

## Key routes
Auth:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`

Dictionary:
- `GET /dictionary?language_id=...`
- `GET /dictionary/random?language_id=...&limit=10`
- `PUT /dictionary/{word_id}?language_id=...`
- `POST /dictionary`
- `GET /dictionary/languages`
- `POST /dictionary/languages`

Users:
- `GET /users` (admin/super admin)
- `GET /users/me`
- `PUT /users/role` (admin/super admin, or first admin bootstrap)

Health:
- `GET /health`

## Tests
```bash
pytest
```
