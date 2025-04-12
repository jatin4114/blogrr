import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createBlog } from 'features/blogs/store/blogSlice';
import { AppDispatch } from 'store/store';
import '../styles/BlogForms.css';

interface CreateBlogFormProps {
  onClose: () => void;
}

const CreateBlogForm = ({ onClose }: CreateBlogFormProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  // Define available categories with icon mapping
  const categories = [
    { id: 'general', label: 'General', icon: 'fa-bookmark' },
    { id: 'technology', label: 'Technology', icon: 'fa-laptop-code' },
    { id: 'lifestyle', label: 'Lifestyle', icon: 'fa-spa' },
    { id: 'travel', label: 'Travel', icon: 'fa-plane' },
    { id: 'food', label: 'Food', icon: 'fa-utensils' }
  ];

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setShowCategoryDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await dispatch(createBlog({ title, body, category })).unwrap();
      
      // Show success animation before closing
      setIsSubmitting(false);
      setIsClosing(true);
      
      // Close after animation completes
      setTimeout(() => onClose(), 500);
    } catch (error) {
      setIsSubmitting(false);
      alert(`Failed to create blog: ${error}`);
    }
  };

  const handleCloseClick = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`form-container ${isSubmitting ? 'submitting' : ''} ${isClosing ? 'closing' : ''}`}>
        <div className="form-header">
          <h3><i className="fas fa-plus-circle"></i> Create New Blog</h3>
          <button 
            className="close-btn" 
            onClick={handleCloseClick}
            disabled={isSubmitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">
              <i className="fas fa-heading"></i> Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter an engaging title"
              required
              disabled={isSubmitting}
              className="input-animated"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">
              <i className="fas fa-tag"></i> Category
            </label>
            <div className="custom-select-container">
              <div 
                className="custom-select-header" 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <div className="selected-option">
                  <div className="category-icon-wrapper">
                    <i className={`fas ${categories.find(c => c.id === category)?.icon}`}></i>
                  </div>
                  <span>{categories.find(c => c.id === category)?.label}</span>
                </div>
                <i className={`fas fa-chevron-down ${showCategoryDropdown ? 'open' : ''}`}></i>
              </div>
              
              {showCategoryDropdown && (
                <div className="custom-select-options">
                  {categories.map(cat => (
                    <div 
                      key={cat.id} 
                      className={`custom-select-option ${cat.id === category ? 'selected' : ''}`}
                      onClick={() => handleCategorySelect(cat.id)}
                    >
                      <div className="category-icon-wrapper">
                        <i className={`fas ${cat.icon}`}></i>
                      </div>
                      <span>{cat.label}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Keep hidden select for form validation */}
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={isSubmitting}
                className="hidden-select"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="body">
              <i className="fas fa-pen"></i> Content
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your blog content here..."
              required
              disabled={isSubmitting}
              className="input-animated"
            />
          </div>
          
          <button 
            type="submit" 
            className={`btn submit-btn ${isSubmitting ? 'loading' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner-small"></span>
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> Publish Blog
              </>
            )}
          </button>
          
          {isSubmitting && (
            <div className="submit-overlay">
              <div className="submit-progress">
                <div className="loading-spinner"></div>
                <p>Creating your blog...</p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateBlogForm;
