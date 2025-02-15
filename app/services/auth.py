import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.db.models.users import User
from app.services.hashing import verify_password
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from app.db.database import get_db
from fastapi.security import OAuth2PasswordBearer
from app.services.hashing import Hash
from dotenv import load_dotenv
load_dotenv()



SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")  # Default to HS256
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_user(username: str, password: str, db: Session):
    """
    Verify user credentials. Note: username parameter could be email
    """
    try:
        # Try to find user by email first
        user = db.query(User).filter(User.email == username).first()
        if not user:
            # If not found by email, try username
            user = db.query(User).filter(User.username == username).first()
        
        if not user:
            return None
            
        # Verify password using the Hash class
        if not Hash.verify_user(password, user.hashed_password):
            return None
            
        return user
    except Exception as e:
        print(f"Error in verify_user: {str(e)}")
        return None

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        if exp is None:
            return False
        # Check if token is expired
        if datetime.utcfromtimestamp(exp) < datetime.utcnow():
            return False
        return True
    except JWTError:
        return False

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Verify token is valid and not expired
        if not verify_token(token):
            raise credentials_exception

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
            
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise credentials_exception
            
        return user
    except JWTError:
        raise credentials_exception


