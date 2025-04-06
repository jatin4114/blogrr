from sqlalchemy.orm import Session, joinedload
from app.db.models.blog_posts import BlogPost
from app.db.models.post_comments import PostComment
from app.db.models.users import User
from app.schemas.blog_post_schema import BlogPostCreate
from typing import List, Optional

def create_blog(blog: BlogPostCreate, user_id: int, db: Session):
    """
    Creates a new blog post.
    """
    new_blog = BlogPost(
        title=blog.title,
        body=blog.body,
        category=blog.category,
        creator_id=user_id
    )
    db.add(new_blog)
    db.commit()
    db.refresh(new_blog)
    return new_blog

def get_all_blogs(db: Session):
    """
    Retrieves all blog posts.
    """
    return db.query(BlogPost).options(
        joinedload(BlogPost.comments).joinedload(PostComment.user),
        joinedload(BlogPost.creator)
    ).order_by(BlogPost.created_at.desc()).all()

def get_user_blogs(user_id: int, db: Session):
    """
    Retrieves blogs created by a specific user.
    """
    return db.query(BlogPost).filter(
        BlogPost.creator_id == user_id
    ).options(
        joinedload(BlogPost.comments).joinedload(PostComment.user),
        joinedload(BlogPost.creator)
    ).order_by(BlogPost.created_at.desc()).all()

def fetch_single_blog_post(post_id: int, db: Session):
    """
    Fetches a single blog post by ID.
    """
    return db.query(BlogPost).filter(BlogPost.id == post_id).first()

def remove_blog_post(post_id: int, user_id: int, db: Session):
    """
    Removes a blog post if the user is the owner.
    """
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.creator_id == user_id).first()
    if blog_post:
        db.delete(blog_post)
        db.commit()
        return True
    return False

def update_blog_post(post_id: int, data: BlogPostCreate, user_id: int, db: Session):
    """
    Updates a blog post if the user is the owner.
    """
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.creator_id == user_id).first()
    if blog_post:
        blog_post.title = data.title
        blog_post.body = data.body
        blog_post.category = data.category
        db.commit()
        db.refresh(blog_post)
        return blog_post
    return None
