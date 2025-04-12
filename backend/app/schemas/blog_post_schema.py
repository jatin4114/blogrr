from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.post_comment_schema import PostCommentResponse
from app.schemas.user_schema import UserBasic

class BlogPostBase(BaseModel):
    title: str
    body: str
    category: str

class BlogPostCreate(BlogPostBase):
    pass

class BlogPostResponse(BlogPostBase):
    id: int
    creator_id: int
    created_at: datetime
    comments: List[PostCommentResponse] = []
    creator: UserBasic

    class Config:
        orm_mode = True
