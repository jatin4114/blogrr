from pydantic import BaseModel
from datetime import datetime
from app.schemas.user_schema import UserBasic

class ContactBase(BaseModel):
    contact_id: int

class ContactCreate(ContactBase):
    pass

class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    contact: UserBasic

    class Config:
        orm_mode = True