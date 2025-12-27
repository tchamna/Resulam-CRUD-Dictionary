from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserOut
from app.services.auth_service import AuthService
from app.core.config import get_db

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    return AuthService.register_user(db=db, user=user)

@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    access_token = AuthService.authenticate_user(db=db, username=form_data.username, password=form_data.password)
    if not access_token:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserOut)
def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = AuthService.get_current_user(token=token, db=db)
    return user

@router.post("/token/refresh")
def refresh_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    new_token = AuthService.refresh_access_token(token=token, db=db)
    return {"access_token": new_token, "token_type": "bearer"}

@router.post("/reset-password")
def reset_password(email: str, db: Session = Depends(get_db)):
    success = AuthService.reset_password(email=email, db=db)
    if not success:
        raise HTTPException(status_code=400, detail="Error resetting password")
    return {"msg": "Password reset link sent"}