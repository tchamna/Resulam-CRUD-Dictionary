from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.db.models import User
from app.core.security import require_role, get_current_user, is_super_admin

router = APIRouter(prefix="/users", tags=["users"])

class RoleUpdate(BaseModel):
	email: str
	role: str = Field(pattern="^(user|admin)$")

@router.get("")
def list_users(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
	rows = db.query(User).all()
	return [{"id": u.id, "email": u.email, "role": u.role, "defined_count": u.defined_count} for u in rows]

@router.get("/me")
def get_me(user=Depends(get_current_user)):
	return {"id": user.id, "email": user.email, "role": user.role, "defined_count": user.defined_count}

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
