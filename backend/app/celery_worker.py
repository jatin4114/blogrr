import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("celery_worker")
logger.info("Starting Celery worker")

# Import the Celery app - this must be below the logging config
from app.tasks.celery_app import celery_app

# Log configuration
broker_url = celery_app.conf.broker_url
logger.info(f"Using broker: {broker_url}")
logger.info(f"Registered task routes: {celery_app.conf.task_routes}")
logger.info(f"Registered tasks: {list(celery_app.tasks.keys())}")

# This is the entry point for: celery -A app.celery_worker worker --loglevel=info
