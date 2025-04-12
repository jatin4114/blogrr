from pydantic import BaseModel
from datetime import datetime

class ChatMessageSchema(BaseModel):
    sender_id: int
    receiver_id: int
    message: str
    timestamp: datetime | None = None
    delivered: bool = False
    read: bool = False

    class Config:
        orm_mode = True
