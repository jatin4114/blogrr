import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { deleteBlog, openBlogModal, openEditModal } from 'features/blogs/store/blogSlice';
import CommentSection from 'features/blogs/components/CommentSection';
import { Blog } from 'features/blogs/types';
import { AppDispatch } from 'store/store';
import '../styles/BlogCard.css';

interface BlogCardProps {
  blog: Blog;
  isAuthor: boolean;
}

const BlogCard = ({ blog, isAuthor }: BlogCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking action buttons
    if (!(e.target as HTMLElement).closest('.blog-actions')) {
      dispatch(openBlogModal(blog));
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm('Are you sure you want to delete this blog?')) {
      dispatch(deleteBlog(blog.id));
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(openEditModal(blog));
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments((prev) => !prev); // Toggle the visibility state
  };

  return (
    <div className="blog-wrapper">
      <div 
        className={`blog-card ${!isAuthor ? 'floating' : ''}`}
        onClick={handleCardClick}
      >
        <div className="blog-category">
          <i className="fas fa-tag"></i> {blog.category}
        </div>
        <div className="blog-content">
          <h3>{blog.title}</h3>
          <p>{blog.body}</p>
        </div>
        <div className="blog-footer">
          <div className="blog-meta">
            <div className="author-info">
              <i className="fas fa-user-circle"></i>
              <span>{blog.creator.username}</span>
            </div>
            <small>{new Date(blog.created_at).toLocaleDateString()}</small>
          </div>
          <div className="blog-actions">
            {isAuthor ? (
              <>
                <button onClick={handleEditClick} className="action-btn edit-btn">
                  <i className="fas fa-edit"></i>
                </button>
                <button onClick={handleDeleteClick} className="action-btn delete-btn">
                  <i className="fas fa-trash"></i>
                </button>
              </>
            ) : (
              <button onClick={toggleComments} className="action-btn comment-btn">
                <i className="fas fa-comment"></i>
                <span className="comment-count">{blog.comments?.length || 0}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {!isAuthor && (
        <CommentSection 
          blogId={blog.id} 
          comments={blog.comments || []} 
          isVisible={showComments} // Pass updated state
          onClose={() => setShowComments(false)} // Ensure it closes properly
        />
      )}
    </div>
  );
};

export default BlogCard;
