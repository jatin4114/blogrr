from celery import Celery
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Get broker URL from environment
broker_url = os.getenv('CELERY_BROKER_URL')
if not broker_url:
    broker_url = 'redis://localhost:6379/0'
    logger.warning(f"CELERY_BROKER_URL not found in environment, using default: {broker_url}")

# Configure Celery app
celery_app = Celery(
    'chat',
    broker=broker_url,
    backend=broker_url,
    include=['app.tasks.chat_messages_tasks', 'app.tasks.group_chat_tasks']
)

# Configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    broker_connection_retry=True,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,  # Increased from 5 to 10
    broker_transport_options={'visibility_timeout': 3600},
)

# Log configuration
logger.info(f"Celery configured with broker: {broker_url}")

# This defines the actual Celery instance that should be imported elsewhere

if __name__ == '__main__':
    celery_app.start()
