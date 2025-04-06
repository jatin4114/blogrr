from pydantic import BaseModel, EmailStr
from typing import List, Optional

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        orm_mode = True

class UserBasic(BaseModel):
    id: int
    username: str
    email: EmailStr

    class Config:
        orm_mode = True

# Add a search response schema for pagination
class UserSearchResponse(BaseModel):
    items: List[UserBasic]
    total: int
    page: int
    size: int
    
    class Config:
        orm_mode = True
