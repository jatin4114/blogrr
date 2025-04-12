from sqlalchemy.orm import Session, joinedload
from app.db.models.post_comments import PostComment
from app.db.models.blog_posts import BlogPost
from app.db.models.users import User

def add_comment_to_post(post_id: int, text: str, user_id: int, db: Session):
    """
    Adds a comment to a blog post.
    """
    blog_post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
    if not blog_post:
        return None, "Blog post not found"

    new_comment = PostComment(text=text, blog_id=post_id, user_id=user_id)
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment, None

def get_post_comments(post_id: int, db: Session):
    """
    Retrieves all comments for a blog post.
    """
    return db.query(PostComment).options(joinedload(PostComment.user)).filter(PostComment.blog_id == post_id).all()
