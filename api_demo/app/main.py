from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.logging import request_id_middleware
from app.core.errors import validation_exception_handler
from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.db.models import User, Word, Language
from app.db.seed import resolve_word_list_path, seed_words, seed_languages

from app.routers.auth import router as auth_router
from app.routers.dictionary import router as dictionary_router
from app.routers.users import router as users_router
from app.core.security import hash_password


def seed_dictionary(session_factory, project_dir: Path, configured_path: str) -> None:
	word_list_path = resolve_word_list_path(project_dir, configured_path)
	db = session_factory()
	try:
		seed_languages(db, ["Nufi", "Medumba", "Ghomala'", "Yoruba"])
		nufi = db.query(Language).filter(Language.name == "Nufi").first()
		if nufi:
			seed_words(db, word_list_path, nufi, force=False)
	finally:
		db.close()

def create_app() -> FastAPI:
	app = FastAPI(title=settings.APP_NAME)

	base_dir = Path(__file__).resolve().parent
	project_dir = base_dir.parent
	static_dir = base_dir / "static"

	# DB init
	Base.metadata.create_all(bind=engine)
	seed_dictionary(SessionLocal, project_dir, settings.WORD_LIST_PATH)
	if settings.SUPER_ADMIN_EMAIL and settings.SUPER_ADMIN_PASSWORD:
		db = SessionLocal()
		try:
			email = settings.SUPER_ADMIN_EMAIL.lower()
			user = db.query(User).filter(User.email == email).first()
			if not user:
				user = User(
					email=email,
					password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
					role="super_admin",
					is_verified=True,
				)
				db.add(user)
			else:
				user.role = "super_admin"
				user.password_hash = hash_password(settings.SUPER_ADMIN_PASSWORD)
				user.is_verified = True
			db.commit()
		finally:
			db.close()

	# Middleware
	app.middleware("http")(request_id_middleware)

	# Validation error handler (consistent format)
	app.add_exception_handler(RequestValidationError, validation_exception_handler)

	# Routers
	app.include_router(auth_router)
	app.include_router(dictionary_router)
	app.include_router(users_router)

	app.mount("/static", StaticFiles(directory=static_dir), name="static")

	@app.get("/")
	def ui():
		return FileResponse(static_dir / "index.html")

	@app.get("/admin")
	def admin_ui():
		return FileResponse(static_dir / "index.html")

	@app.get("/health")
	def health():
		return {"status": "OK"}

	return app

app = create_app()
