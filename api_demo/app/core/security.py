from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=True)
optional_security = HTTPBearer(auto_error=False)

def _normalize_password(password: str) -> str:
	# bcrypt only considers the first 72 bytes; truncate consistently to avoid errors.
	raw = password.encode("utf-8")
	if len(raw) <= 72:
		return password
	return raw[:72].decode("utf-8", errors="ignore")

def hash_password(password: str) -> str:
	return pwd_context.hash(_normalize_password(password))

def verify_password(password: str, password_hash: str) -> bool:
	return pwd_context.verify(_normalize_password(password), password_hash)

def _create_token(subject: str, token_type: str, expires_delta: Optional[timedelta]) -> str:
	now = datetime.utcnow()
	payload = {
		"sub": subject,
		"type": token_type,  # "access" or "refresh"
		"iat": int(now.timestamp()),
	}
	if expires_delta and expires_delta.total_seconds() > 0:
		payload["exp"] = int((now + expires_delta).timestamp())
	return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def create_access_token(email: str) -> str:
	expires = settings.ACCESS_TOKEN_EXPIRES_MIN
	delta = None if expires <= 0 else timedelta(minutes=expires)
	return _create_token(email, "access", delta)

def create_refresh_token(email: str) -> str:
	expires = settings.REFRESH_TOKEN_EXPIRES_DAYS
	delta = None if expires <= 0 else timedelta(days=expires)
	return _create_token(email, "refresh", delta)

def decode_token(token: str) -> dict:
	ignore_exp = settings.ACCESS_TOKEN_EXPIRES_MIN <= 0 and settings.REFRESH_TOKEN_EXPIRES_DAYS <= 0
	if ignore_exp:
		return jwt.decode(
			token,
			settings.JWT_SECRET,
			algorithms=[settings.JWT_ALG],
			options={"verify_exp": False},
		)
	return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])

def get_current_user(
	request: Request,
	creds: HTTPAuthorizationCredentials = Depends(security),
	db: Session = Depends(get_db),
) -> User:
	token = creds.credentials
	try:
		payload = decode_token(token)
		if payload.get("type") != "access":
			raise HTTPException(status_code=401, detail="Invalid token type")
		email = payload.get("sub")
		if not email:
			raise HTTPException(status_code=401, detail="Invalid token")
	except JWTError:
		raise HTTPException(status_code=401, detail="Invalid or expired token")

	user = db.query(User).filter(User.email == email).first()
	if not user:
		raise HTTPException(status_code=401, detail="User not found")
	if user.is_deleted:
		raise HTTPException(status_code=401, detail="User not found")
	return user

def get_optional_user(
	request: Request,
	creds: HTTPAuthorizationCredentials | None = Depends(optional_security),
	db: Session = Depends(get_db),
) -> User | None:
	if not creds:
		return None
	token = creds.credentials
	try:
		payload = decode_token(token)
		if payload.get("type") != "access":
			raise HTTPException(status_code=401, detail="Invalid token type")
		email = payload.get("sub")
		if not email:
			raise HTTPException(status_code=401, detail="Invalid token")
	except JWTError:
		raise HTTPException(status_code=401, detail="Invalid or expired token")

	user = db.query(User).filter(User.email == email).first()
	if not user:
		raise HTTPException(status_code=401, detail="User not found")
	if user.is_deleted:
		raise HTTPException(status_code=401, detail="User not found")
	return user

def is_super_admin(user: User) -> bool:
	if not settings.SUPER_ADMIN_EMAIL:
		return False
	return user.email.lower() == settings.SUPER_ADMIN_EMAIL.lower()

def require_verified_user(user: User = Depends(get_current_user)) -> User:
	if is_super_admin(user):
		return user
	if not user.is_verified:
		raise HTTPException(status_code=403, detail="Email not verified")
	return user

def require_role(*allowed_roles: str):
	def _role_guard(user: User = Depends(get_current_user)) -> User:
		if is_super_admin(user):
			return user
		if user.role not in allowed_roles:
			raise HTTPException(status_code=403, detail="Forbidden")
		return user
	return _role_guard
