from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.schemas.user_schema import UserCreate
from app.db.models.users import User
from app.core.hashing import Hash, verify_password
from app.core.auth import create_access_token
from datetime import timedelta
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from sqlalchemy import or_  # Add missing import for or_
import logging  # Add logging import
import traceback  # Add traceback import

# Set up logger
logger = logging.getLogger(__name__)

def signup(user: UserCreate, db: Session):
    """
    Sign up a new user by creating an entry in the database.
    """
    # Check if username already exists
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = Hash.bcrypt(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def login(user: UserCreate, db: Session):
    """
    Login the user by verifying email and password.
    """
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return {"message": f"Welcome, {db_user.username}!"}

def handle_google_auth(email: str, name: str, db: Session):
    """
    Handles Google OAuth authentication.
    If the user does not exist, create a new one.
    """
    import secrets
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Generate a random password since they're logging in with OAuth
        random_password = secrets.token_hex(16)
        hashed_password = Hash.bcrypt(random_password)

        # Use email prefix as username
        email_parts = email.split('@')
        username = email_parts[0]

        # Ensure username uniqueness
        if db.query(User).filter(User.username == username).first():
            domain_initial = email_parts[1][0].upper()
            username = f"{username}_{domain_initial}"

            counter = 1
            base_username = username
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

        # Create new user
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "access_token": access_token,
        "user_id": user.id,
        "username": user.username
    }

def search_users(db: Session, search_term: str, page: int = 1, size: int = 10, current_user_id: int = None):
    """
    Search users by username or email
    Pagination included, current user filtered out
    """
    try:
        # Calculate offset for pagination
        offset = (page - 1) * size
        
        # Build base query
        query = db.query(User)
        
        # Add search filter
        if search_term:
            search_filter = or_(
                User.username.ilike(f"%{search_term}%"),
                User.email.ilike(f"%{search_term}%")
            )
            query = query.filter(search_filter)
        
        # Filter out current user if specified
        if current_user_id:
            query = query.filter(User.id != current_user_id)
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        results = query.order_by(User.username).offset(offset).limit(size).all()
        
        return {
            "items": results,
            "total": total_count,
            "page": page,
            "size": size
        }
    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to search users: {str(e)}")
