from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.models.user import User
from app.schemas.user import UserCreate, UserInDB
from app.core.config import settings

class AuthService:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    @classmethod
    def hash_password(cls, password: str) -> str:
        return cls.pwd_context.hash(password)

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str) -> bool:
        return cls.pwd_context.verify(plain_password, hashed_password)

    @classmethod
    def create_access_token(cls, data: dict, expires_delta: timedelta = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @classmethod
    def get_user(cls, db, user_id: int) -> UserInDB:
        return db.query(User).filter(User.id == user_id).first()

    @classmethod
    def create_user(cls, db, user: UserCreate) -> UserInDB:
        hashed_password = cls.hash_password(user.password)
        db_user = User(**user.dict(), hashed_password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @classmethod
    def authenticate_user(cls, db, username: str, password: str) -> UserInDB:
        user = db.query(User).filter(User.username == username).first()
        if not user or not cls.verify_password(password, user.hashed_password):
            return False
        return user