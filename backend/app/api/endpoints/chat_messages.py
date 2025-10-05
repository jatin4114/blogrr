from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.websocket_service import manager
from app.services.chat_messages_service import store_message, get_undelivered_messages, mark_messages_as_delivered
from app.schemas.chat_message_schema import ChatMessageSchema
from app.db.models.users import User
from app.core.auth import get_current_user, verify_token, SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
import logging
from datetime import datetime
import traceback
from sqlalchemy import or_, and_
from app.db.models.chat_messages import ChatMessage
from typing import Optional

# Import tasks in a way that doesn't fail if celery is not available
try:
    from app.tasks.chat_messages_tasks import deliver_message_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

router = APIRouter()
logger = logging.getLogger(__name__)

# Add a test endpoint to verify routing works
@router.get("/chat/test")
async def test_chat_endpoint():
    return {"status": "Chat API is working"}

@router.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, db: Session = Depends(get_db)):
    # Log the connection attempt
    logger.info(f"WebSocket connection attempt for user_id: {user_id}")
    
    # Handle the case where the client sends "{user_id}" literally
    if user_id == "{user_id}" or "%7Buser_id%7D" in user_id:
        logger.warning("Client attempted to connect with literal {user_id} instead of an actual ID")
        await websocket.accept()
        await websocket.send_json({"error": "Please provide an actual user ID, not the template {user_id}"})
        await websocket.close(code=1008)
        return
    
    try:
        # Verify that user_id is numeric
        if not user_id.isdigit():
            logger.warning(f"Invalid user ID format (non-numeric): {user_id}")
            await websocket.accept()
            await websocket.send_json({"error": "User ID must be a numeric value"})
            await websocket.close(code=1008)
            return
            
        user_id_int = int(user_id)
        
        # Verify that the user exists in the database
        user = db.query(User).filter(User.id == user_id_int).first()
        if not user:
            logger.warning(f"Connection attempt with non-existent user ID: {user_id_int}")
            await websocket.accept()
            await websocket.send_json({"error": f"User with ID {user_id_int} does not exist"})
            await websocket.close(code=1008)
            return
            
        # Accept the connection only if the user exists
        await manager.connect(websocket, user_id_int)
        
        # Send a welcome message with user info
        await websocket.send_json({
            "type": "system", 
            "message": f"Connected as user {user.username} (ID: {user_id_int})"
        })
        
        # Send undelivered messages with improved handling
        try:
            logger.info(f"Checking for undelivered messages for user {user_id_int}")
            undelivered_messages = get_undelivered_messages(db, user_id_int)
            
            if undelivered_messages:
                await websocket.send_json({
                    "type": "system", 
                    "message": f"You have {len(undelivered_messages)} undelivered messages"
                })
                
                for msg in undelivered_messages:
                    logger.info(f"Sending undelivered message: {msg.id} from user {msg.sender_id}")
                    undelivered_payload = {
                        "type": "message",
                        "sender_id": msg.sender_id,
                        "message": msg.message,
                        "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                    }
                    if hasattr(msg, "image") and msg.image:
                        undelivered_payload["image"] = msg.image
                    await websocket.send_json(undelivered_payload)
                
                # Mark messages as delivered only after successfully sending them
                marked_count = mark_messages_as_delivered(db, user_id_int)
                logger.info(f"Marked {marked_count} messages as delivered for user {user_id_int}")
            else:
                logger.info(f"No undelivered messages for user {user_id_int}")
        except Exception as e:
            logger.error(f"Error retrieving or sending undelivered messages: {str(e)}")
            logger.error(traceback.format_exc())
            await websocket.send_json({"type": "error", "message": "Failed to retrieve messages"})
        
        # Message processing loop
        try:
            while True:
                # Wait for messages from the client
                data = await websocket.receive_json()
                logger.info(f"Received message from user {user_id_int}: {data}")
                
                # Validate the incoming data
                if not isinstance(data, dict) or "message" not in data:
                    await websocket.send_json({"type": "error", "message": "Invalid message format"})
                    continue
                
                # ENFORCE SENDER ID VALIDATION - sender_id must match the connected user_id
                data["sender_id"] = user_id_int  # Overwrite any sender_id to ensure it matches the websocket user
                
                if "receiver_id" not in data:
                    await websocket.send_json({"type": "error", "message": "Missing receiver_id"})
                    continue
                
                # Verify receiver exists
                receiver = db.query(User).filter(User.id == data["receiver_id"]).first()
                if not receiver:
                    await websocket.send_json({
                        "type": "error", 
                        "message": f"Receiver with ID {data['receiver_id']} does not exist"
                    })
                    continue
                
                # Create message schema
                try:
                    # Add timestamp if not provided
                    current_time = datetime.utcnow()
                    data["timestamp"] = current_time.isoformat()
                        
                    message_schema = ChatMessageSchema(
                        sender_id=user_id_int,  # Always use the authenticated user's ID
                        receiver_id=data["receiver_id"],
                        message=data["message"],
                        timestamp=current_time,
                        delivered=False,  # Explicitly set as undelivered
                        image=data.get("image")
                    )
                    
                    # Try Celery first, fall back to direct DB write
                    message_dict = message_schema.dict(exclude_none=True)
                    stored_message = None
                    message_id = None
                    
                    if CELERY_AVAILABLE:
                        try:
                            # Attempt to send via Celery
                            task_result = deliver_message_task.delay(message_dict)
                            logger.info(f"Message queued with Celery successfully: {task_result.id}")
                            message_id = task_result.id
                        except Exception as celery_error:
                            logger.error(f"Celery task failed: {str(celery_error)}")
                            logger.error(traceback.format_exc())
                            logger.warning("Falling back to direct DB write.")
                            # Direct DB write as fallback
                            stored_message = store_message(db, message_schema)
                            message_id = stored_message.id if stored_message else None
                            logger.info(f"Message stored directly in DB with ID: {message_id}")
                    else:
                        # If Celery wasn't imported, just store directly
                        stored_message = store_message(db, message_schema)
                        message_id = stored_message.id if stored_message else None
                        logger.info(f"Message stored directly in DB with ID: {message_id}")
                    
                    # Echo back for confirmation (include image if present)
                    confirmation_payload = {
                        "type": "confirmation",
                        "status": "sent", 
                        "message": data["message"],
                        "message_id": message_id
                    }
                    if data.get("image"):
                        confirmation_payload["image"] = data["image"]
                    await websocket.send_json(confirmation_payload)
                    
                    # If receiver is connected, send the message and mark it as delivered
                    if manager.is_connected(data["receiver_id"]):
                        logger.info(f"Receiver {data['receiver_id']} is connected, sending message directly")
                        receiver_payload = {
                            "type": "message",
                            "sender_id": data["sender_id"],
                            "message": data["message"],
                            "timestamp": data.get("timestamp") or datetime.utcnow().isoformat()
                        }
                        if data.get("image"):
                            receiver_payload["image"] = data["image"]
                        success = await manager.send_message(data["receiver_id"], receiver_payload)
                        
                        if success and stored_message:
                            # If we have direct access to the message object and delivery succeeded,
                            # mark it as delivered immediately
                            try:
                                stored_message.delivered = True
                                db.commit()
                                logger.info(f"Message {stored_message.id} marked as delivered immediately")
                            except Exception as db_error:
                                logger.error(f"Failed to mark message as delivered: {str(db_error)}")
                    else:
                        logger.info(f"Receiver {data['receiver_id']} is not connected, message will be delivered later")
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    await websocket.send_json({
                        "type": "error", 
                        "message": f"Failed to process message: {str(e)}"
                    })
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {user_id_int}")
            manager.disconnect(user_id_int)
        
    except ValueError:
        # If user_id is not a valid integer but should be
        logger.warning(f"Invalid user ID format: {user_id}")
        await websocket.accept()
        await websocket.send_json({"error": "Invalid user ID format"})
        await websocket.close(code=1008)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.accept()
            await websocket.send_json({"error": f"Server error: {str(e)}"})
            await websocket.close(code=1011)
        except:
            pass

# Add a simple HTTP endpoint for testing
@router.post("/chat/send")
async def send_chat_message(message: ChatMessageSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """HTTP fallback for sending messages when WebSockets aren't available"""
    try:
        # Enforce sender_id to be the current user's ID
        if message.sender_id != current_user.id:
            logger.warning(f"Attempted message spoofing: User {current_user.id} tried to send as {message.sender_id}")
            message.sender_id = current_user.id  # Force the correct sender ID
            
        # Verify receiver exists
        receiver = db.query(User).filter(User.id == message.receiver_id).first()
        if not receiver:
            raise HTTPException(status_code=404, detail=f"Receiver user with ID {message.receiver_id} not found")
            
        # Store message directly in the database
        stored_message = store_message(db, message)
        logger.info(f"Message stored via HTTP endpoint with ID: {stored_message.id}")
        
        # Try to deliver in real-time if receiver is connected
        realtime_delivery = False
        if manager.is_connected(message.receiver_id):
            await manager.send_message(message.receiver_id, {
                "type": "message",
                "sender_id": message.sender_id,
                "message": message.message,
                "timestamp": message.timestamp.isoformat() if message.timestamp else datetime.utcnow().isoformat()
            })
            realtime_delivery = True
            
        return {
            "status": "success",
            "message_id": stored_message.id,
            "delivered_realtime": realtime_delivery
        }
    except Exception as e:
        logger.error(f"Error in HTTP message sending: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

# Add Redis connection health check
@router.get("/chat/health")
async def check_redis_health():
    """Check if Redis is available for WebSocket functionality"""
    import redis
    import os
    
    redis_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    
    try:
        # Try to connect to Redis
        r = redis.from_url(redis_url)
        r.ping()
        return {"status": "healthy", "redis": "connected", "celery": CELERY_AVAILABLE}
    except redis.exceptions.ConnectionError:
        return {"status": "degraded", "redis": "disconnected", "celery": CELERY_AVAILABLE}
    except Exception as e:
        return {"status": "error", "message": str(e), "celery": CELERY_AVAILABLE}

@router.get("/chat/history/{user_id}/{other_user_id}")
async def get_chat_history(
    user_id: int, 
    other_user_id: int, 
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get chat history between two users"""
    from sqlalchemy import or_, and_
    from app.db.models.chat_messages import ChatMessage
    
    # Check if both users exist
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with ID {user_id} not found"
        )
        
    other_user = db.query(User).filter(User.id == other_user_id).first()
    if not other_user:
        raise HTTPException(
            status_code=404,
            detail=f"User with ID {other_user_id} not found"
        )
    
    # Get messages between these users (in either direction)
    messages = db.query(ChatMessage).filter(
        or_(
            and_(
                ChatMessage.sender_id == user_id,
                ChatMessage.receiver_id == other_user_id
            ),
            and_(
                ChatMessage.sender_id == other_user_id,
                ChatMessage.receiver_id == user_id
            )
        )
    ).order_by(ChatMessage.timestamp.desc()).limit(limit).all()
    
    # Format the messages
    formatted_messages = []
    for msg in messages:
        formatted = {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "message": msg.message,
            "timestamp": msg.timestamp.isoformat(),
            "delivered": msg.delivered
        }
        if hasattr(msg, "image") and msg.image:
            formatted["image"] = msg.image
        formatted_messages.append(formatted)
    return {"history": formatted_messages}

# Add new endpoint to mark messages as read
@router.post("/mark-read/{sender_id}")
async def mark_messages_as_read(
    sender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all messages from a specific sender to the current user as read.
    This endpoint is called when a user opens a chat with another user.
    """
    try:
        # Verify both users exist
        sender = db.query(User).filter(User.id == sender_id).first()
        if not sender:
            raise HTTPException(
                status_code=404,
                detail=f"Sender with ID {sender_id} not found"
            )
        
        # Update all unread messages from sender to current user
        result = db.query(ChatMessage).filter(
            and_(
                ChatMessage.sender_id == sender_id,
                ChatMessage.receiver_id == current_user.id,
                ChatMessage.delivered == True,  # Only update delivered messages
                or_(
                    ChatMessage.read.is_(None),
                    ChatMessage.read == False
                )
            )
        ).update({"read": True}, synchronize_session=False)
        
        db.commit()
        logger.info(f"Marked {result} messages as read from user {sender_id} to user {current_user.id}")
        
        return {"status": "success", "count": result}
    except Exception as e:
        logger.error(f"Error marking messages as read: {str(e)}")
        logger.error(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark messages as read: {str(e)}")

# Add endpoint to get unread message count
@router.get("/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the count of unread messages per sender for the current user.
    Used to display notification badges in the UI.
    """
    try:
        # Get counts of unread messages grouped by sender
        from sqlalchemy import func
        unread_counts = db.query(
            ChatMessage.sender_id,
            func.count(ChatMessage.id).label("count")
        ).filter(
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.delivered == True,
            or_(
                ChatMessage.read.is_(None),
                ChatMessage.read == False
            )
        ).group_by(ChatMessage.sender_id).all()
        
        # Format the response
        result = {
            "total": sum(count for _, count in unread_counts),
            "by_sender": {sender_id: count for sender_id, count in unread_counts}
        }
        
        return result
    except Exception as e:
        logger.error(f"Error getting unread message count: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get unread message count: {str(e)}")

async def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """
    Validate token and get the corresponding user
    """
    try:
        if not verify_token(token):
            logger.warning("Token verification failed")
            return None
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logger.warning("No sub claim in token")
            return None
        
        # Find user by email or username for flexibility
        user = db.query(User).filter(User.email == username).first()
        if not user:
            user = db.query(User).filter(User.username == username).first()
            
        return user
    except JWTError as e:
        logger.error(f"JWT error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        return None

