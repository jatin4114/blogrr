from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException
import logging
from typing import List, Dict, Any, Optional
import traceback

from app.db.models.group_chats import GroupChat, GroupMember, GroupMessage, MemberRole
from app.db.models.users import User
from app.schemas.group_chat_schema import GroupChatCreate, GroupMessageCreate, GroupMemberCreate
from app.services.redis_service import RedisService

logger = logging.getLogger(__name__)
redis_service = RedisService()

def create_group_chat(db: Session, group_data: GroupChatCreate, creator_id: int) -> GroupChat:
    """Create a new group chat with the creator as super admin"""
    try:
        # Create the group
        new_group = GroupChat(
            name=group_data.name,
            description=group_data.description,
            created_by_id=creator_id
        )
        db.add(new_group)
        db.flush()  # Get the ID without committing
        
        # Add creator as super admin
        new_member = GroupMember(
            group_id=new_group.id,
            user_id=creator_id,
            role=MemberRole.SUPER_ADMIN.value
        )
        db.add(new_member)
        db.commit()
        db.refresh(new_group)
        
        return new_group
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating group chat: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to create group chat: {str(e)}")

def get_group_chat(db: Session, group_id: int) -> Optional[GroupChat]:
    """Get a group chat by ID"""
    return db.query(GroupChat).filter(GroupChat.id == group_id).first()

def get_user_groups(db: Session, user_id: int):
    """Get all groups that a user is a member of"""
    try:
        # Query groups where the user is a member
        user_groups = db.query(GroupChat).join(
            GroupMember, GroupChat.id == GroupMember.group_id
        ).filter(
            GroupMember.user_id == user_id
        ).all()
        
        # Convert to response format
        result = []
        for group in user_groups:
            # Get group details
            group_data = {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "created_at": group.created_at.isoformat() if group.created_at else None,
                "created_by_id": group.created_by_id,
                "members": []
            }
            
            # Get member details
            members = db.query(GroupMember).filter(GroupMember.group_id == group.id).all()
            for member in members:
                member_data = {
                    "id": member.id,
                    "user_id": member.user_id,
                    "role": member.role,
                    "joined_at": member.joined_at.isoformat() if member.joined_at else None
                }
                group_data["members"].append(member_data)
            
            result.append(group_data)
        
        return result
    except Exception as e:
        logger.error(f"Error getting user groups: {str(e)}")
        logger.error(traceback.format_exc())
        raise Exception(f"Failed to get user groups: {str(e)}")

def add_group_member(db: Session, group_id: int, member_data: GroupMemberCreate, added_by_id: int) -> GroupMember:
    """
    Add a member to a group
    Only admins and super admins can add members
    """
    # Check if the user adding is an admin or super admin
    admin = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == added_by_id,
        or_(
            GroupMember.role == MemberRole.ADMIN.value,
            GroupMember.role == MemberRole.SUPER_ADMIN.value
        )
    ).first()
    
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can add members to groups")
    
    # Check if user already in group
    existing = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == member_data.user_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this group")
    
    # Verify user exists
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {member_data.user_id} not found")
    
    # Add new member
    new_member = GroupMember(
        group_id=group_id,
        user_id=member_data.user_id,
        role=member_data.role
    )
    
    try:
        db.add(new_member)
        db.commit()
        db.refresh(new_member)
        return new_member
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding group member: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add group member: {str(e)}")

def remove_group_member(db: Session, group_id: int, user_id: int, removed_by_id: int) -> bool:
    """
    Remove a member from a group
    Rules:
    1. Admins can remove regular members
    2. Super admin cannot be removed
    3. User can remove themselves (leave group)
    """
    # Get the member being removed
    member_to_remove = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member_to_remove:
        raise HTTPException(status_code=404, detail="User is not a member of this group")
    
    # Check if trying to remove super admin
    if member_to_remove.role == MemberRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin cannot be removed from the group")
    
    # User can remove themselves
    if user_id == removed_by_id:
        db.delete(member_to_remove)
        db.commit()
        return True
    
    # Otherwise, check if the user removing is an admin
    admin = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == removed_by_id,
        or_(
            GroupMember.role == MemberRole.ADMIN.value, 
            GroupMember.role == MemberRole.SUPER_ADMIN.value
        )
    ).first()
    
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    
    # All checks passed, remove the member
    db.delete(member_to_remove)
    db.commit()
    return True

def update_member_role(db: Session, group_id: int, user_id: int, new_role: str, updated_by_id: int) -> GroupMember:
    """
    Update a member's role in a group
    Rules:
    1. Only super admin can promote to admin
    2. Super admin role cannot be changed
    """
    # Get the updater's role
    updater = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == updated_by_id
    ).first()
    
    if not updater or updater.role != MemberRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Only super admin can change roles")
    
    # Get the member being updated
    member_to_update = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member_to_update:
        raise HTTPException(status_code=404, detail="User is not a member of this group")
    
    # Check if trying to change super admin role
    if member_to_update.role == MemberRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin role cannot be changed")
    
    # Update the role
    member_to_update.role = new_role
    db.commit()
    db.refresh(member_to_update)
    return member_to_update

def store_group_message(db: Session, message_data: GroupMessageCreate, sender_id: int) -> GroupMessage:
    """Store a message in the group chat"""
    # Check if sender is a member of the group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == message_data.group_id,
        GroupMember.user_id == sender_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Create the message
    new_message = GroupMessage(
        group_id=message_data.group_id,
        sender_id=sender_id,
        message=message_data.message
    )
    
    try:
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        
        # Publish to Redis for real-time delivery
        redis_channel = f"group:{message_data.group_id}"
        redis_message = {
            "type": "group_message",
            "message_id": new_message.id,
            "group_id": new_message.group_id,
            "sender_id": new_message.sender_id,
            "message": new_message.message,
            "timestamp": new_message.timestamp.isoformat()
        }
        redis_service.publish_message(redis_channel, redis_message)
        
        return new_message
    except Exception as e:
        db.rollback()
        logger.error(f"Error storing group message: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to store message: {str(e)}")

def get_group_messages(db: Session, group_id: int, user_id: int, limit: int = 50) -> List[GroupMessage]:
    """Get recent messages from a group chat"""
    # Check if user is a member of the group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Get messages
    messages = db.query(GroupMessage).filter(
        GroupMessage.group_id == group_id
    ).order_by(GroupMessage.timestamp.desc()).limit(limit).all()
    
    return messages
