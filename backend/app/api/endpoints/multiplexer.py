from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user, verify_token, SECRET_KEY, ALGORITHM
from app.db.models.users import User
from app.db.models.group_chats import GroupMember, GroupMessage, GroupChat
from app.db.models.chat_messages import ChatMessage
from jose import JWTError, jwt
from typing import Dict, List, Any, Optional, Set, Union
import logging
import traceback
import json
import asyncio
from datetime import datetime
import uuid
from pydantic import BaseModel, validator
import time
from .users import User

# Import services
from app.services.chat_messages_service import store_message, get_undelivered_messages, mark_messages_as_delivered
from app.services.group_chat_service import store_group_message, get_group_messages
from app.schemas.chat_message_schema import ChatMessageSchema
from app.schemas.group_chat_schema import GroupMessageCreate

# Configure logger
logger = logging.getLogger(__name__)

# Import Celery tasks directly and store references at module level
CELERY_AVAILABLE = False
deliver_message_task = None
store_group_message_task = None
notify_offline_members_task = None
redis_service = None

try:
    # Import each task individually with error handling for each one
    try:
        from app.tasks.chat_messages_tasks import deliver_message_task
        from app.tasks.group_chat_tasks import store_group_message_task, notify_offline_members_task
        from app.services.redis_service import RedisService
        redis_service = RedisService()
        
        # Only set CELERY_AVAILABLE to True if all imports succeeded
        if deliver_message_task and store_group_message_task and notify_offline_members_task and redis_service:
            CELERY_AVAILABLE = True
            logger.info("Successfully imported all Celery tasks and Redis service")
        else:
            logger.warning("Some Celery tasks or Redis service could not be imported")
    except ImportError as e:
        logger.error(f"ImportError for Celery tasks: {str(e)}")
    except Exception as e:
        logger.error(f"Error importing Celery tasks: {str(e)}")
except Exception as e:
    logger.error(f"Unexpected error setting up Celery: {str(e)}")

router = APIRouter()

@router.get("/multiplex/health")
async def multiplex_health_check():
    """Health check endpoint for the multiplexer service"""
    return {
        "status": "online",
        "websocket_endpoint": "/ws/multiplex",
        "active_connections": len(multiplexer.active_connections)
    }

@router.get("/ws/multiplex/info")
async def websocket_info():
    """Information about how to connect to the WebSocket endpoint"""
    return {
        "status": "available",
        "websocket_url": "ws://localhost:8000/ws/multiplex",
        "connection_steps": [
            "1. Connect to the WebSocket URL",
            "2. After connection, send authentication message with your token or user_id",
            "3. Authentication message format: { \"token\": \"your_jwt_token\" } or { \"user_id\": 123 }"
        ],
        "active_connections": len(multiplexer.active_connections),
        "note": "This is an HTTP endpoint. The actual WebSocket is at /ws/multiplex"
    }

@router.get("/multiplex/connection-test")
async def test_multiplexer_connection():
    """Test if multiplexer connection is working"""
    return {
        "status": "available",
        "active_connections": len(multiplexer.active_connections),
        "available_handlers": [
            "direct_message", "group_message", "presence", 
            "typing", "heartbeat", "read_receipt", "subscribe",
            "unsubscribe", "sync"
        ],
        "authentication_required": True,
        "auth_methods": ["JWT token", "user_id (development mode only)"]
    }

# Connection manager for the multiplexer
from app.services.redis_service import RedisService

class MultiplexerManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.user_subscriptions: Dict[int, Set[str]] = {}  # Tracks what channels each user is subscribed to
        self.presence_status: Dict[int, str] = {}  # Tracks user presence (online, away, offline)
        self.typing_status: Dict[str, Dict[int, float]] = {}  # Tracks typing indicators with timestamps
        self.last_activity: Dict[int, float] = {}  # For heartbeat tracking
        self.redis_service = RedisService()  # Redis service for tracking active users
        self.ACTIVE_USER_TTL = 60 * 60  # 1 hour expiration for active users
        
    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect a user and initialize their subscriptions and presence"""
        self.active_connections[user_id] = websocket
        self.user_subscriptions[user_id] = set()
        self.presence_status[user_id] = "online"
        self.last_activity[user_id] = time.time()

        # Mark user as connected in Redis with expiration
        self.redis_service.redis_client.sadd("active_users", user_id)
        # Set expiration on user's connection key separately (since sets don't support per-member expiry)
        self.redis_service.redis_client.set(f"user_active:{user_id}", "1", ex=self.ACTIVE_USER_TTL)
        logger.info(f"User {user_id} connected. Active users: {self.get_active_users()}")
    
    def disconnect(self, user_id: int):
        """Disconnect a user and clean up their subscriptions"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id in self.user_subscriptions:
            del self.user_subscriptions[user_id]
            
        if user_id in self.presence_status:
            self.presence_status[user_id] = "offline"
            del self.presence_status[user_id]
            
        if user_id in self.last_activity:
            del self.last_activity[user_id]
            
        # Clean up typing indicators
        for chat_id in list(self.typing_status.keys()):
            if user_id in self.typing_status[chat_id]:
                del self.typing_status[chat_id][user_id]
            # Remove empty chats
            if not self.typing_status[chat_id]:
                del self.typing_status[chat_id]

        # Remove user from Redis active users
        self.redis_service.redis_client.srem("active_users", user_id)
        # Delete connection key
        self.redis_service.redis_client.delete(f"user_active:{user_id}")
        logger.info(f"User {user_id} disconnected. Active users: {self.get_active_users()}")
    
    def is_connected(self, user_id: int) -> bool:
        """Check if a user is connected"""
        # First check Redis for active users
        if not self.redis_service.redis_client.exists(f"user_active:{user_id}"):
            # If key doesn't exist, ensure user is removed from active_users set
            self.redis_service.redis_client.srem("active_users", user_id)
            return False
            
        is_connected = self.redis_service.redis_client.sismember("active_users", user_id)
        # Refresh the TTL when checking
        if is_connected:
            self.redis_service.redis_client.expire(f"user_active:{user_id}", self.ACTIVE_USER_TTL)
        logger.debug(f"Checking connection status for user {user_id}: {'Connected' if is_connected else 'Not connected'}")
        return is_connected

    def get_active_users(self) -> Set[int]:
        """Get the list of active users from Redis with validation"""
        active_users = set()
        for user_id in self.redis_service.redis_client.smembers("active_users"):
            # Verify each user has a valid activity key
            if self.redis_service.redis_client.exists(f"user_active:{int(user_id)}"):
                active_users.add(int(user_id))
            else:
                # Clean up stale user from set
                self.redis_service.redis_client.srem("active_users", user_id)
                logger.info(f"Removed stale user {user_id} from active users set")
        return active_users
    
    async def clean_stale_connections(self):
        """Clean up stale connections"""
        logger.info("Cleaning stale connections")
        active_users = self.redis_service.redis_client.smembers("active_users")
        for user_id in active_users:
            # Check if user has valid activity key
            if not self.redis_service.redis_client.exists(f"user_active:{user_id}"):
                self.redis_service.redis_client.srem("active_users", user_id)
                logger.info(f"Removed stale user {user_id} from active users set during cleanup")
        
        # Check active_connections for consistency
        for user_id in list(self.active_connections.keys()):
            if not self.is_connected(user_id):
                logger.info(f"Removing inconsistent active connection for user {user_id}")
                if user_id in self.active_connections:
                    del self.active_connections[user_id]
        
        logger.info(f"After cleanup: {len(self.active_connections)} active connections")
    
    async def start_periodic_cleanup(self):
        """Start periodic cleanup of stale connections"""
        while True:
            await self.clean_stale_connections()
            await asyncio.sleep(300)  # Run every 5 minutes

    async def send_to_user(self, user_id: int, message: Dict) -> bool:
        """Send a message to a specific user"""
        if self.is_connected(user_id):
            try:
                await self.active_connections[user_id].send_json(message)
                logger.info(f"Message sent to user {user_id}: {message}")
                return True
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {str(e)}")
                return False
        logger.warning(f"Attempted to send message to user {user_id}, but they are not connected.")
        return False
    
    async def broadcast_to_users(self, user_ids: List[int], message: Dict) -> Dict[int, bool]:
        """Send a message to multiple users, return delivery status for each"""
        results = {}
        for user_id in user_ids:
            results[user_id] = await self.send_to_user(user_id, message)
        return results
    
    async def broadcast_presence(self, user_id: int, status: str):
        """Broadcast a user's presence change to relevant users"""
        # In a real app, you'd determine who should receive presence updates
        # For now, we'll broadcast to all connected users
        presence_msg = {
            "type": "presence",
            "user_id": user_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get all connected users except the one who changed status
        users_to_notify = [uid for uid in self.active_connections.keys() if uid != user_id]
        
        await self.broadcast_to_users(users_to_notify, presence_msg)

    def update_activity(self, user_id: int):
        """Update the last activity timestamp for a user"""
        if user_id in self.last_activity:
            self.last_activity[user_id] = time.time()
            logger.debug(f"Updated last activity for user {user_id}: {self.last_activity[user_id]}")
        else:
            logger.warning(f"Attempted to update activity for non-existent user {user_id}")

    def update_presence(self, user_id: int, status: str):
        """Update the presence status for a user"""
        valid_statuses = ["online", "away", "busy", "offline"]
        if status not in valid_statuses:
            logger.warning(f"Invalid presence status '{status}' for user {user_id}")
            return

        if user_id in self.presence_status:
            self.presence_status[user_id] = status
            logger.info(f"Updated presence for user {user_id}: {status}")
        else:
            logger.warning(f"Attempted to update presence for non-existent user {user_id}")

    def update_typing(self, chat_type: str, chat_id: str, user_id: int, is_typing: bool):
        """Update typing status for a user in a specific chat"""
        key = f"{chat_type}:{chat_id}"
        if key not in self.typing_status:
            self.typing_status[key] = {}

        if is_typing:
            # Update the typing timestamp
            self.typing_status[key][user_id] = time.time()
            logger.info(f"User {user_id} is typing in {key}")
        else:
            # Remove the user from typing status
            if user_id in self.typing_status[key]:
                del self.typing_status[key][user_id]
                logger.info(f"User {user_id} stopped typing in {key}")

            # Clean up empty entries
            if not self.typing_status[key]:
                del self.typing_status[key]

    def log_active_users(self):
        """Log the currently active user IDs"""
        active_users = self.get_active_users()
        logger.info(f"Currently active user IDs: {list(active_users)}")

    async def start_logging_active_users(self):
        """Periodically log active user IDs"""
        while True:
            self.log_active_users()
            await asyncio.sleep(60)  # Log every 60 seconds

# Initialize manager
multiplexer = MultiplexerManager()

# Start periodic logging and cleanup
asyncio.create_task(multiplexer.start_logging_active_users())
asyncio.create_task(multiplexer.start_periodic_cleanup())

# Add a startup cleanup to run immediately
asyncio.create_task(multiplexer.clean_stale_connections())

# Pydantic model for Message validation
class MultiplexedMessage(BaseModel):
    type: str
    content: Dict[str, Any]
    
    @validator('type')
    def validate_type(cls, v):
        valid_types = [
            "direct_message", "group_message", "presence", 
            "typing", "heartbeat", "read_receipt", "subscribe",
            "unsubscribe", "sync"
        ]
        if v not in valid_types:
            raise ValueError(f"Invalid message type: {v}. Must be one of {valid_types}")
        return v

# Helper function to validate and extract JWT token
async def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """Validate JWT token and return user"""
    try:
        if not token:
            return None
            
        # DEVELOPMENT MODE FEATURE: Allow numeric user_id as "token"
        if token.isdigit():
            is_dev_mode = True
            logger.warning("DEVELOPMENT MODE: Using numeric user_id instead of JWT token")
            user = db.query(User).filter(User.id == int(token)).first()
            if user:
                return user
        
        # PRODUCTION MODE: Standard JWT validation
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            return None
            
        # Find user by email or username (supports both formats)
        user = db.query(User).filter(User.email == username).first()
        if not user:
            user = db.query(User).filter(User.username == username).first()
            
        return user
    except JWTError:
        return None
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        return None

# WebSocket endpoint for the multiplexer
@router.websocket("/ws/multiplex")
async def multiplexer_endpoint(websocket: WebSocket):
    """
    Unified WebSocket endpoint that handles:
    - Direct messages
    - Group messages
    - Presence indicators
    - Typing indicators
    - Heartbeats
    - Message acknowledgments
    """
    # First, accept the connection unconditionally
    logger.info("New WebSocket connection attempt to multiplexer")
    await websocket.accept()
    logger.info("WebSocket connection accepted, waiting for authentication")
    
    auth_message = None
    user = None
    db = next(get_db())  # Get database session manually
    
    try:
        # Wait for authentication message with timeout
        logger.info("Waiting for authentication message...")
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
        logger.info(f"Received authentication message: {auth_message}")
        
        if not isinstance(auth_message, dict):
            logger.warning("Authentication message is not a JSON object")
            await websocket.send_json({"type": "error", "message": "Authentication message must be a JSON object"})
            await websocket.close(code=1008)  # Policy violation
            return
        
        # Look for token in various possible locations
        token = None
        
        # Option 1: Direct token field
        if "token" in auth_message:
            token = auth_message["token"]
            logger.info("Found token in 'token' field")
            
        # Option 2: Auth object with token field
        elif "auth" in auth_message and isinstance(auth_message["auth"], dict) and "token" in auth_message["auth"]:
            token = auth_message["auth"]["token"]
            logger.info("Found token in 'auth.token' field")
            
        # Option 3: Authorization header-style field
        elif "authorization" in auth_message:
            auth_header = auth_message["authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]  # Remove "Bearer " prefix
                logger.info("Found token in 'authorization' field with Bearer prefix")
                
        # Handle user_id directly for development mode
        user_id_direct = None
        if "user_id" in auth_message:
            user_id_direct = auth_message["user_id"]
            logger.info(f"Direct user_id provided: {user_id_direct}")
            # Validate user_id format
            if not str(user_id_direct).isdigit():
                logger.warning(f"Invalid user_id format (non-numeric): {user_id_direct}")
                await websocket.send_json({"type": "error", "message": "User ID must be a numeric value"})
                await websocket.close(code=1008)
                return
                
        if not token and not user_id_direct:
            logger.warning("No authentication token or user_id found in message")
            await websocket.send_json({"type": "error", "message": "Authentication required. Send token or user_id in the initial message."})
            await websocket.close(code=1008)
            return
            
        # If user_id is directly provided (development mode)
        if user_id_direct and str(user_id_direct).isdigit():
            logger.info(f"Attempting to authenticate with direct user_id: {user_id_direct}")
            user = db.query(User).filter(User.id == int(user_id_direct)).first()
            if user:
                logger.info(f"User authenticated via direct user_id: {user.username} (ID: {user.id})")
            else:
                logger.warning(f"User with ID {user_id_direct} not found")
                await websocket.send_json({"type": "error", "message": f"User with ID {user_id_direct} does not exist"})
                await websocket.close(code=1008)
                return
        else:
            # Validate token and get user
            logger.info("Validating JWT token...")
            user = await get_user_from_token(token, db)
            
        if not user:
            logger.warning("Invalid authentication token")
            await websocket.send_json({"type": "error", "message": "Invalid authentication token"})
            await websocket.close(code=1008)
            return
            
        user_id = user.id
        logger.info(f"User {user.username} (ID: {user_id}) authenticated successfully")
        
        # Complete connection setup
        logger.info(f"Setting up connection for user {user_id}")
        await multiplexer.connect(websocket, user_id)
        
        # Send welcome message
        logger.info(f"Sending welcome message to user {user_id}")
        await websocket.send_json({
            "type": "system",
            "message": f"Connected as {user.username} (ID: {user_id})",
            "timestamp": datetime.utcnow().isoformat(),
            "server_time": time.time()  # For time synchronization
        })
        
        # Process undelivered direct messages
        try:
            undelivered_messages = get_undelivered_messages(db, user_id)
            if undelivered_messages:
                await websocket.send_json({
                    "type": "system",
                    "message": f"You have {len(undelivered_messages)} undelivered messages"
                })
                
                for msg in undelivered_messages:
                    await websocket.send_json({
                        "type": "direct_message",
                        "message_id": str(msg.id),
                        "sender_id": msg.sender_id,
                        "message": msg.message,
                        "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                    })
                
                # Mark messages as delivered
                mark_messages_as_delivered(db, user_id)
        except Exception as e:
            logger.error(f"Error processing undelivered messages: {str(e)}")
            logger.error(traceback.format_exc())
            await websocket.send_json({
                "type": "error", 
                "message": "Failed to retrieve undelivered messages"
            })
            
        # Initialize Redis pub/sub if available
        pubsub = None
        if CELERY_AVAILABLE:
            try:
                pubsub = redis_service.redis_client.pubsub(ignore_subscribe_messages=True)
                logger.info(f"Redis PubSub initialized for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to initialize Redis PubSub: {str(e)}")
                pubsub = None
        else:
            logger.info("Redis/Celery unavailable, using direct message delivery only")
        
        # Create task for Redis message listener
        redis_task = None
        if CELERY_AVAILABLE and pubsub:
            async def redis_listener():
                """Listen for messages from Redis channels and forward to WebSocket"""
                if not pubsub:
                    logger.warning("Redis pubsub not available, skipping redis_listener task")
                    return
                    
                try:
                    # Listen in a loop
                    for message in pubsub.listen():
                        if message["type"] == "message":
                            try:
                                channel = message["channel"].decode("utf-8")
                                data = json.loads(message["data"])
                                
                                # For group messages, check if from another user
                                if (
                                    channel.startswith("group:") and 
                                    data.get("type") == "group_message" and
                                    data.get("sender_id") != user_id
                                ):
                                    # Forward to WebSocket
                                    await websocket.send_json(data)
                                    
                                # For presence updates
                                elif channel == "presence" and data.get("user_id") != user_id:
                                    await websocket.send_json(data)
                                    
                            except json.JSONDecodeError:
                                logger.error(f"Invalid JSON in Redis message: {message['data']}")
                            except Exception as e:
                                logger.error(f"Error processing Redis message: {str(e)}")
                except Exception as e:
                    logger.error(f"Redis listener error: {str(e)}")
                    logger.error(traceback.format_exc())
            
            redis_task = asyncio.create_task(redis_listener())
            
        # Set up heartbeat task
        async def heartbeat():
            """Send periodic heartbeats to client"""
            try:
                while True:
                    await asyncio.sleep(30)  # 30-second heartbeat
                    await websocket.send_json({
                        "type": "heartbeat",
                        "timestamp": datetime.utcnow().isoformat(),
                        "server_time": time.time()
                    })
                    multiplexer.update_activity(user_id)
            except asyncio.CancelledError:
                logger.info(f"Heartbeat task cancelled for user {user_id}")
            except Exception as e:
                logger.error(f"Heartbeat error for user {user_id}: {str(e)}")
                
        heartbeat_task = asyncio.create_task(heartbeat())
        
        # Main message processing loop
        try:
            while True:
                # Receive message from client
                raw_message = await websocket.receive_json()
                multiplexer.update_activity(user_id)
                
                # Validate message format
                try:
                    if "type" not in raw_message:
                        await websocket.send_json({
                            "type": "error", 
                            "message": "Message must include a 'type' field"
                        })
                        continue
                        
                    message_type = raw_message["type"]
                    
                    # Process based on message type
                    if message_type == "direct_message":
                        await handle_direct_message(raw_message, user_id, db, websocket)
                    elif message_type == "group_message":
                        await handle_group_message(raw_message, user_id, db, websocket)
                    elif message_type == "typing":
                        await handle_typing_indicator(raw_message, user_id, websocket)
                    elif message_type == "presence":
                        await handle_presence_update(raw_message, user_id, websocket)
                    elif message_type == "read_receipt":
                        await handle_read_receipt(raw_message, user_id, db, websocket)
                    elif message_type == "subscribe":
                        await handle_subscription(raw_message, user_id, db, websocket, pubsub)
                    elif message_type == "unsubscribe":
                        await handle_unsubscription(raw_message, user_id, pubsub, websocket)
                    elif message_type == "heartbeat":
                        # Simple acknowledgment of heartbeat
                        await websocket.send_json({
                            "type": "heartbeat_ack",
                            "timestamp": datetime.utcnow().isoformat(),
                            "server_time": time.time()
                        })
                    elif message_type == "sync":
                        await handle_sync_request(raw_message, user_id, db, websocket)
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Unsupported message type: {message_type}"
                        })
                        
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    logger.error(traceback.format_exc())
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Failed to process message: {str(e)}"
                    })
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {user_id}")
        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")
            logger.error(traceback.format_exc())
            
    except asyncio.TimeoutError:
        logger.warning("Authentication timeout - no auth message received within 10 seconds")
        await websocket.send_json({"type": "error", "message": "Authentication timeout"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected during authentication")
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            await websocket.send_json({"type": "error", "message": f"Server error: {str(e)}"})
            await websocket.close(code=1011)
        except:
            pass
    finally:
        # Clean up
        if user:
            logger.info(f"Disconnecting user {user.id}")
            multiplexer.disconnect(user.id)
            
            # Broadcast offline status to others
            if CELERY_AVAILABLE:
                try:
                    await multiplexer.broadcast_presence(user.id, "offline")
                    
                    # Publish to Redis for other servers
                    redis_service.publish_message("presence", {
                        "type": "presence",
                        "user_id": user.id,
                        "status": "offline",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception as e:
                    logger.error(f"Error broadcasting offline status: {str(e)}")
                    
        # Cancel tasks if they exist
        if 'heartbeat_task' in locals() and heartbeat_task:
            heartbeat_task.cancel()
            
        if 'redis_task' in locals() and redis_task:
            redis_task.cancel()
            
        # Unsubscribe from Redis channels
        if 'pubsub' in locals() and pubsub:
            try:
                pubsub.unsubscribe()
                pubsub.close()
            except:
                pass
        
        logger.info("WebSocket connection cleanup complete")

# Message handler functions
async def handle_direct_message(message: Dict, user_id: int, db: Session, websocket: WebSocket):
    """Handle a direct message"""
    # Add global statement to access module-level variableses
    global deliver_message_task, CELERY_AVAILABLE
    
    transaction_in_progress = False
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate required fields
        required_fields = ["receiver_id", "message"]
        for field in required_fields:
            if field not in content:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Missing required field: {field}"
                })
                return
                
        # Create a message object
        receiver_id = content["receiver_id"]
        message_text = content["message"]
        client_message_id = content.get("message_id", str(uuid.uuid4()))
        
        # Verify receiver exists
        receiver = db.query(User).filter(User.id == receiver_id).first()
        if not receiver:
            await websocket.send_json({
                "type": "error",
                "message": f"Receiver with ID {receiver_id} does not exist"
            })
            return
            
        # Create message schema
        current_time = datetime.utcnow()
        message_schema = ChatMessageSchema(
            sender_id=user_id,
            receiver_id=receiver_id,
            message=message_text,
            timestamp=current_time,
            delivered=False
        )
        
        # Store message (either via Celery or directly)
        message_dict = message_schema.dict(exclude_none=True)
        stored_message = None
        server_message_id = None
        
        if CELERY_AVAILABLE and deliver_message_task:
            try:
                # Use Celery for async processing
                task_result = deliver_message_task.delay(message_dict)
                logger.info(f"Message queued with Celery: {task_result.id}")
                server_message_id = task_result.id
            except Exception as celery_error:
                logger.error(f"Celery task failed: {str(celery_error)}")
                logger.warning("Falling back to direct DB write")
                transaction_in_progress = True
                stored_message = store_message(db, message_schema)
                server_message_id = stored_message.id
                transaction_in_progress = False
        else:
            # Direct database storage
            transaction_in_progress = True
            stored_message = store_message(db, message_schema)
            server_message_id = stored_message.id
            transaction_in_progress = False
            
        # Send confirmation to sender
        await websocket.send_json({
            "type": "confirmation",
            "message_id": client_message_id,
            "server_message_id": str(server_message_id),
            "timestamp": current_time.isoformat(),
            "status": "sent"
        })
        
        # Check if the receiver is online
        if multiplexer.is_connected(receiver_id):
            logger.info(f"Receiver {receiver_id} is online. Delivering message immediately.")
            success = await multiplexer.send_to_user(receiver_id, {
                "type": "direct_message",
                "message_id": str(server_message_id),
                "client_message_id": client_message_id,
                "sender_id": user_id,
                "message": message_text,
                "timestamp": current_time.isoformat()
            })
            
            # Log delivery status
            if success:
                logger.info(f"Message {server_message_id} successfully delivered to user {receiver_id}")
                # Mark the message as delivered in the database
                try:
                    # If we don't have stored_message (e.g. using Celery), get it from the DB
                    if not stored_message:
                        # Try to get the actual message ID from Celery if it completed
                        try:
                            from app.tasks.chat_messages_tasks import deliver_message_task
                            actual_msg_id = deliver_message_task.AsyncResult(server_message_id).get(timeout=1)
                            if actual_msg_id and isinstance(actual_msg_id, int):
                                logger.info(f"Retrieved actual message ID {actual_msg_id} from Celery result")
                                stored_message = db.query(ChatMessage).get(actual_msg_id)
                        except Exception as e:
                            logger.error(f"Could not get message ID from Celery: {str(e)}")
                    
                    # If we still don't have stored_message, query by sender, receiver and timestamp
                    if not stored_message:
                        logger.info("Finding message in database to mark as delivered")
                        stored_message = db.query(ChatMessage).filter(
                            ChatMessage.sender_id == user_id,
                            ChatMessage.receiver_id == receiver_id,
                            ChatMessage.message == message_text,
                            ChatMessage.delivered == False
                        ).order_by(ChatMessage.timestamp.desc()).first()
                        
                    if stored_message:
                        transaction_in_progress = True
                        stored_message.delivered = True
                        db.commit()
                        transaction_in_progress = False
                        logger.info(f"Message marked as delivered in the database: ID={stored_message.id}")
                    else:
                        logger.warning("Could not find message to mark as delivered")
                except Exception as db_error:
                    if transaction_in_progress:
                        db.rollback()
                    logger.error(f"Failed to mark message as delivered: {str(db_error)}")
            else:
                logger.warning(f"Failed to deliver message {server_message_id} to user {receiver_id}")
        else:
            logger.info(f"Receiver {receiver_id} is offline. Message will remain undelivered.")
    except Exception as e:
        # Ensure any database transaction is rolled back when an error occurs
        if transaction_in_progress:
            db.rollback()
        logger.error(f"Error handling direct message: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process direct message: {str(e)}"
        })

async def handle_group_message(message: Dict, user_id: int, db: Session, websocket: WebSocket):
    """Handle a group message"""
    # Add global declaration here too for consistency
    global CELERY_AVAILABLE, store_group_message_task, notify_offline_members_task, redis_service
    
    transaction_in_progress = False
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate required fields
        required_fields = ["group_id", "message"]
        for field in required_fields:
            if field not in content:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Missing required field: {field}"
                })
                return
                
        # Create a message object
        group_id = content["group_id"]
        message_text = content["message"]
        client_message_id = content.get("message_id", str(uuid.uuid4()))
        
        # Verify group exists and user is a member
        member = None
        try:
            member = db.query(GroupMember).filter(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id
            ).first()
        except Exception as query_error:
            logger.error(f"Database error checking group membership: {str(query_error)}")
            # Ensure transaction is rolled back
            db.rollback()
            await websocket.send_json({
                "type": "error",
                "message": "Database error checking group membership"
            })
            return
        
        if not member:
            await websocket.send_json({
                "type": "error",
                "message": "You are not a member of this group"
            })
            return
            
        # Create message schema
        message_schema = GroupMessageCreate(
            group_id=group_id,
            message=message_text
        )
        
        # Store message (either via Celery or directly)
        server_message_id = None
        current_time = datetime.utcnow()
        
        if CELERY_AVAILABLE:
            try:
                # Use Celery for async processing
                task_data = {
                    "group_id": group_id,
                    "sender_id": user_id,
                    "message": message_text
                }
                task = store_group_message_task.delay(task_data)
                server_message_id = task.id
            except Exception as celery_error:
                logger.error(f"Celery task failed: {str(celery_error)}")
                logger.warning("Falling back to direct DB write")
                transaction_in_progress = True
                stored_message = store_group_message(db, message_schema, user_id)
                server_message_id = stored_message.id
                transaction_in_progress = False
        else:
            # Direct database storage
            transaction_in_progress = True
            stored_message = store_group_message(db, message_schema, user_id)
            server_message_id = stored_message.id
            transaction_in_progress = False
            
        # Send confirmation to sender
        await websocket.send_json({
            "type": "confirmation",
            "message_id": client_message_id,
            "server_message_id": str(server_message_id),
            "timestamp": current_time.isoformat(),
            "status": "sent"
        })
        
        # Prepare the message for broadcasting
        group_message = {
            "type": "group_message",
            "message_id": str(server_message_id),
            "group_id": group_id,
            "sender_id": user_id,
            "message": message_text,
            "timestamp": current_time.isoformat()
        }
        
        # Publish to Redis if available (for cross-server delivery)
        if CELERY_AVAILABLE:
            try:
                redis_channel = f"group:{group_id}"
                redis_service.publish_message(redis_channel, group_message)
                
                # Trigger notification for offline members
                notify_offline_members_task.delay(group_id, server_message_id)
            except Exception as redis_error:
                logger.error(f"Redis publication failed: {str(redis_error)}")
                
        # If we don't have Redis or it failed, manually deliver to online group members
        try:
            # Get all group members
            members = []
            try:
                members = db.query(GroupMember.user_id).filter(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id != user_id  # Exclude sender
                ).all()
            except Exception as query_error:
                logger.error(f"Database error fetching group members: {str(query_error)}")
                db.rollback()  # Make sure to roll back on error
            
            member_ids = [m[0] for m in members]
            
            # Send to all connected members
            for member_id in member_ids:
                if multiplexer.is_connected(member_id):
                    await multiplexer.send_to_user(member_id, group_message)
        except Exception as delivery_error:
            logger.error(f"Error delivering group message: {str(delivery_error)}")
            
    except Exception as e:
        # Make sure to roll back any transaction in progress
        if transaction_in_progress:
            db.rollback()
        logger.error(f"Error handling group message: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process group message: {str(e)}"
        })

async def handle_typing_indicator(message: Dict, user_id: int, websocket: WebSocket):
    """Handle typing indicator updates"""
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate required fields
        required_fields = ["chat_type", "chat_id", "is_typing"]
        for field in required_fields:
            if field not in content:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Missing required field: {field}"
                })
                return
                
        # Extract fields
        chat_type = content["chat_type"]  # "direct" or "group"
        chat_id = content["chat_id"]
        is_typing = content["is_typing"]
        
        if chat_type not in ["direct", "group"]:
            await websocket.send_json({
                "type": "error",
                "message": "chat_type must be 'direct' or 'group'"
            })
            return
            
        # Update typing status
        multiplexer.update_typing(chat_type, chat_id, user_id, is_typing)
        
        # For direct chats, notify the other user if online
        if chat_type == "direct":
            other_user_id = int(chat_id)
            if multiplexer.is_connected(other_user_id):
                await multiplexer.send_to_user(other_user_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "chat_type": "direct",
                    "chat_id": str(user_id),  # From their perspective, the chat_id is the sender's ID
                    "is_typing": is_typing,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        # For group chats, publish to Redis if available
        elif chat_type == "group" and CELERY_AVAILABLE:
            try:
                redis_channel = f"group:{chat_id}"
                redis_service.publish_message(redis_channel, {
                    "type": "typing",
                    "user_id": user_id,
                    "chat_type": "group",
                    "chat_id": chat_id,
                    "is_typing": is_typing,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception as redis_error:
                logger.error(f"Redis publication failed for typing indicator: {str(redis_error)}")
                
    except Exception as e:
        logger.error(f"Error handling typing indicator: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process typing indicator: {str(e)}"
        })

async def handle_presence_update(message: Dict, user_id: int, websocket: WebSocket):
    """Handle presence status updates"""
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate status
        if "status" not in content:
            await websocket.send_json({
                "type": "error",
                "message": "Missing status field"
            })
            return
            
        status = content["status"]
        valid_statuses = ["online", "away", "busy", "offline"]
        
        if status not in valid_statuses:
            await websocket.send_json({
                "type": "error",
                "message": f"Invalid status: {status}. Must be one of {valid_statuses}"
            })
            return
            
        # Update presence in manager
        multiplexer.update_presence(user_id, status)
        
        # Send confirmation to user
        await websocket.send_json({
            "type": "presence_update",
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Broadcast to other users via Redis if available
        if CELERY_AVAILABLE:
            try:
                redis_service.publish_message("presence", {
                    "type": "presence",
                    "user_id": user_id,
                    "status": status,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception as redis_error:
                logger.error(f"Redis publication failed for presence: {str(redis_error)}")
                
        # Also broadcast directly to connected users
        await multiplexer.broadcast_presence(user_id, status)
        
    except Exception as e:
        logger.error(f"Error handling presence update: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process presence update: {str(e)}"
        })

async def handle_read_receipt(message: Dict, user_id: int, db: Session, websocket: WebSocket):
    """Handle read receipts for messages"""
    transaction_in_progress = False
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate required fields
        required_fields = ["message_id", "sender_id"]
        for field in required_fields:
            if field not in content:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Missing required field: {field}"
                })
                return
                
        # Extract fields
        message_id = content["message_id"]
        sender_id = content["sender_id"]
        
        # Mark message as read in database
        try:
            # Find the message
            message = None
            try:
                message = db.query(ChatMessage).filter(
                    ChatMessage.id == message_id,
                    ChatMessage.sender_id == sender_id,
                    ChatMessage.receiver_id == user_id
                ).first()
            except Exception as query_error:
                logger.error(f"Database error finding message: {str(query_error)}")
                db.rollback()
                await websocket.send_json({
                    "type": "error",
                    "message": "Database error finding message"
                })
                return
            
            if message:
                # Update the read status
                transaction_in_progress = True
                message.read = True
                db.commit()
                transaction_in_progress = False
                
                # Send confirmation to the client
                await websocket.send_json({
                    "type": "read_receipt_confirmation",
                    "message_id": message_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                # Notify the sender if they're online
                if multiplexer.is_connected(sender_id):
                    await multiplexer.send_to_user(sender_id, {
                        "type": "read_receipt",
                        "message_id": message_id,
                        "reader_id": user_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": "Message not found or you're not the recipient"
                })
        except Exception as db_error:
            if transaction_in_progress:
                db.rollback()
            logger.error(f"Database error marking message as read: {str(db_error)}")
            await websocket.send_json({
                "type": "error",
                "message": "Failed to mark message as read"
            })
            
    except Exception as e:
        if transaction_in_progress:
            db.rollback()
        logger.error(f"Error handling read receipt: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process read receipt: {str(e)}"
        })

async def handle_subscription(message: Dict, user_id: int, db: Session, websocket: WebSocket, pubsub=None):
    """Handle subscription to group channels"""
    transaction_in_progress = False
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate group_id
        if "group_id" not in content:
            await websocket.send_json({
                "type": "error",
                "message": "Missing group_id field"
            })
            return
            
        group_id = content["group_id"]
        
        # Verify user is a member of the group
        member = None
        try:
            member = db.query(GroupMember).filter(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id
            ).first()
        except Exception as query_error:
            logger.error(f"Database error checking group membership: {str(query_error)}")
            db.rollback()
            await websocket.send_json({
                "type": "error",
                "message": "Database error checking group membership"
            })
            return
        
        if not member:
            await websocket.send_json({
                "type": "error",
                "message": "You are not a member of this group"
            })
            return
            
        # Subscribe to the group in our manager
        multiplexer.subscribe_to_group(user_id, group_id)
        
        # Subscribe to Redis channel if available
        if CELERY_AVAILABLE and pubsub:
            try:
                redis_channel = f"group:{group_id}"
                pubsub.subscribe(redis_channel)
                logger.info(f"User {user_id} subscribed to Redis channel {redis_channel}")
            except Exception as redis_error:
                logger.error(f"Redis subscription failed: {str(redis_error)}")
                
        # Add user to active group members in Redis
        if CELERY_AVAILABLE:
            try:
                redis_service.add_user_to_active_group(group_id, user_id)
            except Exception as redis_error:
                logger.error(f"Failed to add user to active group members: {str(redis_error)}")
                
        # Send confirmation
        await websocket.send_json({
            "type": "subscription_confirmation",
            "group_id": group_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Fetch recent messages (last 20)
        try:
            recent_messages = []
            try:
                recent_messages = get_group_messages(db, group_id, user_id, 20)
            except Exception as db_error:
                logger.error(f"Database error fetching group messages: {str(db_error)}")
                db.rollback()
                await websocket.send_json({
                    "type": "error",
                    "message": "Database error fetching group messages"
                })
            
            # Send messages in chronological order (oldest first)
            for msg in reversed(recent_messages):
                await websocket.send_json({
                    "type": "group_message",
                    "message_id": str(msg.id),
                    "group_id": msg.group_id,
                    "sender_id": msg.sender_id,
                    "message": msg.message,
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                })
        except Exception as history_error:
            logger.error(f"Error fetching group history: {str(history_error)}")
            await websocket.send_json({
                "type": "error",
                "message": "Failed to retrieve group message history"
            })
            
    except Exception as e:
        if transaction_in_progress:
            db.rollback()
        logger.error(f"Error handling subscription: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process subscription: {str(e)}"
        })

async def handle_unsubscription(message: Dict, user_id: int, pubsub, websocket: WebSocket):
    """Handle unsubscription from group channels"""
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Validate group_id
        if "group_id" not in content:
            await websocket.send_json({
                "type": "error",
                "message": "Missing group_id field"
            })
            return
            
        group_id = content["group_id"]
        
        # Unsubscribe from the group in our manager
        multiplexer.unsubscribe_from_group(user_id, group_id)
        
        # Unsubscribe from Redis channel if available
        if CELERY_AVAILABLE and pubsub:
            try:
                redis_channel = f"group:{group_id}"
                pubsub.unsubscribe(redis_channel)
                logger.info(f"User {user_id} unsubscribed from Redis channel {redis_channel}")
            except Exception as redis_error:
                logger.error(f"Redis unsubscription failed: {str(redis_error)}")
                
        # Remove user from active group members in Redis
        if CELERY_AVAILABLE:
            try:
                redis_service.remove_user_from_active_group(group_id, user_id)
            except Exception as redis_error:
                logger.error(f"Failed to remove user from active group members: {str(redis_error)}")
                
        # Send confirmation
        await websocket.send_json({
            "type": "unsubscription_confirmation",
            "group_id": group_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error handling unsubscription: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process unsubscription: {str(e)}"
        })

async def handle_sync_request(message: Dict, user_id: int, db: Session, websocket: WebSocket):
    """Handle message synchronization requests"""
    try:
        # Extract message content
        if "content" not in message:
            await websocket.send_json({
                "type": "error",
                "message": "Missing message content"
            })
            return
            
        content = message["content"]
        
        # Get sync parameters
        sync_type = content.get("sync_type", "direct")  # direct or group
        limit = min(content.get("limit", 50), 100)  # Max 100 messages
        
        if sync_type == "direct":
            # Direct message sync for a specific user or all contacts
            contact_id = content.get("contact_id")
            since_timestamp = content.get("since")
            
            if contact_id:
                # Sync messages with a specific contact
                await sync_direct_messages(user_id, contact_id, since_timestamp, limit, db, websocket)
            else:
                # Sync with all contacts (new messages only)
                await sync_all_contacts(user_id, since_timestamp, limit, db, websocket)
                
        elif sync_type == "group":
            # Group message sync
            group_id = content.get("group_id")
            since_timestamp = content.get("since")
            
            if not group_id:
                await websocket.send_json({
                    "type": "error",
                    "message": "Missing group_id for group sync"
                })
                return
                
            await sync_group_messages(user_id, group_id, since_timestamp, limit, db, websocket)
            
        else:
            await websocket.send_json({
                "type": "error",
                "message": f"Invalid sync_type: {sync_type}"
            })
            
    except Exception as e:
        logger.error(f"Error handling sync request: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to process sync request: {str(e)}"
        })

async def sync_direct_messages(user_id: int, contact_id: int, since_timestamp: str, limit: int, db: Session, websocket: WebSocket):
    """Sync direct messages with a specific contact"""
    try:
        # Build query to get messages between the two users
        query = None
        try:
            query = db.query(ChatMessage).filter(
                ((ChatMessage.sender_id == user_id) & (ChatMessage.receiver_id == contact_id)) |
                ((ChatMessage.sender_id == contact_id) & (ChatMessage.receiver_id == user_id))
            )
        except Exception as query_error:
            logger.error(f"Database error building query: {str(query_error)}")
            db.rollback()
            await websocket.send_json({
                "type": "error",
                "message": "Database error building query"
            })
            return
        
        # Apply timestamp filter if provided
        if since_timestamp:
            try:
                since_dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))
                query = query.filter(ChatMessage.timestamp > since_dt)
            except ValueError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid timestamp format"
                })
                return
        
        # Order by timestamp and limit results
        messages = []
        try:
            messages = query.order_by(ChatMessage.timestamp.desc()).limit(limit).all()
        except Exception as query_error:
            logger.error(f"Database error getting messages: {str(query_error)}")
            db.rollback()
            await websocket.send_json({
                "type": "error",
                "message": "Database error getting messages"
            })
            return
        
        # Send sync start marker
        await websocket.send_json({
            "type": "sync_start",
            "sync_type": "direct",
            "contact_id": contact_id,
            "count": len(messages)
        })
        
        # Send messages in chronological order (oldest first)
        for msg in reversed(messages):
            await websocket.send_json({
                "type": "direct_message",
                "message_id": str(msg.id),
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "message": msg.message,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "delivered": msg.delivered,
                "read": getattr(msg, 'read', False)
            })
            
        # Send sync complete marker
        await websocket.send_json({
            "type": "sync_complete",
            "sync_type": "direct",
            "contact_id": contact_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        # Make sure to roll back on error
        db.rollback()
        logger.error(f"Error in sync_direct_messages: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to sync direct messages: {str(e)}"
        })

async def sync_all_contacts(user_id: int, since_timestamp: str, limit: int, db: Session, websocket: WebSocket):
    """Sync new messages with all contacts"""
    try:
        # Build query to get messages where user is sender or receiver
        query = db.query(ChatMessage).filter(
            (ChatMessage.sender_id == user_id) | (ChatMessage.receiver_id == user_id)
        )
        
        # Apply timestamp filter if provided
        if since_timestamp:
            try:
                since_dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))
                query = query.filter(ChatMessage.timestamp > since_dt)
            except ValueError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid timestamp format"
                })
                return
                
        # Order by timestamp and limit results
        messages = query.order_by(ChatMessage.timestamp.desc()).limit(limit).all()
        
        # Send sync start marker
        await websocket.send_json({
            "type": "sync_start",
            "sync_type": "all_contacts",
            "count": len(messages)
        })
        
        # Send messages in chronological order (oldest first)
        for msg in reversed(messages):
            await websocket.send_json({
                "type": "direct_message",
                "message_id": str(msg.id),
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "message": msg.message,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "delivered": msg.delivered,
                "read": getattr(msg, 'read', False)
            })
            
        # Send sync complete marker
        await websocket.send_json({
            "type": "sync_complete",
            "sync_type": "all_contacts",
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in sync_all_contacts: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to sync messages: {str(e)}"
        })

async def sync_group_messages(user_id: int, group_id: int, since_timestamp: str, limit: int, db: Session, websocket: WebSocket):
    """Sync group messages"""
    try:
        # Verify user is a member of the group
        member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()
        
        if not member:
            await websocket.send_json({
                "type": "error",
                "message": "You are not a member of this group"
            })
            return
            
        # Build query to get group messages
        query = db.query(GroupMessage).filter(GroupMessage.group_id == group_id)
        
        # Apply timestamp filter if provided
        if since_timestamp:
            try:
                since_dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))
                query = query.filter(GroupMessage.timestamp > since_dt)
            except ValueError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid timestamp format"
                })
                return
                
        # Order by timestamp and limit results
        messages = query.order_by(GroupMessage.timestamp.desc()).limit(limit).all()
        
        # Send sync start marker
        await websocket.send_json({
            "type": "sync_start",
            "sync_type": "group",
            "group_id": group_id,
            "count": len(messages)
        })
        
        # Send messages in chronological order (oldest first)
        for msg in reversed(messages):
            await websocket.send_json({
                "type": "group_message",
                "message_id": str(msg.id),
                "group_id": msg.group_id,
                "sender_id": msg.sender_id,
                "message": msg.message,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
            })
            
        # Send sync complete marker
        await websocket.send_json({
            "type": "sync_complete",
            "sync_type": "group",
            "group_id": group_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in sync_group_messages: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to sync group messages: {str(e)}"
        })
        
@router.get("/multiplex/chat-history/{chat_id}")
async def fetch_chat_history(
    chat_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Fetch chat history for a specific chat (direct or group).
    - `chat_id`: ID of the chat (user ID for direct chats or group ID for group chats).
    - `limit`: Number of messages to fetch (default: 50).
    - `offset`: Offset for pagination (default: 0).
    """
    try:
        # Check if the chat is a direct chat or a group chat
        is_group_chat = db.query(GroupChat).filter(GroupChat.id == chat_id).first()

        if is_group_chat:
            # Fetch group chat messages
            messages = (
                db.query(GroupMessage)
                .filter(GroupMessage.group_id == chat_id)
                .order_by(GroupMessage.timestamp.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return {
                "chat_type": "group",
                "chat_id": chat_id,
                "messages": [
                    {
                        "id": str(msg.id),
                        "sender": str(msg.sender_id),
                        "content": msg.message,
                        "timestamp": int(msg.timestamp.timestamp() * 1000) if msg.timestamp else int(datetime.utcnow().timestamp() * 1000),
                    }
                    for msg in messages
                ],
            }
        else:
            # Fetch direct chat messages
            messages = (
                db.query(ChatMessage)
                .filter(
                    ((ChatMessage.sender_id == user.id) & (ChatMessage.receiver_id == chat_id))
                    | ((ChatMessage.sender_id == chat_id) & (ChatMessage.receiver_id == user.id))
                )
                .order_by(ChatMessage.timestamp.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return {
                "chat_type": "direct",
                "chat_id": chat_id,
                "messages": [
                    {
                        "id": str(msg.id),
                        "sender": str(msg.sender_id),
                        "content": msg.message,
                        "timestamp": int(msg.timestamp.timestamp() * 1000) if msg.timestamp else int(datetime.utcnow().timestamp() * 1000),
                    }
                    for msg in messages
                ],
            }
    except Exception as e:
        logger.error(f"Error fetching chat history: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch chat history",
        )