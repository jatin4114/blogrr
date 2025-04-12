from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.user_schema import UserCreate, UserResponse, UserBasic, UserSearchResponse
from app.services.users_service import signup, login, handle_google_auth, search_users
from requests_oauthlib import OAuth2Session
from app.core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from fastapi.responses import RedirectResponse
import logging
from sqlalchemy import or_
import traceback
from app.core.auth import get_current_user
from app.db.models.users import User
from app.db.models.contacts import Contact  # Import the Contact model
from app.schemas.contact_schema import ContactResponse  # Import the ContactResponse schema
from pydantic import BaseModel

class AddContactRequest(BaseModel):
    contact_id: int


router = APIRouter()
module_logger = logging.getLogger(__name__)

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    return signup(user, db)

@router.post("/login")
def user_login(user: UserCreate, db: Session = Depends(get_db)):
    return login(user, db)

@router.post("/auth/google")
async def google_login():
    """
    Initialize Google OAuth flow and return authorization URL.
    """
    try:
        oauth = OAuth2Session(
            GOOGLE_CLIENT_ID,
            redirect_uri=GOOGLE_REDIRECT_URI,
            scope=["openid", "email", "profile"]
        )
        authorization_url, state = oauth.authorization_url(
            "https://accounts.google.com/o/oauth2/auth",
            access_type="offline",
            prompt="select_account"
        )
        return {"auth_url": authorization_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth initialization failed: {str(e)}"
        )

@router.get("/auth/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback.
    """
    try:
        oauth = OAuth2Session(GOOGLE_CLIENT_ID, redirect_uri=GOOGLE_REDIRECT_URI)
        token = oauth.fetch_token(
            "https://oauth2.googleapis.com/token",
            client_secret=GOOGLE_CLIENT_SECRET,
            code=code
        )
        user_info = oauth.get("https://www.googleapis.com/oauth2/v1/userinfo").json()
        email = user_info.get("email")
        name = user_info.get("name", "")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        auth_data = handle_google_auth(email, name, db)

        # Use /oauth/callback endpoint which is dedicated to handling OAuth redirects
        return RedirectResponse(
            url=f"http://localhost:5173/oauth/callback?access_token={auth_data['access_token']}&user_id={auth_data['user_id']}&username={auth_data['username']}",
            status_code=303
        )

    except Exception as e:
        module_logger.error(f"Google OAuth error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google OAuth error: {str(e)}"
        )

@router.get("/search", response_model=UserSearchResponse)
async def search_users_endpoint(
    search_term: str = Query(None, description="Search by username or email"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search for users by username or email.
    - The current user is excluded from results
    - Results are paginated
    - Use search_term to filter by username or email
    """
    try:
        result = search_users(
            db=db,
            search_term=search_term,
            page=page,
            size=size,
            current_user_id=current_user.id
        )
        return result
    except Exception as e:
        module_logger.error(f"Error in user search: {str(e)}")
        module_logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User search failed: {str(e)}"
        )

@router.get("/get_contacts", response_model=list[ContactResponse])
async def get_user_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all contacts for the current user.
    """
    try:
        # Fetch contacts for the current user
        contacts = db.query(Contact).filter(Contact.user_id == current_user.id).all()
        return contacts
    except Exception as e:
        module_logger.error(f"Error getting user contacts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get contacts"
        )



@router.post("/add_contact", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def add_contact(
    request: AddContactRequest,  # Use the Pydantic model for the request body
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a contact for the current user.
    """
    contact_id = request.contact_id  # Extract contact_id from the request body
    print(f"Received contact_id: {contact_id}")
    try:
        # Check if the contact already exists
        existing_contact = db.query(Contact).filter(
            Contact.user_id == current_user.id,
            Contact.contact_id == contact_id
        ).first()

        if existing_contact:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contact already exists"
            )

        # Add the contact
        new_contact = Contact(user_id=current_user.id, contact_id=contact_id)
        db.add(new_contact)
        db.commit()
        db.refresh(new_contact)
        return new_contact
    except Exception as e:
        module_logger.error(f"Error adding contact: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add contact"
        )
