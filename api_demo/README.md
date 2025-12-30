# Resulam Dictionaries

FastAPI demo for building an African language dictionary with JWT auth and a lightweight UI.

## Features
- Register/login with access + refresh tokens.
- Role-based access with admin and super admin.
- Preloaded word list from a local file (Nufi by default).
- Case-insensitive search + pagination on word lists.
- Status filter (defined/undefined/all).
- Contributors can fill/update definitions and translations (verified users only).
- Invite-only signup + email verification.
- Google OAuth login (optional).
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

## Run on EC2 with k3s + system nginx
This setup keeps the existing system nginx + Let’s Encrypt certs on the host,
and routes traffic to k3s via the ingress controller ClusterIP.

1) Install k3s and ingress-nginx (single-node).
2) Build images locally on the EC2 host and import them into k3s containerd.
3) Apply the manifests in `api_demo/k8s/`.
4) Point nginx to the ingress-nginx ClusterIP.

Example commands:
```bash
# build images
docker build -t local/api_demo_web:latest .
docker build -t local/api_demo_db:latest -f docker/postgres/Dockerfile .

# import into k3s containerd
docker save local/api_demo_web:latest | sudo k3s ctr images import -
docker save local/api_demo_db:latest | sudo k3s ctr images import -

# apply k8s manifests
sudo k3s kubectl apply -f k8s/namespace.yaml
sudo k3s kubectl apply -f k8s/api-demo.yaml
sudo k3s kubectl apply -f k8s/ingress.yaml

# update nginx to proxy to ingress ClusterIP (example)
# proxy_pass http://10.43.65.1:80;
```

Note: k3s installs Traefik by default. If you are using ingress-nginx, remove Traefik
to avoid iptables REJECT rules on 80/443.

## Configuration
Environment variables (defaults shown):
- `DATABASE_URL=sqlite:///./app.db`
- `JWT_SECRET=dev-secret-change-me`
- `ACCESS_TOKEN_EXPIRES_MIN=30`
- `REFRESH_TOKEN_EXPIRES_DAYS=14`
- `SUPER_ADMIN_EMAIL=superadmin@example.com`
- `SUPER_ADMIN_PASSWORD=superadmin`
- `WORD_LIST_PATH=nufi_word_list.txt`
- `APP_BASE_URL=http://localhost:8000`
- `SMTP_HOST=`
- `SMTP_PORT=587`
- `SMTP_USER=`
- `SMTP_PASSWORD=`
- `SMTP_FROM=`
- `SMTP_USE_TLS=true`
- `GOOGLE_CLIENT_ID=`
- `GOOGLE_CLIENT_SECRET=`
- `GOOGLE_REDIRECT_URI=`
- `S3_BUCKET=` (required for S3 backups)
- `S3_PREFIX=backups`
- `S3_AUTO_BACKUP_ENABLED=false`
- `S3_AUTO_BACKUP_MIN_INTERVAL_SEC=0`
- `S3_SNAPSHOT_RETENTION=5`
- `S3_SQLITE_SNAPSHOT_ENABLED=false`
- `S3_SQLITE_SNAPSHOT_RETENTION=1`

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

## WAL archiving + PITR (S3)
This project supports WAL-G for continuous WAL archiving and point-in-time recovery.

Required env vars:
- `WALG_S3_PREFIX=s3://your-bucket/wal`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or attach an IAM role to EC2)

Base backups:
```bash
./scripts/backup_walg.sh
```

Restore (PITR outline):
1) Stop the db container.
2) Restore a base backup:
```bash
docker compose -f api_demo/docker-compose.yml exec -T db wal-g backup-fetch /var/lib/postgresql/data LATEST
```
3) Set `recovery_target_time` (or other target) in `postgresql.conf`, then start db.

Note: Use WAL-G + periodic base backups for professional-grade recovery.

## Automatic S3 backups on writes
When `S3_AUTO_BACKUP_ENABLED=true`, each DB commit that changes data triggers a full
backup to S3. SQLite uses a consistent file backup; Postgres uses `pg_dump`. This
requires the AWS CLI and (for Postgres) `pg_dump` to be available in the runtime.

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
- `POST /auth/verify/request`
- `POST /auth/verify/confirm`
- `POST /auth/invites` (admin)
- `GET /auth/google/login`
- `GET /auth/google/callback`

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
