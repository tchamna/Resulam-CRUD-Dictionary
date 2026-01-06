import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
	APP_NAME = "Quick API DEMO"
	DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

	JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
	JWT_ALG = "HS256"

	ACCESS_TOKEN_EXPIRES_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRES_MIN", "0"))
	REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRES_DAYS", "0"))

	SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@example.com")
	SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "superadmin")
	AUTO_SEED_ON_START = os.getenv("AUTO_SEED_ON_START", "false").lower() == "true"
	AUTO_CREATE_SUPER_ADMIN = os.getenv("AUTO_CREATE_SUPER_ADMIN", "false").lower() == "true"

	WORD_LIST_PATH = os.getenv("WORD_LIST_PATH", "nufi_word_list.txt")

	APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

	SMTP_HOST = os.getenv("SMTP_HOST", "")
	SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
	SMTP_USER = os.getenv("SMTP_USER", "")
	SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
	SMTP_FROM = os.getenv("SMTP_FROM", "")
	SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

	GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
	GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
	GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")

	S3_BUCKET = os.getenv("S3_BUCKET", "")
	S3_PREFIX = os.getenv("S3_PREFIX", "backups")
	S3_AUTO_BACKUP_ENABLED = os.getenv("S3_AUTO_BACKUP_ENABLED", "false").lower() == "true"
	S3_AUTO_BACKUP_MIN_INTERVAL_SEC = int(os.getenv("S3_AUTO_BACKUP_MIN_INTERVAL_SEC", "0"))
	S3_SNAPSHOT_RETENTION = int(os.getenv("S3_SNAPSHOT_RETENTION", "1"))
	S3_SQLITE_SNAPSHOT_ENABLED = os.getenv("S3_SQLITE_SNAPSHOT_ENABLED", "false").lower() == "true"
	S3_SQLITE_SNAPSHOT_RETENTION = int(os.getenv("S3_SQLITE_SNAPSHOT_RETENTION", "1"))

settings = Settings()
