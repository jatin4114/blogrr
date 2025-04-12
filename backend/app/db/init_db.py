from app.db.database import engine, Base
from app.db.models import users, blog_posts, post_comments

def init_db():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)

if __name__ == "__main__":
    init_db() 