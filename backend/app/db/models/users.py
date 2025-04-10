from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Use string-based relationships for all relationships
    posts = relationship("BlogPost", back_populates="creator", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="sender")
    received_messages = relationship("ChatMessage", foreign_keys="ChatMessage.receiver_id", back_populates="receiver")
    
    # Group chat relationships
    group_memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    group_messages = relationship("GroupMessage", back_populates="sender")
    
    ## Contact relationships
    contacts = relationship("Contact", foreign_keys="[Contact.user_id]", back_populates="user")
