from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from app.api.endpoints import users
from app.api.endpoints import blog_posts, post_comments
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.services.auth import create_access_token, get_current_user, verify_user
from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import status
from app.db.models.users import User
from app.db.database import get_db, Base, engine
import logging
from fastapi.responses import Response
from sqlalchemy import text

# Initialize the FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:80","https://bloggr.jatinpanghal.com","http://localhost:5501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Optionally enforce HTTPS
# app.add_middleware(HTTPSRedirectMiddleware)

# Include routers
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(blog_posts.router, prefix="/blogs", tags=["Blogs"])
app.include_router(post_comments.router, prefix="/comments", tags=["Comments"])

# Serve static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="FastAPI Modular App",
        version="1.0.0",
        description="This is a modular FastAPI application with separate routers for Users, Blogs, and Comments.",
        routes=app.routes,
    )
    openapi_schema["info"]["contact"] = {
        "name": "Developer",
        "email": "developer@example.com",
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Welcome to the FastAPI Modular App",
        "version": "1.0.0",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }

# Health check endpoint
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

# Middleware to log incoming requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger = logging.getLogger("fastapi")
    logging.basicConfig(level=logging.INFO)
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Add this middleware before the CORS middleware
@app.middleware("http")
async def debug_request(request: Request, call_next):
    print(f"Request headers: {request.headers}")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    response = await call_next(request)
    
    print(f"Response status: {response.status_code}")
    print(f"Response headers: {response.headers}")
    
    return response

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    try:
        print(f"Login attempt for user: {form_data.username}")  # Debug log
        
        # Verify user credentials
        user = verify_user(form_data.username, form_data.password, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email/username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )
        
        # Return token and user info
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
            "username": user.username
        }
    except HTTPException as he:
        print(f"HTTP Exception in login: {str(he)}")
        raise he
    except Exception as e:
        print(f"Unexpected error in login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Add this function before creating tables
async def recreate_tables():
    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Replace the existing table creation with this
@app.on_event("startup")
async def startup_event():
    # Only create tables if they don't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)

@app.options("/{path:path}")
async def options_handler(request: Request):
    return Response(status_code=200)
