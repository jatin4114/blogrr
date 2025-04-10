from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.websocket_service import manager
from app.services.group_chat_service import (
    create_group_chat, get_group_chat, get_user_groups,
    add_group_member, remove_group_member, update_member_role,
    store_group_message, get_group_messages
)
from app.schemas.group_chat_schema import (
    GroupChatCreate, GroupChatResponse, 
    GroupMemberCreate, GroupMemberResponse,
    GroupMessageCreate, GroupMessageResponse
)
from app.schemas.user_schema import UserBasic
from app.db.models.users import User
from app.db.models.group_chats import GroupMember, MemberRole
from app.core.auth import get_current_user
import logging
import traceback
from datetime import datetime
from typing import List, Optional, Dict
import json
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

# Check if Celery is available
try:
    from app.tasks.group_chat_tasks import store_group_message_task, notify_offline_members_task
    from app.services.redis_service import RedisService
    redis_service = RedisService()
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    logger.warning("Celery is not available, tasks will be executed synchronously")

# ---------- Regular API Endpoints ----------

@router.post("/groups", response_model=GroupChatResponse, status_code=201)
async def create_group(
    group_data: GroupChatCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new group chat with current user as super admin"""
    try:
        group = create_group_chat(db, group_data, current_user.id)
        return group
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to create group: {str(e)}")

@router.get("/groups", response_model=List[GroupChatResponse])
async def get_user_groups_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all groups that the current user is a member of"""
    try:
        # Make sure the function is imported from your service
        from app.services.group_chat_service import get_user_groups
        
        groups = get_user_groups(db, current_user.id)
        return groups
    except Exception as e:
        logger.error(f"Error getting user groups: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get user groups: {str(e)}")

@router.get("/groups/{group_id}", response_model=GroupChatResponse)
async def get_group_info(
    group_id: int = Path(..., gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details about a specific group chat"""
    # Check if user is a member of this group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    group = get_group_chat(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return group

@router.post("/groups/{group_id}/members", response_model=GroupMemberResponse, status_code=201)
async def add_member_to_group(
    group_id: int,
    member_data: GroupMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new member to the group (requires admin privileges)"""
    try:
        member = add_group_member(db, group_id, member_data, current_user.id)
        return member
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error adding group member: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add member: {str(e)}")

@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_member_from_group(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a member from the group (requires admin privileges or self-removal)"""
    try:
        removed = remove_group_member(db, group_id, user_id, current_user.id)
        return {"success": removed, "message": "Member removed successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error removing group member: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove member: {str(e)}")

@router.patch("/groups/{group_id}/members/{user_id}/role")
async def update_member_role_endpoint(
    group_id: int,
    user_id: int,
    role: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a member's role in the group (super admin only)"""
    try:
        # Validate the role
        if role not in [r.value for r in MemberRole]:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join([r.value for r in MemberRole])}")
        
        updated_member = update_member_role(db, group_id, user_id, role, current_user.id)
        return {"success": True, "user_id": user_id, "new_role": role}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error updating member role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update role: {str(e)}")

@router.post("/groups/{group_id}/messages", response_model=GroupMessageResponse)
async def send_group_message(
    group_id: int,
    message_data: GroupMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to a group chat (HTTP fallback method)"""
    try:
        # Ensure group_id in URL matches the one in the payload
        if group_id != message_data.group_id:
            raise HTTPException(status_code=400, detail="Group ID mismatch between URL and payload")
        
        # Store the message using the service
        if CELERY_AVAILABLE:
            # Use Celery for async processing
            task_data = {
                "group_id": group_id,
                "sender_id": current_user.id,
                "message": message_data.message
            }
            task = store_group_message_task.delay(task_data)
            # The result of store_group_message_task is now the actual message ID
            return JSONResponse(status_code=202, content={
                "message": "Message queued for delivery",
                "task_id": task.id,
                "info": "Message processing in progress"
            })
        else:
            # Direct database storage
            stored_message = store_group_message(db, message_data, current_user.id)
            # Manually trigger notification for offline members
            if stored_message:
                try:
                    # Pass the actual database message ID
                    message_id = stored_message.id
                    notify_offline_members_task.delay(group_id, message_id)
                except Exception as e:
                    logger.error(f"Failed to notify offline members: {str(e)}")
            return stored_message
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error sending group message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

@router.get("/groups/{group_id}/messages", response_model=List[GroupMessageResponse])
async def get_group_chat_messages(
    group_id: int,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent messages from a group chat"""
    try:
        messages = get_group_messages(db, group_id, current_user.id, limit)
        return messages
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting group messages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@router.get("/groups/{group_id}/members", response_model=List[Dict])
async def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a group with their roles"""
    # Check if user is a member of this group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Get all members with user details
    try:
        members = db.query(
            GroupMember, User
        ).join(
            User, User.id == GroupMember.user_id
        ).filter(
            GroupMember.group_id == group_id
        ).all()
        
        # Format the response
        result = []
        for member, user in members:
            result.append({
                "id": member.id,
                "user_id": user.id,
                "username": user.username,
                "role": member.role,
                "joined_at": member.joined_at.isoformat()
            })
        
        return result
    except Exception as e:
        logger.error(f"Error getting group members: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get members: {str(e)}")

# ---------- WebSocket Endpoint ----------

@router.websocket("/ws/group/{group_id}/{user_id}")
async def group_websocket_endpoint(
    websocket: WebSocket, 
    group_id: int, 
    user_id: int,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for real-time group chat"""
    # Check if the user is a member of the group
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if not member:
        # Reject the connection if user is not a member
        await websocket.accept()
        await websocket.send_json({"error": "You are not a member of this group"})
        await websocket.close(code=1008)  # Policy violation
        return
    
    # Generate a unique connection ID for this group-user combination
    connection_id = f"group:{group_id}:{user_id}"
    
    try:
        # Accept the connection
        await manager.connect(websocket, connection_id)
        
        # Add user to active members in Redis
        if CELERY_AVAILABLE:
            redis_service.add_user_to_active_group(group_id, user_id)
        
            # Send welcome message
            await websocket.send_json({
                "type": "system",
                "message": f"Connected to group {group_id}"
            })
            
            # Subscribe to Redis channel for this group
            pubsub = redis_service.redis_client.pubsub()
            channel = f"group:{group_id}"
            pubsub.subscribe(channel)
            
            # Create tasks for handling Redis messages and WebSocket messages
            async def redis_listener():
                """Listen for messages from Redis and forward to WebSocket"""
                for raw_message in pubsub.listen():
                    if raw_message["type"] == "message":
                        try:
                            # Parse the message from Redis
                            message_data = json.loads(raw_message["data"])
                            # Skip messages from the current user (they already see them)
                            if message_data.get("sender_id") == user_id:
                                continue
                            # Forward to the WebSocket
                            await websocket.send_json(message_data)
                        except Exception as e:
                            logger.error(f"Error processing Redis message: {e}")
            
            # Start the Redis listener task
            redis_task = asyncio.create_task(redis_listener())
        
        # Listen for messages from the WebSocket
        async def websocket_listener():
            """Listen for messages from the WebSocket and process them"""
            try:
                while True:
                    # Wait for messages from the client
                    data = await websocket.receive_json()
                    
                    # Validate the data
                    if "message" not in data:
                        await websocket.send_json({"type": "error", "message": "Missing 'message' field"})
                        continue
                    
                    # Create the message data
                    message_schema = GroupMessageCreate(
                        group_id=group_id,
                        message=data["message"]
                    )
                    
                    # Send to Celery task or directly store
                    if CELERY_AVAILABLE:
                        task_data = {
                            "group_id": group_id,
                            "sender_id": user_id,
                            "message": data["message"]
                        }
                        # Send to Celery for processing
                        task = store_group_message_task.delay(task_data)
                        # The task ID is not the message ID, so we can't use it directly
                        # Just send a placeholder ID for confirmation
                        message_id = "pending"  # We don't know the real ID yet
                    else:
                        # Direct DB storage if Celery isn't available
                        stored_message = store_group_message(db, message_schema, user_id)
                        message_id = stored_message.id
                    
                    # Send confirmation to the sender
                    await websocket.send_json({
                        "type": "confirmation",
                        "message_id": message_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except WebSocketDisconnect:
                # Handle normal disconnect
                logger.info(f"WebSocket disconnected for user {user_id} in group {group_id}")
                if CELERY_AVAILABLE:
                    redis_service.remove_user_from_active_group(group_id, user_id)
            except Exception as e:
                # Handle other errors
                logger.error(f"Error in WebSocket: {str(e)}")
                logger.error(traceback.format_exc())
        
        # Start the WebSocket listener task
        ws_task = asyncio.create_task(websocket_listener())
        
        # Wait for either task to complete
        done, pending = await asyncio.wait(
            [ws_task] + ([redis_task] if CELERY_AVAILABLE else []),
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel any pending tasks
        for task in pending:
            task.cancel()
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id} in group {group_id}")
        manager.disconnect(connection_id)
        if CELERY_AVAILABLE:
            redis_service.remove_user_from_active_group(group_id, user_id)
    except Exception as e:
        logger.error(f"Error in group WebSocket: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            await websocket.close(code=1011)  # Internal server error
        except:
            pass
        manager.disconnect(connection_id)
        if CELERY_AVAILABLE:
            redis_service.remove_user_from_active_group(group_id, user_id)
