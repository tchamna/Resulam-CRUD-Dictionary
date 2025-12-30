import sqlite3
import subprocess
import tempfile
import time
from pathlib import Path
from threading import Lock

from sqlalchemy.engine.url import make_url

from app.core.config import settings
from app.core.logging import log_event

_backup_lock = Lock()
_last_backup_at = 0.0


def backup_db_to_s3(reason: str = "commit") -> None:
	if not settings.S3_AUTO_BACKUP_ENABLED:
		return

	if not settings.S3_BUCKET:
		log_event("s3_backup_skipped", reason="missing_bucket")
		return

	min_interval = settings.S3_AUTO_BACKUP_MIN_INTERVAL_SEC
	now = time.time()
	with _backup_lock:
		global _last_backup_at
		if min_interval and now - _last_backup_at < min_interval:
			log_event("s3_backup_skipped", reason="throttled")
			return
		_last_backup_at = now

	try:
		_upload_database_backup(reason=reason)
	except Exception as exc:
		log_event("s3_backup_failed", reason=reason, error=str(exc))


def _upload_database_backup(reason: str) -> None:
	url = make_url(settings.DATABASE_URL)
	driver = url.drivername or ""
	prefix = settings.S3_PREFIX.strip("/") if settings.S3_PREFIX else "backups"
	timestamp = time.strftime("%Y%m%d-%H%M%S")

	if driver.startswith("sqlite"):
		source_path = Path(url.database or "").expanduser()
		if not source_path.is_absolute():
			source_path = (Path.cwd() / source_path).resolve()
		if not source_path.exists():
			raise FileNotFoundError(f"SQLite file not found: {source_path}")
		object_name = f"{prefix}/{source_path.stem}-{timestamp}.db"
		with tempfile.TemporaryDirectory() as temp_dir:
			tmp_path = Path(temp_dir) / f"{source_path.stem}-{timestamp}.db"
			_write_sqlite_backup(source_path, tmp_path)
			_upload_to_s3(tmp_path, object_name)
	else:
		db_name = url.database or "database"
		pg_url = _normalize_pg_url(url)
		object_name = f"{prefix}/{db_name}-{timestamp}.sql"
		with tempfile.TemporaryDirectory() as temp_dir:
			tmp_path = Path(temp_dir) / f"{db_name}-{timestamp}.sql"
			_dump_postgres(tmp_path, pg_url)
			_upload_to_s3(tmp_path, object_name)

	log_event("s3_backup_complete", reason=reason, object_key=object_name)


def _write_sqlite_backup(source_path: Path, dest_path: Path) -> None:
	source_conn = sqlite3.connect(str(source_path))
	dest_conn = sqlite3.connect(str(dest_path))
	try:
		with dest_conn:
			source_conn.backup(dest_conn)
	finally:
		dest_conn.close()
		source_conn.close()


def _dump_postgres(dest_path: Path, url) -> None:
	if hasattr(url, "render_as_string"):
		url_str = url.render_as_string(hide_password=False)
	else:
		url_str = str(url)
	with dest_path.open("wb") as handle:
		result = subprocess.run(
			["pg_dump", url_str],
			check=False,
			stdout=handle,
			stderr=subprocess.PIPE,
		)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))


def _upload_to_s3(local_path: Path, object_key: str) -> None:
	remote_uri = f"s3://{settings.S3_BUCKET}/{object_key}"
	result = subprocess.run(
		["aws", "s3", "cp", str(local_path), remote_uri],
		check=False,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE,
	)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))


def _normalize_pg_url(url):
	driver = url.drivername or ""
	if "+" in driver:
		driver = driver.split("+", 1)[0]
	if driver and driver != url.drivername:
		return url.set(drivername=driver)
	return url
