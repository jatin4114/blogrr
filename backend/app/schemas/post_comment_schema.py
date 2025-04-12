from pydantic import BaseModel
from datetime import datetime
from app.schemas.user_schema import UserBasic

class PostCommentBase(BaseModel):
    text: str

class PostCommentCreate(PostCommentBase):
    pass

class PostCommentResponse(PostCommentBase):
    id: int
    blog_id: int
    user_id: int
    created_at: datetime
    user: UserBasic

    class Config:
        orm_mode = True
