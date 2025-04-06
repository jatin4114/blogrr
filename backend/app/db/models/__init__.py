# Import all models to avoid circular import issues
from app.db.models.blog_posts import BlogPost
from app.db.models.users import User
from app.db.models.post_comments import PostComment
from app.db.models.chat_messages import ChatMessage

# This ensures that all models are available when any model is imported
