from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
import secrets
from urllib.parse import urlencode
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, InviteCode, EmailVerification
from app.schemas.auth import (
	RegisterRequest, LoginRequest, TokenResponse,
	RefreshRequest, ResetPasswordRequest, ResetPasswordConfirmRequest,
	VerifyEmailRequest, VerifyEmailConfirmRequest, InviteCreateRequest
)
from app.core.security import (
	hash_password, verify_password,
	create_access_token, create_refresh_token, decode_token,
	require_role,
)
from app.core.logging import log_event
from app.core.emailer import send_email
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# For learning: in-memory reset tokens (replace with DB/email later)
reset_tokens = {}  # email -> token

@router.post("/register")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
	email = payload.email.lower()
	exists = db.query(User).filter(User.email == email).first()
	if exists:
		raise HTTPException(status_code=409, detail="Email already registered")

	invite = db.query(InviteCode).filter(InviteCode.code == payload.invite_code).first()
	if not invite or invite.used_at:
		raise HTTPException(status_code=403, detail="Invalid invite code")

	user = User(
		email=email,
		password_hash=hash_password(payload.password),
		role="user",
		auth_provider="local",
		is_verified=False,
	)
	db.add(user)
	db.flush()
	invite.used_by_id = user.id
	invite.used_at = datetime.utcnow()
	db.commit()

	token = secrets.token_urlsafe(32)
	verification = EmailVerification(
		user_id=user.id,
		token=token,
		expires_at=datetime.utcnow() + timedelta(hours=24),
	)
	db.add(verification)
	db.commit()

	link = f"{settings.APP_BASE_URL}/?verify_token={token}"
	error = send_email(
		email,
		"Verify your email",
		f"Verify your email by visiting: {link}",
	)
	if error:
		log_event("verify_email_send_failed", email=email, error=error, request_id=request.state.request_id)

	log_event("user_registered", email=email, request_id=request.state.request_id)
	response = {"status": "OK", "message": "Registered. Please verify your email."}
	if error:
		response["verification_token"] = token
	return response

@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
	email = payload.email.lower()
	user = db.query(User).filter(User.email == email).first()

	if not user or not verify_password(payload.password, user.password_hash):
		raise HTTPException(status_code=401, detail="Invalid credentials")
	if not user.is_verified:
		raise HTTPException(status_code=403, detail="Email not verified")

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

@router.post("/verify/request")
def request_verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
	email = payload.email.lower()
	user = db.query(User).filter(User.email == email).first()
	if not user:
		return {"status": "OK", "message": "If the account exists, a verification email was sent."}
	if user.is_verified:
		return {"status": "OK", "message": "Already verified."}

	token = secrets.token_urlsafe(32)
	verification = EmailVerification(
		user_id=user.id,
		token=token,
		expires_at=datetime.utcnow() + timedelta(hours=24),
	)
	db.add(verification)
	db.commit()

	link = f"{settings.APP_BASE_URL}/?verify_token={token}"
	send_email(
		email,
		"Verify your email",
		f"Verify your email by visiting: {link}",
	)
	return {"status": "OK", "message": "If the account exists, a verification email was sent."}

@router.post("/verify/confirm")
def confirm_verify_email(payload: VerifyEmailConfirmRequest, db: Session = Depends(get_db)):
	row = db.query(EmailVerification).filter(EmailVerification.token == payload.token).first()
	if not row or row.used_at:
		raise HTTPException(status_code=400, detail="Invalid token")
	if row.expires_at < datetime.utcnow():
		raise HTTPException(status_code=400, detail="Token expired")

	user = db.query(User).filter(User.id == row.user_id).first()
	if not user:
		raise HTTPException(status_code=400, detail="Invalid token")

	user.is_verified = True
	row.used_at = datetime.utcnow()
	db.commit()
	return {"status": "OK", "message": "Email verified"}

@router.post("/invites")
def create_invite(payload: InviteCreateRequest, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
	invites = []
	for _ in range(payload.quantity):
		code = secrets.token_urlsafe(8)
		row = InviteCode(code=code, created_by_id=user.id)
		db.add(row)
		invites.append(code)
	db.commit()
	return {"status": "OK", "codes": invites}

@router.get("/google/login")
def google_login(invite: str | None = None):
	if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_REDIRECT_URI:
		raise HTTPException(status_code=500, detail="Google OAuth not configured")
	state = invite or ""
	params = {
		"client_id": settings.GOOGLE_CLIENT_ID,
		"redirect_uri": settings.GOOGLE_REDIRECT_URI,
		"response_type": "code",
		"scope": "openid email profile",
		"state": state,
		"access_type": "offline",
		"prompt": "consent",
	}
	return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")

@router.get("/google/callback", response_model=TokenResponse)
def google_callback(code: str, state: str | None = None, db: Session = Depends(get_db)):
	if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_REDIRECT_URI:
		raise HTTPException(status_code=500, detail="Google OAuth not configured")

	token_res = httpx.post(
		"https://oauth2.googleapis.com/token",
		data={
			"code": code,
			"client_id": settings.GOOGLE_CLIENT_ID,
			"client_secret": settings.GOOGLE_CLIENT_SECRET,
			"redirect_uri": settings.GOOGLE_REDIRECT_URI,
			"grant_type": "authorization_code",
		},
		timeout=10,
	)
	if token_res.status_code != 200:
		raise HTTPException(status_code=400, detail="Google token exchange failed")
	access_token = token_res.json().get("access_token")
	if not access_token:
		raise HTTPException(status_code=400, detail="Google token missing")

	userinfo_res = httpx.get(
		"https://www.googleapis.com/oauth2/v3/userinfo",
		headers={"Authorization": f"Bearer {access_token}"},
		timeout=10,
	)
	if userinfo_res.status_code != 200:
		raise HTTPException(status_code=400, detail="Google user info failed")
	userinfo = userinfo_res.json()
	email = (userinfo.get("email") or "").lower()
	sub = userinfo.get("sub")
	if not email or not sub:
		raise HTTPException(status_code=400, detail="Google user info incomplete")

	user = db.query(User).filter(User.email == email).first()
	if not user:
		if not state:
			raise HTTPException(status_code=403, detail="Invite code required")
		invite = db.query(InviteCode).filter(InviteCode.code == state).first()
		if not invite or invite.used_at:
			raise HTTPException(status_code=403, detail="Invalid invite code")
		user = User(
			email=email,
			password_hash=hash_password(secrets.token_urlsafe(16)),
			role="user",
			auth_provider="google",
			google_sub=sub,
			is_verified=True,
		)
		db.add(user)
		db.flush()
		invite.used_by_id = user.id
		invite.used_at = datetime.utcnow()
		db.commit()
	else:
		user.auth_provider = "google"
		user.google_sub = sub
		if not user.is_verified:
			user.is_verified = True
		db.commit()

	access = create_access_token(email=email)
	refresh = create_refresh_token(email=email)
	return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}
