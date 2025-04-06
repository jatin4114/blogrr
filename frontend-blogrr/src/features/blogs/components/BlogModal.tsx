import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closeBlogModal } from 'features/blogs/store/blogSlice';
import CommentSection from 'features/blogs/components/CommentSection';
import { RootState, AppDispatch } from 'store/store';
import '../styles/BlogModal.css';

const BlogModal = () => {
  const { modalBlog, showModal } = useSelector((state: RootState) => state.blogs);
  const dispatch = useDispatch<AppDispatch>();
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        dispatch(closeBlogModal());
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [dispatch, showModal]);
  
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      dispatch(closeBlogModal());
    }
  };
  
  if (!modalBlog || !showModal) return null;

  return (
    <div 
      ref={modalRef}
      className={`blog-modal ${showModal ? 'active' : ''}`}
      onClick={handleOutsideClick}
    >
      <div className="blog-modal-content">
        <div className="blog-modal-header">
          <div>
            <h2 className="blog-modal-title">{modalBlog.title}</h2>
            <div className="blog-modal-category">
              <i className="fas fa-tag"></i> {modalBlog.category}
            </div>
          </div>
          <button 
            className="close-modal"
            onClick={() => dispatch(closeBlogModal())}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="blog-modal-body">
          {modalBlog.body}
        </div>
        <div className="blog-modal-footer">
          <div className="modal-author-info">
            <div className="modal-author-avatar">
              <i className="fas fa-user"></i>
            </div>
            <div>
              <strong>{modalBlog.creator.username}</strong>
              <div>
                <small>{new Date(modalBlog.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          </div>
        </div>
        
        <CommentSection 
          blogId={modalBlog.id}
          comments={modalBlog.comments || []}
          isVisible={true}
          onClose={() => {}}
          isModal={true}
        />
      </div>
    </div>
  );
};

export default BlogModal;
