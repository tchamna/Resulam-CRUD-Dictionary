from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User
from app.schemas.auth import (
	RegisterRequest, LoginRequest, TokenResponse,
	RefreshRequest, ResetPasswordRequest, ResetPasswordConfirmRequest
)
from app.core.security import (
	hash_password, verify_password,
	create_access_token, create_refresh_token, decode_token,
)
from app.core.logging import log_event

router = APIRouter(prefix="/auth", tags=["auth"])

# For learning: in-memory reset tokens (replace with DB/email later)
reset_tokens = {}  # email -> token

@router.post("/register")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
	email = payload.email.lower()
	exists = db.query(User).filter(User.email == email).first()
	if exists:
		raise HTTPException(status_code=409, detail="Email already registered")

	user = User(email=email, password_hash=hash_password(payload.password), role="user")
	db.add(user)
	db.commit()

	log_event("user_registered", email=email, request_id=request.state.request_id)
	return {"status": "OK", "message": "Registered"}

@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
	email = payload.email.lower()
	user = db.query(User).filter(User.email == email).first()

	if not user or not verify_password(payload.password, user.password_hash):
		raise HTTPException(status_code=401, detail="Invalid credentials")

	access = create_access_token(email=email)
	refresh = create_refresh_token(email=email)

	log_event("user_login", email=email, request_id=request.state.request_id)
	return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}

@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
	try:
		p = decode_token(payload.refresh_token)
		if p.get("type") != "refresh":
			raise HTTPException(status_code=401, detail="Invalid refresh token")
		email = p.get("sub")
		if not email:
			raise HTTPException(status_code=401, detail="Invalid refresh token")
	except Exception:
		raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

	return {
		"access_token": create_access_token(email=email),
		"refresh_token": create_refresh_token(email=email),
		"token_type": "bearer",
	}

@router.post("/password-reset/request")
def password_reset_request(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
	# In production: always return OK (avoid account enumeration) and send email.
	email = payload.email.lower()
	user = db.query(User).filter(User.email == email).first()
	if user:
		# demo token (not secure for prod). replace with signed token + email flow.
		token = create_access_token(email=email)  # reuse access token as "reset token" demo
		reset_tokens[email] = token
	return {"status": "OK", "message": "If the account exists, a reset link/token was generated."}

@router.post("/password-reset/confirm")
def password_reset_confirm(payload: ResetPasswordConfirmRequest, db: Session = Depends(get_db)):
	# Demo: token is access token and must match stored token
	# Production: use separate token type + one-time-use store
	try:
		p = decode_token(payload.token)
		email = p.get("sub")
		if not email:
			raise HTTPException(status_code=400, detail="Invalid token")
	except Exception:
		raise HTTPException(status_code=400, detail="Invalid or expired token")

	if reset_tokens.get(email) != payload.token:
		raise HTTPException(status_code=400, detail="Invalid reset token")

	user = db.query(User).filter(User.email == email.lower()).first()
	if not user:
		raise HTTPException(status_code=400, detail="Invalid token")

	user.password_hash = hash_password(payload.new_password)
	db.commit()

	reset_tokens.pop(email, None)
	return {"status": "OK", "message": "Password updated"}
