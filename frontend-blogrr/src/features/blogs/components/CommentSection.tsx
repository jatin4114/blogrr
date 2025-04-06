import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { addComment } from 'features/blogs/store/blogSlice';
import { Comment } from 'features/blogs/types';
import { AppDispatch } from 'store/store';
import '../styles/CommentSection.css';

interface CommentSectionProps {
  blogId: number;
  comments: Comment[];
  isVisible: boolean;
  onClose: () => void;
  isModal?: boolean;
}

const CommentSection = ({ 
  blogId, 
  comments, 
  isVisible,
  onClose,
  isModal = false
}: CommentSectionProps) => {
  const [commentText, setCommentText] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const commentSectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Close comments when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isVisible && 
        !isModal &&
        commentSectionRef.current && 
        !commentSectionRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose, isModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      dispatch(addComment({ blogId, text: commentText, isModal }));
      setCommentText('');
    }
  };

  const sectionClassName = isModal 
    ? 'modal-comments-section' 
    : `comments-section ${isVisible ? 'active' : ''}`;
  
  const listClassName = isModal ? 'modal-comments-list' : 'comments-list';
  const commentClassName = isModal ? 'modal-comment' : 'comment';
  const formClassName = isModal ? 'modal-comment-form' : 'comment-form';

  return (
    <div 
      className={sectionClassName}
      ref={commentSectionRef}
      style={{ display: isVisible || isModal ? 'block' : 'none' }}
    >
      <div className={listClassName}>
        {comments.length > 0 ? (
          comments.map(comment => (
            <div key={comment.id} className={commentClassName}>
              <div className={`${commentClassName}-header`}>
                <div className={`${commentClassName}-author`}>
                  <i className="fas fa-user-circle"></i>
                  <span>{comment.user.username}</span>
                </div>
                <small>{new Date(comment.created_at).toLocaleDateString()}</small>
              </div>
              <p>{comment.text}</p>
            </div>
          ))
        ) : (
          <p className="no-comments">No comments yet. Be the first to comment!</p>
        )}
      </div>
      
      <form className={formClassName} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          required
        />
        <button type="submit" className="comment-submit">
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};

export default CommentSection;
