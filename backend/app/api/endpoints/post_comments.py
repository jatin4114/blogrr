from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.schemas.post_comment_schema import PostCommentCreate, PostCommentResponse
from app.db.models.users import User
from app.core.auth import get_current_user
from app.services.post_comments_service import add_comment_to_post, get_post_comments

router = APIRouter()

@router.post("/{post_id}/add-comment", response_model=PostCommentResponse)
def add_comment(post_id: int, comment: PostCommentCreate, 
                db: Session = Depends(get_db), 
                current_user: User = Depends(get_current_user)):
    """
    Endpoint to add a comment to a blog post.
    """
    new_comment, error = add_comment_to_post(post_id, comment.text, current_user.id, db)
    if error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)
    return new_comment

@router.get("/{post_id}/comments", response_model=List[PostCommentResponse])
def get_comments(post_id: int, db: Session = Depends(get_db)):
    """
    Endpoint to fetch all comments for a blog post.
    """
    comments = get_post_comments(post_id, db)
    return comments
