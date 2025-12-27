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

settings = Settings()
