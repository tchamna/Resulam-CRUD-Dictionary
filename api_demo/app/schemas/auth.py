
from pydantic import BaseModel, EmailStr, Field, validator

class RegisterRequest(BaseModel):
	email: EmailStr
	password: str = Field(min_length=8, max_length=72)

	@validator("password")
	def password_complexity(cls, v):
		if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
			raise ValueError("Password must contain at least one letter and one digit")
		return v

class LoginRequest(BaseModel):
	email: EmailStr
	password: str

class TokenResponse(BaseModel):
	access_token: str
	refresh_token: str
	token_type: str = "bearer"

class RefreshRequest(BaseModel):
	refresh_token: str

class ResetPasswordRequest(BaseModel):
	email: EmailStr

class ResetPasswordConfirmRequest(BaseModel):
	token: str
	new_password: str = Field(min_length=8, max_length=72)

	@validator("new_password")
	def new_password_complexity(cls, v):
		if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
			raise ValueError("Password must contain at least one letter and one digit")
		return v
