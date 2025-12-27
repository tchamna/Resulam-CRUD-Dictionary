from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate
from app.services.item_service import ItemService
from app.dependencies import get_db, get_current_user

router = APIRouter()

@router.post("/", response_model=Item)
def create_item(item: ItemCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    return ItemService.create_item(db=db, item=item, user_id=current_user.id)

@router.get("/{item_id}", response_model=Item)
def read_item(item_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    item = ItemService.get_item(db=db, item_id=item_id, user_id=current_user.id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    updated_item = ItemService.update_item(db=db, item_id=item_id, item=item, user_id=current_user.id)
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@router.delete("/{item_id}", response_model=dict)
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    success = ItemService.delete_item(db=db, item_id=item_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"detail": "Item deleted successfully"}