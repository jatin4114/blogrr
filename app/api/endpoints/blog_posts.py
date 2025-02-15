from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc
from app.db.database import get_db
from app.schemas.blog_post_schema import BlogPostCreate, BlogPostResponse
from app.db.models.blog_posts import BlogPost
from app.db.models.post_comments import PostComment
from app.services.auth import get_current_user
from app.db.models.users import User
from typing import Optional, List

router = APIRouter()

@router.post("/new", response_model=BlogPostResponse)
def create_blog(
    blog: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"Creating blog: {blog}")  # Debug print
        new_blog = BlogPost(
            title=blog.title,
            body=blog.body,
            category=blog.category,
            creator_id=current_user.id
        )
        db.add(new_blog)
        db.commit()
        db.refresh(new_blog)
        return new_blog
    except Exception as e:
        print(f"Error creating blog: {str(e)}")  # Debug print
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create blog: {str(e)}"
        )

@router.get("/", response_model=List[BlogPostResponse])
def get_all_blogs(db: Session = Depends(get_db)):
    try:
        blogs = db.query(BlogPost).options(
            joinedload(BlogPost.comments).joinedload(PostComment.user),
            joinedload(BlogPost.creator)
        ).order_by(BlogPost.created_at.desc()).all()
        return blogs
    except Exception as e:
        print(f"Error fetching blogs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch blogs: {str(e)}"
        )

@router.get("/my-blogs", response_model=List[BlogPostResponse])
def get_user_blogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        blogs = db.query(BlogPost).filter(
            BlogPost.creator_id == current_user.id
        ).options(
            joinedload(BlogPost.comments).joinedload(PostComment.user),
            joinedload(BlogPost.creator)
        ).order_by(BlogPost.created_at.desc()).all()
        return blogs
    except Exception as e:
        print(f"Error fetching user blogs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user blogs: {str(e)}"
        )

@router.get("/{post_id}", response_model=BlogPostResponse)
def fetch_single_blog_post(post_id: int, db: Session = Depends(get_db)):
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return blog_post

@router.delete("/{post_id}")
def remove_blog_post(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.creator_id == current_user.id).first()
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found or unauthorized")
    db.delete(blog_post)
    db.commit()
    return {"detail": "Blog post removed successfully"}

@router.put("/{post_id}/update", response_model=BlogPostResponse)
def update_blog_post(
    post_id: int,
    data: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.creator_id == current_user.id).first()
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found or unauthorized")

    blog_post.title = data.title
    blog_post.body = data.body
    blog_post.category = data.category
    db.commit()
    db.refresh(blog_post)
    return blog_post
