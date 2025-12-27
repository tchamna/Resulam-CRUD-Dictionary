from sqlalchemy.orm import Session
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate
from fastapi import HTTPException, status

class ItemService:
    def __init__(self, db: Session):
        self.db = db

    def create_item(self, item: ItemCreate, user_id: int) -> Item:
        db_item = Item(**item.dict(), owner_id=user_id)
        self.db.add(db_item)
        self.db.commit()
        self.db.refresh(db_item)
        return db_item

    def get_item(self, item_id: int) -> Item:
        db_item = self.db.query(Item).filter(Item.id == item_id).first()
        if db_item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        return db_item

    def update_item(self, item_id: int, item: ItemUpdate, user_id: int) -> Item:
        db_item = self.get_item(item_id)
        if db_item.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this item")
        for key, value in item.dict(exclude_unset=True).items():
            setattr(db_item, key, value)
        self.db.commit()
        self.db.refresh(db_item)
        return db_item

    def delete_item(self, item_id: int, user_id: int) -> None:
        db_item = self.get_item(item_id)
        if db_item.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this item")
        self.db.delete(db_item)
        self.db.commit()