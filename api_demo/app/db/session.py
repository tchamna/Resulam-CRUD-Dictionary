from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from threading import Thread
from app.core.config import settings
from app.db.backup import backup_db_to_s3

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@event.listens_for(SessionLocal, "before_commit")
def _mark_session_backup(session):
	if session.new or session.dirty or session.deleted:
		session.info["needs_s3_backup"] = True

@event.listens_for(SessionLocal, "after_commit")
def _run_session_backup(session):
	if session.info.pop("needs_s3_backup", False):
		Thread(target=backup_db_to_s3, kwargs={"reason": "commit"}, daemon=True).start()

def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
