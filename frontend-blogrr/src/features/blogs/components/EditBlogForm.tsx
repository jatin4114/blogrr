import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateBlog, closeEditModal } from 'features/blogs/store/blogSlice';
import { RootState, AppDispatch } from 'store/store';
import '../styles/BlogForms.css';

const EditBlogForm = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { editBlog } = useSelector((state: RootState) => state.blogs);
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  useEffect(() => {
    if (editBlog) {
      setTitle(editBlog.title);
      setBody(editBlog.body);
      setCategory(editBlog.category);
    }
  }, [editBlog]);
  
  const handleClose = () => {
    dispatch(closeEditModal());
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editBlog) return;
    
    try {
      await dispatch(updateBlog({
        id: editBlog.id,
        title,
        body,
        category
      })).unwrap();
      
      handleClose();
    } catch (error) {
      alert(`Failed to update blog: ${error}`);
    }
  };
  
  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setShowCategoryDropdown(false);
  };

  // Simplified category data with icon mapping
  const categories = [
    { id: 'general', label: 'General', icon: 'fa-bookmark' },
    { id: 'technology', label: 'Technology', icon: 'fa-laptop-code' },
    { id: 'lifestyle', label: 'Lifestyle', icon: 'fa-spa' },
    { id: 'travel', label: 'Travel', icon: 'fa-plane' },
    { id: 'food', label: 'Food', icon: 'fa-utensils' }
  ];
  
  if (!editBlog) return null;
  
  return (
    <div className="modal-overlay">
      <div className="form-container">
        <div className="form-header">
          <h3><i className="fas fa-edit"></i> Edit Blog</h3>
          <button className="close-btn" onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-title">
              <i className="fas fa-heading"></i> Title
            </label>
            <input
              type="text"
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-category">
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
              
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="hidden-select"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-body">
              <i className="fas fa-pen"></i> Content
            </label>
            <textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn">
            <i className="fas fa-save"></i> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditBlogForm;
