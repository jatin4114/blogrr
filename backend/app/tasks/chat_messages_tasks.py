from app.tasks.celery_app import celery_app
from sqlalchemy.orm import Session, sessionmaker
from app.db.database import SessionLocal
from app.services.chat_messages_service import store_message
from app.schemas.chat_message_schema import ChatMessageSchema
import logging
import traceback
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
import os
from dotenv import load_dotenv

# Import all models to avoid circular reference issues
from app.db.models import BlogPost, User, PostComment, ChatMessage

# Load environment variables
load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="app.tasks.chat_messages_tasks.deliver_message_task", 
                max_retries=5, acks_late=True)
def deliver_message_task(self, message_data):
    """
    Celery task to store chat messages in the database.
    This task is decoupled from the WebSocket to ensure messages are persisted
    even if the receiver is not connected.
    """
    logger.info(f"Processing message delivery task: {message_data}")
    db = None
    
    # Log message details
    sender_id = message_data.get('sender_id')
    receiver_id = message_data.get('receiver_id')
    logger.info(f"Message from user {sender_id} to user {receiver_id}")
    
    try:
        # Create a new engine and session for each task to avoid connection issues
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Use sessionmaker to create a session factory
        SessionFactory = sessionmaker(bind=engine)
        # Create a new session from the factory
        db = SessionFactory()
        
        # Process timestamp
        if "timestamp" in message_data and isinstance(message_data["timestamp"], str):
            try:
                # Try to parse ISO format timestamp
                message_data["timestamp"] = datetime.fromisoformat(message_data["timestamp"].replace('Z', '+00:00'))
            except Exception as e:
                logger.warning(f"Failed to parse timestamp {message_data['timestamp']}: {str(e)}")
                message_data["timestamp"] = datetime.utcnow()
        
        # Always ensure we have a timestamp
        if "timestamp" not in message_data or not message_data["timestamp"]:
            message_data["timestamp"] = datetime.utcnow()
        
        # Set delivered status to False explicitly
        message_data["delivered"] = False
            
        # Create and store the message
        try:
            message_schema = ChatMessageSchema(**message_data)
            
            # Store in database with explicit transaction
            stored_message = store_message(db, message_schema)
            
            logger.info(f"Message saved with ID: {stored_message.id} in the database")
            return stored_message.id
        except Exception as schema_error:
            logger.error(f"Error creating message schema: {str(schema_error)}")
            logger.error(traceback.format_exc())
            raise
            
    except SQLAlchemyError as db_error:
        logger.error(f"Database error in deliver_message_task: {str(db_error)}")
        logger.error(traceback.format_exc())
        
        # Retry with exponential backoff for database errors
        retry_in = 5 * (2 ** self.request.retries)
        logger.info(f"Retrying database operation in {retry_in} seconds (attempt {self.request.retries + 1}/5)")
        self.retry(exc=db_error, countdown=retry_in)
    except Exception as e:
        logger.error(f"Unexpected error in deliver_message_task: {str(e)}")
        logger.error(traceback.format_exc())
        self.retry(exc=e, countdown=10)
    finally:
        # Ensure DB session is closed
        try:
            if db:
                db.close()
        except Exception as close_error:
            logger.error(f"Error closing database connection: {str(close_error)}")
