from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import Item
from app.schemas.items import ItemCreate, ItemUpdate, ItemOut
from app.core.security import get_current_user, require_role
from app.core.logging import log_event

router = APIRouter(prefix="/items", tags=["items"])

@router.get("", response_model=list[ItemOut])
def list_items(
	search: str | None = None,
	limit: int = Query(50, ge=1, le=200),
	offset: int = Query(0, ge=0),
	db: Session = Depends(get_db),
	user=Depends(require_role("admin")),
):
	query = db.query(Item)
	if search:
		query = query.filter(func.lower(Item.name).like(f"%{search.lower()}%"))
	rows = query.offset(offset).limit(limit).all()
	return rows

@router.get("/me", response_model=list[ItemOut])
def list_my_items(
	search: str | None = None,
	limit: int = Query(50, ge=1, le=200),
	offset: int = Query(0, ge=0),
	db: Session = Depends(get_db),
	user=Depends(get_current_user),
):
	query = db.query(Item).filter(Item.owner_id == user.id)
	if search:
		query = query.filter(func.lower(Item.name).like(f"%{search.lower()}%"))
	rows = query.offset(offset).limit(limit).all()
	return rows

@router.post("", response_model=ItemOut)
def create_item(
	request: Request,
	payload: ItemCreate,
	db: Session = Depends(get_db),
	user=Depends(get_current_user),
):
	item = Item(name=payload.name, owner_id=user.id)
	db.add(item)
	db.commit()
	db.refresh(item)

	log_event("item_created", item_id=item.id, owner=user.email, request_id=request.state.request_id)
	return item

@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
	item = db.query(Item).filter(Item.id == item_id).first()
	if not item:
		raise HTTPException(status_code=404, detail="Item not found")

	# Only owner can view (or admin)
	if item.owner_id != user.id and user.role != "admin":
		raise HTTPException(status_code=403, detail="Forbidden")

	return item

@router.put("/{item_id}", response_model=ItemOut)
def update_item(
	item_id: int,
	payload: ItemUpdate,
	db: Session = Depends(get_db),
	user=Depends(get_current_user),
):
	item = db.query(Item).filter(Item.id == item_id).first()
	if not item:
		raise HTTPException(status_code=404, detail="Item not found")

	if item.owner_id != user.id and user.role != "admin":
		raise HTTPException(status_code=403, detail="Forbidden")

	item.name = payload.name
	db.commit()
	db.refresh(item)
	return item

@router.delete("/{item_id}")
def delete_item(
	request: Request,
	item_id: int,
	db: Session = Depends(get_db),
	user=Depends(get_current_user),
):
	item = db.query(Item).filter(Item.id == item_id).first()
	if not item:
		raise HTTPException(status_code=404, detail="Item not found")

	# Demo policy:
	# - owner can delete own item
	# - admin can delete any item
	if item.owner_id != user.id and user.role != "admin":
		raise HTTPException(status_code=403, detail="Forbidden")

	db.delete(item)
	db.commit()
	log_event("item_deleted", item_id=item_id, actor=user.email, request_id=request.state.request_id)
	return {"status": "OK", "message": "Deleted"}
