from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

class MemberRole(str, Enum):
    MEMBER = "member"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class GroupChatBase(BaseModel):
    name: str
    description: Optional[str] = None

class GroupChatCreate(GroupChatBase):
    pass

class GroupChatResponse(GroupChatBase):
    id: int
    created_at: datetime
    created_by_id: Optional[int]
    
    class Config:
        orm_mode = True

class GroupMemberBase(BaseModel):
    user_id: int
    role: MemberRole = MemberRole.MEMBER

class GroupMemberCreate(GroupMemberBase):
    pass

class GroupMemberResponse(GroupMemberBase):
    id: int
    group_id: int
    joined_at: datetime
    
    class Config:
        orm_mode = True

class GroupMessageBase(BaseModel):
    message: str

class GroupMessageCreate(GroupMessageBase):
    group_id: int

class GroupMessageResponse(GroupMessageBase):
    id: int
    group_id: int
    sender_id: int
    timestamp: datetime
    
    class Config:
        orm_mode = True
