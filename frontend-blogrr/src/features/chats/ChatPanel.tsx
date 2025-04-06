import React from 'react';

const ChatPanel: React.FC = () => {
  return (
    <div className="chat-panel">
      <div className="empty-chat-message">
        <i className="fas fa-comments"></i>
        <p>Select a chat to get started</p>
        <p className="subtext">Connect with friends and colleagues through real-time messaging</p>
      </div>
    </div>
  );
};

export default ChatPanel;
