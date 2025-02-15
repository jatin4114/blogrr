from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.database import get_db
from app.schemas.post_comment_schema import PostCommentCreate, PostCommentResponse
from app.db.models.post_comments import PostComment
from app.db.models.blog_posts import BlogPost
from app.services.auth import get_current_user
from app.db.models.users import User
from typing import List

router = APIRouter()

@router.post("/{post_id}/add-comment", response_model=PostCommentResponse)
def add_comment_to_post(
    post_id: int,
    comment: PostCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Check if blog post exists
        blog_post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
        if not blog_post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Blog post not found"
            )

        # Create new comment
        new_comment = PostComment(
            text=comment.text,
            blog_id=post_id,
            user_id=current_user.id
        )
        
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        return new_comment
        
    except Exception as e:
        print(f"Error adding comment: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )

@router.get("/{post_id}/comments", response_model=List[PostCommentResponse])
def get_post_comments(post_id: int, db: Session = Depends(get_db)):
    try:
        comments = db.query(PostComment).options(
            joinedload(PostComment.user)
        ).filter(PostComment.blog_id == post_id).all()
        return comments
    except Exception as e:
        print(f"Error fetching comments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comments"
        )
