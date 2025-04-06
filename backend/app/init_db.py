from app.db.database import Base, engine
from app.db.models.users import User
from app.db.models.blog_posts import BlogPost
from app.db.models.post_comments import PostComment

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
