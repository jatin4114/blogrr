# Import all models here to make them available when importing from app.db.models
from app.db.models.users import User
from app.db.models.blog_posts import BlogPost
from app.db.models.post_comments import PostComment
from app.db.models.chat_messages import ChatMessage
from app.db.models.group_chats import GroupChat, GroupMember, GroupMessage
from app.db.models.contacts import Contact

# Export all models
__all__ = [
    'User', 
    'BlogPost', 
    'PostComment', 
    'ChatMessage', 
    'GroupChat', 
    'GroupMember', 
    'GroupMessage',
    'Contact'  # Add Contact to the exports
]
