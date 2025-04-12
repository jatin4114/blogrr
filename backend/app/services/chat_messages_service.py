from sqlalchemy.orm import Session
from app.db.models import ChatMessage, User, BlogPost, PostComment
from app.schemas.chat_message_schema import ChatMessageSchema
import logging
import traceback
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from app.utils.time_utils import TimeUtil

logger = logging.getLogger(__name__)

def store_message(db: Session, message_data: ChatMessageSchema):
    """Store a chat message in the database with explicit transaction control"""
    try:
        # Convert to dict for ORM
        message_dict = message_data.dict(exclude_none=True)
        
        # Ensure we have a UTC timestamp using TimeUtil
        if "timestamp" not in message_dict or not message_dict["timestamp"]:
            message_dict["timestamp"] = TimeUtil.now()
        elif isinstance(message_dict["timestamp"], str):
            # Parse string timestamp with TimeUtil
            parsed_time = TimeUtil.parse_timestamp(message_dict["timestamp"])
            if parsed_time:
                message_dict["timestamp"] = parsed_time
            else:
                logger.warning(f"Invalid timestamp format: {message_dict['timestamp']}, using current UTC time")
                message_dict["timestamp"] = TimeUtil.now()
        elif hasattr(message_dict["timestamp"], 'tzinfo'):
            # Convert to UTC
            message_dict["timestamp"] = TimeUtil.to_utc(message_dict["timestamp"])
        
        # For database storage, remove timezone info (PostgreSQL treats it as UTC)
        message_dict["timestamp"] = TimeUtil.datetime_for_db(message_dict["timestamp"])
        
        # Set delivered status to False explicitly
        message_dict["delivered"] = False
            
        # Create message object
        message = ChatMessage(**message_dict)
        
        # Log with explicit time info
        logger.info(f"Storing message: sender={message.sender_id}, receiver={message.receiver_id}, "
                   f"timestamp={TimeUtil.to_iso(message.timestamp)}")
            
        # Add to DB and commit transaction
        db.add(message)
        db.commit()
        db.refresh(message)
        
        logger.info(f"Message successfully stored: ID={message.id}, UTC Timestamp={TimeUtil.to_iso(message.timestamp)}")
        return message
    except SQLAlchemyError as db_error:
        logger.error(f"Database error storing message: {str(db_error)}")
        logger.error(traceback.format_exc())
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error storing message: {str(e)}")
        logger.error(traceback.format_exc())
        db.rollback()
        raise

def get_undelivered_messages(db: Session, user_id: int):
    """Get all undelivered messages for a user with better error handling"""
    try:
        logger.info(f"Retrieving undelivered messages for user {user_id}")
        
        # Debug query to check if messages exist
        all_messages = db.query(ChatMessage).filter(
            ChatMessage.receiver_id == user_id
        ).all()
        logger.info(f"Total messages for user {user_id}: {len(all_messages)}")
        
        # Get only undelivered messages
        messages = db.query(ChatMessage).filter(
            ChatMessage.receiver_id == user_id, 
            ChatMessage.delivered == False
        ).order_by(ChatMessage.timestamp.asc()).all()
        
        logger.info(f"Retrieved {len(messages)} undelivered messages for user {user_id}")
        return messages
    except SQLAlchemyError as db_error:
        logger.error(f"Database error retrieving undelivered messages: {str(db_error)}")
        logger.error(traceback.format_exc())
        return []
    except Exception as e:
        logger.error(f"Error getting undelivered messages for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return []

def mark_messages_as_delivered(db: Session, user_id: int):
    """Mark all messages as delivered for a user with explicit transaction"""
    try:
        logger.info(f"Marking messages as delivered for user {user_id}")
        
        result = db.query(ChatMessage).filter(
            ChatMessage.receiver_id == user_id, 
            ChatMessage.delivered == False
        ).update({"delivered": True}, synchronize_session=False)
        
        db.commit()
        logger.info(f"Marked {result} messages as delivered for user {user_id}")
        return result
    except SQLAlchemyError as db_error:
        logger.error(f"Database error marking messages as delivered: {str(db_error)}")
        logger.error(traceback.format_exc())
        db.rollback()
        return 0
    except Exception as e:
        logger.error(f"Error marking messages as delivered for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        db.rollback()
        return 0
