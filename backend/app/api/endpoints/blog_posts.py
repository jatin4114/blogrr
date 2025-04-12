from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.schemas.blog_post_schema import BlogPostCreate, BlogPostResponse
from app.db.models.users import User
from app.core.auth import get_current_user
from app.services.blog_posts_service import (
    create_blog, get_all_blogs, get_user_blogs, 
    fetch_single_blog_post, remove_blog_post, update_blog_post
)

router = APIRouter()

@router.post("/new", response_model=BlogPostResponse)
def create_new_blog(
    blog: BlogPostCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint to create a new blog post.
    """
    return create_blog(blog, current_user.id, db)

@router.get("/", response_model=List[BlogPostResponse])
def fetch_all_blogs(db: Session = Depends(get_db)):
    """
    Endpoint to fetch all blog posts.
    """
    return get_all_blogs(db)

@router.get("/my-blogs", response_model=List[BlogPostResponse])
def fetch_user_blogs(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint to fetch the blogs created by the logged-in user.
    """
    return get_user_blogs(current_user.id, db)

@router.get("/{post_id}", response_model=BlogPostResponse)
def fetch_blog_post(post_id: int, db: Session = Depends(get_db)):
    """
    Endpoint to fetch a single blog post by ID.
    """
    blog_post = fetch_single_blog_post(post_id, db)
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return blog_post

@router.delete("/{post_id}")
def delete_blog_post(
    post_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint to delete a blog post if the user is the owner.
    """
    success = remove_blog_post(post_id, current_user.id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Blog post not found or unauthorized")
    return {"detail": "Blog post removed successfully"}

@router.put("/{post_id}/update", response_model=BlogPostResponse)
def modify_blog_post(
    post_id: int, 
    data: BlogPostCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint to update a blog post if the user is the owner.
    """
    blog_post = update_blog_post(post_id, data, current_user.id, db)
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found or unauthorized")
    return blog_post
