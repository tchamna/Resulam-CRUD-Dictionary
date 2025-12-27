from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.db.models import User, Word, InviteCode, EmailVerification
from app.core.security import require_role, get_current_user, is_super_admin

router = APIRouter(prefix="/users", tags=["users"])

class RoleUpdate(BaseModel):
	email: str
	role: str = Field(pattern="^(user|admin)$")

class VerifyUpdate(BaseModel):
	email: str

class DeduplicateRequest(BaseModel):
	email: str

@router.get("")
def list_users(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
	rows = db.query(User).all()
	return [
		{
			"id": u.id,
			"email": u.email,
			"role": u.role,
			"defined_count": u.defined_count,
			"is_verified": u.is_verified,
		}
		for u in rows
	]

@router.get("/me")
def get_me(user=Depends(get_current_user)):
	return {
		"id": user.id,
		"email": user.email,
		"role": user.role,
		"defined_count": user.defined_count,
		"is_verified": user.is_verified,
	}

@router.put("/role")
def update_role(
	payload: RoleUpdate,
	db: Session = Depends(get_db),
	current_user=Depends(get_current_user),
):
	admin_exists = db.query(User).filter(User.role == "admin").first()
	if admin_exists and current_user.role != "admin" and not is_super_admin(current_user):
		raise HTTPException(status_code=403, detail="Forbidden")
	email = payload.email.lower()
	target = db.query(User).filter(User.email == email).first()
	if not target:
		raise HTTPException(status_code=404, detail="User not found")
	target.role = payload.role
	db.commit()
	return {"status": "OK", "id": target.id, "email": target.email, "role": target.role}

@router.put("/verify")
def verify_user(
	payload: VerifyUpdate,
	db: Session = Depends(get_db),
	current_user=Depends(require_role("admin")),
):
	email = payload.email.lower()
	targets = db.query(User).filter(User.email == email).all()
	if not targets:
		raise HTTPException(status_code=404, detail="User not found")
	for target in targets:
		target.is_verified = True
	db.commit()
	return {"status": "OK", "email": email, "count": len(targets), "is_verified": True}

@router.put("/deduplicate")
def deduplicate_user(
	payload: DeduplicateRequest,
	db: Session = Depends(get_db),
	current_user=Depends(require_role("admin")),
):
	email = payload.email.lower()
	rows = db.query(User).filter(User.email == email).order_by(User.id.asc()).all()
	if len(rows) <= 1:
		return {"status": "OK", "email": email, "deleted": 0}

	keep = rows[0]
	duplicate_ids = [u.id for u in rows[1:]]
	if duplicate_ids:
		db.query(Word).filter(Word.updated_by_id.in_(duplicate_ids)).update(
			{Word.updated_by_id: keep.id}, synchronize_session=False
		)
		db.query(InviteCode).filter(InviteCode.used_by_id.in_(duplicate_ids)).update(
			{InviteCode.used_by_id: keep.id}, synchronize_session=False
		)
		db.query(InviteCode).filter(InviteCode.created_by_id.in_(duplicate_ids)).update(
			{InviteCode.created_by_id: keep.id}, synchronize_session=False
		)
		db.query(EmailVerification).filter(EmailVerification.user_id.in_(duplicate_ids)).update(
			{EmailVerification.user_id: keep.id}, synchronize_session=False
		)
		for dup_id in duplicate_ids:
			db.query(User).filter(User.id == dup_id).delete()

	db.commit()
	return {"status": "OK", "email": email, "deleted": len(duplicate_ids), "kept_id": keep.id}
