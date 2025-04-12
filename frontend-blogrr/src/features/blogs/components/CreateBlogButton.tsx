import React from 'react';
import '../styles/CreateBlogButton.css';

interface CreateBlogButtonProps {
  onClick?: () => void;
}

const CreateBlogButton = ({ onClick }: CreateBlogButtonProps) => {
  return (
    <button className="create-blog-btn" onClick={onClick}>
      <i className="fas fa-plus"></i>
    </button>
  );
};

export default CreateBlogButton;
