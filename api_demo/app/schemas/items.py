from pydantic import BaseModel, Field

class ItemCreate(BaseModel):
	name: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9 _\-]+$")

class ItemUpdate(BaseModel):
	name: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9 _\-]+$")

class ItemOut(BaseModel):
	id: int
	name: str

	class Config:
		from_attributes = True
