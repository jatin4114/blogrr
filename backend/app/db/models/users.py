from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Blog / Comment relationships
    posts = relationship("BlogPost", back_populates="creator", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="user", cascade="all, delete-orphan")

    # Direct Messages
    sent_messages = relationship("ChatMessage", foreign_keys="[ChatMessage.sender_id]", back_populates="sender", cascade="all, delete-orphan")
    received_messages = relationship("ChatMessage", foreign_keys="[ChatMessage.receiver_id]", back_populates="receiver", cascade="all, delete-orphan")

    # Group chats
    group_memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    group_messages = relationship("GroupMessage", back_populates="sender", cascade="all, delete-orphan")

    # Contact relationships (used only for contact list display)
    contacts = relationship("Contact", foreign_keys="[Contact.user_id]", back_populates="user", cascade="all, delete-orphan")
    reverse_contacts = relationship("Contact", foreign_keys="[Contact.contact_id]", back_populates="contact", cascade="all, delete-orphan")
