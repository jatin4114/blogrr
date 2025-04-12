import os
import json
import logging
import redis
import traceback
from typing import Dict, Any, Union, List, Optional, Set
from datetime import datetime, timedelta
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
    
    def set_user_presence(self, user_id: int, status: str) -> bool:
        """Set a user's presence status"""
        try:
            key = f"user_presence:{user_id}"
            self.redis_client.set(key, status)
            self.redis_client.expire(key, 1800)  # 30 minutes
            return True
        except Exception as e:
            logger.error(f"Error setting user presence: {str(e)}")
            return False
    
    def get_user_presence(self, user_id: int) -> Optional[str]:
        """Get a user's presence status"""
        try:
            key = f"user_presence:{user_id}"
            status = self.redis_client.get(key)
            return status
        except Exception as e:
            logger.error(f"Error getting user presence: {str(e)}")
            return None
    
    def get_user_presences(self, user_ids: List[int]) -> Dict[int, str]:
        """Get presence status for multiple users at once"""
        results = {}
        try:
            pipe = self.redis_client.pipeline()
            keys = [f"user_presence:{user_id}" for user_id in user_ids]
            for key in keys:
                pipe.get(key)
            statuses = pipe.execute()
            for i, user_id in enumerate(user_ids):
                results[user_id] = statuses[i]
            return results
        except Exception as e:
            logger.error(f"Error getting user presences: {str(e)}")
            return results
    
    def add_pending_notification(self, user_id: int, notification_type: str, data: Dict[str, Any]) -> bool:
        """Add a pending notification for a user to be delivered when they reconnect"""
        try:
            key = f"pending_notifications:{user_id}"
            if "timestamp" not in data:
                data["timestamp"] = datetime.utcnow().isoformat()
            data["type"] = notification_type
            notification_json = json.dumps(data)
            self.redis_client.lpush(key, notification_json)
            self.redis_client.expire(key, 604800)  # 1 week
            return True
        except Exception as e:
            logger.error(f"Error adding pending notification: {str(e)}")
            return False
    
    def get_pending_notifications(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all pending notifications for a user and clear them"""
        try:
            key = f"pending_notifications:{user_id}"
            pipe = self.redis_client.pipeline()
            pipe.lrange(key, 0, -1)
            pipe.delete(key)
            results = pipe.execute()
            raw_notifications = results[0] if results and len(results) > 0 else []
            notifications = []
            for notification_json in raw_notifications:
                try:
                    notification = json.loads(notification_json)
                    notifications.append(notification)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in notification: {notification_json}")
            return notifications
        except Exception as e:
            logger.error(f"Error getting pending notifications: {str(e)}")
            return []
    
    def set_typing_indicator(self, chat_type: str, chat_id: Union[int, str], user_id: int) -> bool:
        """Set typing indicator with expiration (expires after 5 seconds)"""
        try:
            key = f"typing:{chat_type}:{chat_id}:{user_id}"
            self.redis_client.set(key, "1", ex=5)
            set_key = f"typing:{chat_type}:{chat_id}"
            self.redis_client.sadd(set_key, user_id)
            self.redis_client.expire(set_key, 60)
            return True
        except Exception as e:
            logger.error(f"Error setting typing indicator: {str(e)}")
            return False
    
    def clear_typing_indicator(self, chat_type: str, chat_id: Union[int, str], user_id: int) -> bool:
        """Clear typing indicator"""
        try:
            key = f"typing:{chat_type}:{chat_id}:{user_id}"
            self.redis_client.delete(key)
            set_key = f"typing:{chat_type}:{chat_id}"
            self.redis_client.srem(set_key, user_id)
            return True
        except Exception as e:
            logger.error(f"Error clearing typing indicator: {str(e)}")
            return False
    
    def get_typing_users(self, chat_type: str, chat_id: Union[int, str]) -> List[int]:
        """Get list of users currently typing in a specific chat"""
        try:
            set_key = f"typing:{chat_type}:{chat_id}"
            raw_users = self.redis_client.smembers(set_key)
            typing_users = []
            for user_str in raw_users:
                try:
                    typing_users.append(int(user_str))
                except ValueError:
                    logger.warning(f"Invalid user ID in typing set: {user_str}")
            return typing_users
        except Exception as e:
            logger.error(f"Error getting typing users: {str(e)}")
            return []
    
    def set_user_connection(self, user_id: int, server_id: str) -> bool:
        """Track which server a user is connected to (for cross-server messaging)"""
        try:
            key = f"connected:{user_id}"
            self.redis_client.set(key, server_id)
            self.redis_client.sadd("connected:users", user_id)
            self.redis_client.expire(key, 1800)
            return True
        except Exception as e:
            logger.error(f"Error setting user connection: {str(e)}")
            return False
    
    def remove_user_connection(self, user_id: int) -> bool:
        """Remove a user's connection tracking"""
        try:
            key = f"connected:{user_id}"
            self.redis_client.delete(key)
            self.redis_client.srem("connected:users", user_id)
            return True
        except Exception as e:
            logger.error(f"Error removing user connection: {str(e)}")
            return False
    
    def is_user_connected(self, user_id: int) -> bool:
        """Check if a user is connected to any server with validation"""
        try:
            # Check for activity key first (has TTL)
            if not self.redis_client.exists(f"user_active:{user_id}"):
                # If key doesn't exist, ensure user is removed from active_users set
                self.redis_client.srem("active_users", user_id)
                return False
                
            # Then check active_users set
            return bool(self.redis_client.sismember("active_users", user_id))
        except Exception as e:
            logger.error(f"Error checking if user is connected: {str(e)}")
            return False
    
    def get_user_server(self, user_id: int) -> Optional[str]:
        """Get the server ID that a user is connected to"""
        try:
            key = f"connected:{user_id}"
            server_id = self.redis_client.get(key)
            return server_id
        except Exception as e:
            logger.error(f"Error getting user server: {str(e)}")
            return None
    
    def update_heartbeat(self, user_id: int) -> bool:
        """Update user's heartbeat (activity timestamp)"""
        try:
            key = f"heartbeat:{user_id}"
            timestamp = datetime.utcnow().timestamp()
            self.redis_client.set(key, str(timestamp))
            self.redis_client.expire(key, 300)
            return True
        except Exception as e:
            logger.error(f"Error updating heartbeat: {str(e)}")
            return False
    
    def get_inactive_users(self, cutoff_minutes: int = 5) -> List[int]:
        """Get users who haven't sent a heartbeat in the specified time"""
        try:
            users = self.redis_client.smembers("connected:users")
            inactive_users = []
            cutoff_time = (datetime.utcnow() - timedelta(minutes=cutoff_minutes)).timestamp()
            for user_str in users:
                try:
                    user_id = int(user_str)
                    key = f"heartbeat:{user_id}"
                    last_heartbeat = self.redis_client.get(key)
                    if not last_heartbeat or float(last_heartbeat) < cutoff_time:
                        inactive_users.append(user_id)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid user data: {user_str}")
            return inactive_users
        except Exception as e:
            logger.error(f"Error getting inactive users: {str(e)}")
            return []
    
    def store_message_delivery_status(self, message_id: str, user_id: int, status: str) -> bool:
        """Store message delivery status (sent, delivered, read)"""
        try:
            key = f"message:status:{message_id}:{user_id}"
            data = {
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.redis_client.set(key, json.dumps(data))
            self.redis_client.expire(key, 2592000)  # 30 days
            return True
        except Exception as e:
            logger.error(f"Error storing message delivery status: {str(e)}")
            return False
    
    def get_message_delivery_status(self, message_id: str, user_id: int) -> Optional[Dict]:
        """Get message delivery status"""
        try:
            key = f"message:status:{message_id}:{user_id}"
            status_json = self.redis_client.get(key)
            if status_json:
                return json.loads(status_json)
            return None
        except Exception as e:
            logger.error(f"Error getting message delivery status: {str(e)}")
            return None
    
    def store_time_sync(self, user_id: int, client_time: float, server_time: float) -> bool:
        """Store time synchronization data for a user"""
        try:
            key = f"time_sync:{user_id}"
            data = {
                "client_time": client_time,
                "server_time": server_time,
                "offset": server_time - client_time
            }
            self.redis_client.set(key, json.dumps(data))
            self.redis_client.expire(key, 86400)  # 24 hours
            return True
        except Exception as e:
            logger.error(f"Error storing time sync: {str(e)}")
            return False
    
    def get_server_time_offset(self, user_id: int) -> Optional[float]:
        """Get the time offset between server and client for a user"""
        try:
            key = f"time_sync:{user_id}"
            data_json = self.redis_client.get(key)
            if data_json:
                data = json.loads(data_json)
                return data.get("offset")
            return None
        except Exception as e:
            logger.error(f"Error getting server time offset: {str(e)}")
            return None
    
    def add_user_to_channel(self, channel: str, user_id: int) -> bool:
        """Add a user to a channel subscription list"""
        try:
            key = f"channel:subscribers:{channel}"
            self.redis_client.sadd(key, user_id)
            user_channels_key = f"user:channels:{user_id}"
            self.redis_client.sadd(user_channels_key, channel)
            self.redis_client.expire(key, 86400)  # 24 hours
            self.redis_client.expire(user_channels_key, 86400)  # 24 hours
            return True
        except Exception as e:
            logger.error(f"Error adding user to channel: {str(e)}")
            return False
    
    def remove_user_from_channel(self, channel: str, user_id: int) -> bool:
        """Remove a user from a channel subscription list"""
        try:
            key = f"channel:subscribers:{channel}"
            self.redis_client.srem(key, user_id)
            user_channels_key = f"user:channels:{user_id}"
            self.redis_client.srem(user_channels_key, channel)
            return True
        except Exception as e:
            logger.error(f"Error removing user from channel: {str(e)}")
            return False
    
    def get_channel_subscribers(self, channel: str) -> List[int]:
        """Get all users subscribed to a channel"""
        try:
            key = f"channel:subscribers:{channel}"
            raw_subscribers = self.redis_client.smembers(key)
            return [int(user_id) for user_id in raw_subscribers]
        except Exception as e:
            logger.error(f"Error getting channel subscribers: {str(e)}")
            return []
    
    def get_user_channels(self, user_id: int) -> List[str]:
        """Get all channels a user is subscribed to"""
        try:
            channels = []
            cursor = 0
            pattern = "channel:subscribers:*"
            while True:
                cursor, keys = self.redis_client.scan(cursor, pattern, 100)
                for key in keys:
                    channel = key.replace("channel:subscribers:", "")
                    if self.redis_client.sismember(key, user_id):
                        channels.append(channel)
                if cursor == 0:
                    break
            return channels
        except Exception as e:
            logger.error(f"Error getting user channels: {str(e)}")
            return []
    
    def clear_all_user_data(self, user_id: int) -> bool:
        """Clear all Redis data for a user when they log out"""
        try:
            keys_to_delete = []
            for pattern in [
                f"user_presence:{user_id}",
                f"connected:{user_id}",
                f"heartbeat:{user_id}",
                f"pending_notifications:{user_id}",
                f"time_sync:{user_id}"
            ]:
                keys_to_delete.append(pattern)
            cursor = 0
            pattern = f"typing:*:{user_id}"
            while True:
                cursor, keys = self.redis_client.scan(cursor, pattern, 100)
                keys_to_delete.extend(keys)
                if cursor == 0:
                    break
            if keys_to_delete:
                self.redis_client.delete(*keys_to_delete)
            self.redis_client.srem("connected:users", user_id)
            cursor = 0
            pattern = "typing:*"
            while True:
                cursor, keys = self.redis_client.scan(cursor, pattern, 100)
                for key in keys:
                    if self.redis_client.sismember(key, user_id):
                        self.redis_client.srem(key, user_id)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.error(f"Error clearing user data: {str(e)}")
            return False
    
    def add_user_to_active_users(self, user_id: int, ttl: int = 3600):
        """Add a user to the active users set with TTL"""
        self.redis_client.sadd("active_users", user_id)
        # Use a separate key with TTL for activity tracking
        self.redis_client.set(f"user_active:{user_id}", "1", ex=ttl)
        logger.info(f"Added user {user_id} to active users with {ttl}s TTL")

    def remove_user_from_active_users(self, user_id: int):
        """Remove a user from the active users set"""
        self.redis_client.srem("active_users", user_id)
        self.redis_client.delete(f"user_active:{user_id}")
        logger.info(f"Removed user {user_id} from active users")

    def clean_stale_users(self) -> int:
        """Clean stale users from active_users set"""
        try:
            cleaned_count = 0
            active_users = self.redis_client.smembers("active_users")
            for user_id in active_users:
                if not self.redis_client.exists(f"user_active:{user_id}"):
                    self.redis_client.srem("active_users", user_id)
                    cleaned_count += 1
            return cleaned_count
        except Exception as e:
            logger.error(f"Error cleaning stale users: {str(e)}")
            return 0

    def get_active_users(self) -> Set[int]:
        """Get all active users with validation"""
        try:
            active_users = set()
            for user_id in self.redis_client.smembers("active_users"):
                # Verify each user has a valid activity key
                if self.redis_client.exists(f"user_active:{int(user_id)}"):
                    active_users.add(int(user_id))
                else:
                    # Clean up stale user from set
                    self.redis_client.srem("active_users", user_id)
            return active_users
        except Exception as e:
            logger.error(f"Error getting active users: {str(e)}")
            return set()