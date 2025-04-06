import os
import json
import logging
import redis
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class RedisService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisService, cls).__new__(cls)
            redis_url = os.getenv('REDIS_URL', os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'))
            cls._instance.redis_client = redis.from_url(redis_url, decode_responses=True)
            logger.info(f"Connected to Redis: {redis_url}")
        return cls._instance
    
    def publish_message(self, channel: str, message: Dict[str, Any]) -> int:
        """Publish a message to a Redis channel"""
        try:
            message_json = json.dumps(message)
            result = self.redis_client.publish(channel, message_json)
            logger.info(f"Published message to {channel}, received by {result} subscribers")
            return result
        except Exception as e:
            logger.error(f"Error publishing to Redis: {str(e)}")
            return 0
    
    def get_active_group_members(self, group_id: int) -> List[int]:
        """Get list of active users in a group"""
        try:
            key = f"active_group_members:{group_id}"
            members = self.redis_client.smembers(key)
            return [int(user_id) for user_id in members]
        except Exception as e:
            logger.error(f"Error getting active members: {str(e)}")
            return []
    
    def add_user_to_active_group(self, group_id: int, user_id: int) -> bool:
        """Add user to active members set for a group"""
        try:
            key = f"active_group_members:{group_id}"
            self.redis_client.sadd(key, user_id)
            # Set expiry to clean up automatically after some period (e.g., 24 hours)
            self.redis_client.expire(key, 86400)  # 24 hours in seconds
            return True
        except Exception as e:
            logger.error(f"Error adding user to active group members: {str(e)}")
            return False
    
    def remove_user_from_active_group(self, group_id: int, user_id: int) -> bool:
        """Remove user from active members set for a group"""
        try:
            key = f"active_group_members:{group_id}"
            self.redis_client.srem(key, user_id)
            return True
        except Exception as e:
            logger.error(f"Error removing user from active group: {str(e)}")
            return False
