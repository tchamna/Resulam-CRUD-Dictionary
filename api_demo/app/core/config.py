import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
	APP_NAME = "Quick API DEMO"
	DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

	JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
	JWT_ALG = "HS256"

	ACCESS_TOKEN_EXPIRES_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRES_MIN", "30"))
	REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRES_DAYS", "14"))

	SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@example.com")
	SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "superadmin")

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

settings = Settings()
