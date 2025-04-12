from app.db.database import engine, Base
from app.db.models.users import User
from app.db.models.blog_posts import BlogPost
from app.db.models.post_comments import PostComment
from app.db.models.chat_messages import ChatMessage
from app.db.models.group_chats import GroupMessage
from app.db.models.contacts import Contact  # Ensure Contact is imported
from sqlalchemy import text

def reset_database():
    try:
        # Drop all tables
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        
        # Recreate all tables
        print("Creating new tables...")
        Base.metadata.create_all(bind=engine)
        
        print("Database has been reset successfully!")
    except Exception as e:
        print(f"Error resetting database: {str(e)}")
        raise e

if __name__ == "__main__":
    print("Starting database reset...")
    reset_database()
    print("Reset complete!")