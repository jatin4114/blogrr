import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setView } from 'features/blogs/store/blogSlice';
import './BottomBar.css';

interface BottomBarProps {
  onToggleCreateBlog: () => void;
}

const BottomBar = ({ onToggleCreateBlog }: BottomBarProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const goToNotifications = () => {
    navigate('/notifications');
  };

  // Instead of navigating, call the toggle callback
  const handleToggleCreateBlog = () => {
    onToggleCreateBlog();
  };

  const goToExplore = () => {
    // Set the view to 'explore' in localStorage before navigating
    localStorage.setItem('blogView', 'explore');
    dispatch(setView('explore'));
    navigate('/blogs');
  };

  const goToMyBlogs = () => {
    // Set the view to 'my' in localStorage before navigating
    localStorage.setItem('blogView', 'my');
    dispatch(setView('my'));
    navigate('/blogs');
  };

  const goToChats = () => {
    navigate('/chats');
  };

  return (
    <div className="bottom-bar">
      <button className="bottom-bar-btn" onClick={goToNotifications}>
        <i className="fas fa-bell"></i>
      </button>
      <button className="bottom-bar-btn" onClick={goToExplore}>
        <i className="fas fa-compass"></i>
      </button>
      <button className="bottom-bar-btn" onClick={handleToggleCreateBlog}>
        <i className="fas fa-plus-circle"></i>
      </button>
      <button className="bottom-bar-btn" onClick={goToMyBlogs}>
        <i className="fas fa-book"></i>
      </button>
      <button className="bottom-bar-btn" onClick={goToChats}>
        <i className="fas fa-comments"></i>
      </button>
    </div>
  );
};

export default BottomBar;
