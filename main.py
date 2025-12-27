
import os
from datetime import datetime, timedelta
from typing import Dict

from dotenv import load_dotenv
from fastapi import  FastAPI, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
import bcrypt


load_dotenv()

app = FastAPI(title="Quick API DEMO")

# In-memory "DB" (for learning only)
users: Dict[str, Dict[str, str]] = {}  # email -> {"email": ..., "password_hash": ...}

# -------------------------
# Schemas
# -------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt truncates after 72 bytes


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# -------------------------
# Password hashing
# -------------------------
def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), 
                          password_hash.encode("utf-8"))


# -------------------------
# JWT config
# -------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "60"))


def create_access_token(subject: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

# -------------------------
# Auth dependency (protect routes)
# -------------------------
security = HTTPBearer(auto_error=True)

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, str]:
    token = creds.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token (missing sub)")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = users.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# -------------------------
# Routes
# -------------------------
@app.get("/")
def root():
    return {"message": "Welcome to my page"}


@app.get("/health")
def health():
    return {"status": "OK"}


@app.post("/auth/register")
def register(payload: RegisterRequest):
    email = payload.email.lower()

    if email in users:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Hash password
    password_hash = hash_password(payload.password)
    users[email] = {"email": email, "password_hash": password_hash}

    return {"status": "OK", "message": f"Registered: {email}"}


@app.post("/auth/login")
def login(payload: LoginRequest):
    email = payload.email.lower()
    user = users.get(email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=email)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me")
def me(user: Dict[str, str] = Depends(get_current_user)):
    # Protected endpoint
    return {"email": user["email"]}

