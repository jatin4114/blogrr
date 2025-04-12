from app.tasks.celery_app import celery_app
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine
from app.db.database import SessionLocal
from app.services.group_chat_service import store_group_message
from app.schemas.group_chat_schema import GroupMessageCreate
import logging
import traceback
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
import os
from dotenv import load_dotenv

# Import all models to avoid circular reference issues
from app.db.models import BlogPost, User, PostComment, ChatMessage
from app.db.models.group_chats import GroupChat, GroupMember, GroupMessage

# Load environment variables with proper error handling
try:
    # Ensure dotenv is properly installed
    load_dotenv(override=True)
    
    # Get database URL with fallback
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        DATABASE_URL = "postgresql://postgres:postgres@localhost/blogrr"
        logging.warning(f"DATABASE_URL not found, using default: {DATABASE_URL}")
except Exception as e:
    logging.error(f"Error loading environment variables: {str(e)}")
    # Fallback database URL if environment loading fails
    DATABASE_URL = "postgresql://postgres:postgres@localhost/blogrr"

# Set up logger
logger = logging.getLogger(__name__)

# Import Redis service with proper error handling
try:
    from app.services.redis_service import RedisService
    redis_service = RedisService()
except ImportError as e:
    logger.error(f"Could not import RedisService: {str(e)}")
    redis_service = None
except Exception as e:
    logger.error(f"Error initializing RedisService: {str(e)}")
    redis_service = None

@celery_app.task(bind=True, name="app.tasks.group_chat_tasks.store_group_message_task", 
                max_retries=5, acks_late=True)
def store_group_message_task(self, message_data):
    """
    Celery task to store group chat messages in the database.
    """
    logger.info(f"Processing group message task: {message_data}")
    db = None
    
    # Log message details
    sender_id = message_data.get('sender_id')
    group_id = message_data.get('group_id')
    logger.info(f"Group message from user {sender_id} to group {group_id}")
    
    try:
        # Create a new engine and session for each task
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionFactory = sessionmaker(bind=engine)
        db = SessionFactory()
        
        # Ensure we have a UTC timestamp
        current_time = datetime.utcnow()
        
        # Create message object from data
        message_schema = GroupMessageCreate(
            group_id=group_id,
            message=message_data.get('message')
        )
        
        # Store in database with explicit UTC timestamp
        stored_message = store_group_message(db, message_schema, sender_id, timestamp=current_time)
        message_id = stored_message.id
        
        logger.info(f"Group message saved with ID: {message_id} at UTC time: {current_time.isoformat()}")
        
        # Trigger notification for offline members using the actual message ID
        try:
            notify_offline_members_task.delay(group_id, message_id)
        except Exception as e:
            logger.error(f"Failed to queue notification task: {str(e)}")
        
        return message_id
    except SQLAlchemyError as db_error:
        logger.error(f"Database error in store_group_message_task: {str(db_error)}")
        logger.error(traceback.format_exc())
        
        # Retry with exponential backoff for database errors
        retry_in = 5 * (2 ** self.request.retries)
        logger.info(f"Retrying database operation in {retry_in} seconds (attempt {self.request.retries + 1}/5)")
        self.retry(exc=db_error, countdown=retry_in)
        return None
    except Exception as e:
        logger.error(f"Unexpected error in store_group_message_task: {str(e)}")
        logger.error(traceback.format_exc())
        self.retry(exc=e, countdown=10)
        return None
    finally:
        # Ensure DB session is closed
        if db:
            db.close()

@celery_app.task(name="app.tasks.group_chat_tasks.notify_offline_members_task")
def notify_offline_members_task(group_id, message_id):
    """
    Notify offline group members about new messages when they come back online.
    This is done by adding the message to a Redis list that will be checked when users reconnect.
    """
    logger.info(f"Notifying offline members for group {group_id} about message {message_id}")
    db = None
    
    try:
        # Create a new session
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionFactory = sessionmaker(bind=engine)
        db = SessionFactory()
        
        # Get all members of the group
        members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
        member_ids = [member.user_id for member in members]
        
        # Ensure message_id is an integer for database query
        if not isinstance(message_id, int):
            try:
                message_id = int(message_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid message_id format: {message_id}, must be an integer")
                return False
        
        # Get the message details
        message = db.query(GroupMessage).filter(GroupMessage.id == message_id).first()
        if not message:
            logger.error(f"Message {message_id} not found")
            return False
        
        # Get list of currently active members
        active_members = redis_service.get_active_group_members(group_id)
        
        # For each offline member, add to pending notifications
        for member_id in member_ids:
            # Skip message sender
            if member_id == message.sender_id:
                continue
                
            # Skip active members (they should receive messages in real time)
            if member_id in active_members:
                continue
            
            # Add to pending notifications in Redis
            pending_key = f"pending_group_messages:{member_id}"
            try:
                # Store message ID with group ID in Redis
                notification_data = f"{group_id}:{message_id}"
                redis_service.redis_client.lpush(pending_key, notification_data)
                redis_service.redis_client.expire(pending_key, 604800)  # 1 week expiry
                logger.info(f"Added message {message_id} to pending notifications for user {member_id}")
            except Exception as redis_error:
                logger.error(f"Redis error adding pending notification: {str(redis_error)}")
                
        return True
    except Exception as e:
        logger.error(f"Error in notify_offline_members_task: {str(e)}")
        logger.error(traceback.format_exc())
        return False
    finally:
        if db:
            db.close()

@celery_app.task(name="app.tasks.group_chat_tasks.clean_inactive_group_members")
def clean_inactive_group_members():
    """
    Periodically clean up inactive group members from Redis to prevent memory leaks.
    This task should be scheduled to run daily.
    """
    logger.info("Cleaning inactive group members from Redis")
    
    try:
        # Get all keys matching the pattern active_group_members:*
        keys = redis_service.redis_client.keys("active_group_members:*")
        
        # For each key, check if it has expired members (more than 24 hours inactive)
        for key in keys:
            # Reset expiration to 24 hours
            redis_service.redis_client.expire(key, 86400)  # 24 hours
            
        return True
    except Exception as e:
        logger.error(f"Error cleaning inactive group members: {str(e)}")
        return False
