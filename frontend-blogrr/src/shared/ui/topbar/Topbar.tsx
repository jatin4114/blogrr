import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

interface TopbarProps {
  username: string;
  onLogout: () => void;
  onExploreClick: () => void;
  onProfileClick: () => void;
  onChatClick?: () => void;
  unreadMessageCount?: number;
  currentView: 'explore' | 'my' | 'chat'; 
}

const Topbar = ({ 
  username, 
  onLogout, 
  onExploreClick, 
  onProfileClick,
  onChatClick,
  unreadMessageCount = 0,
  currentView 
}: TopbarProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        showUserMenu &&
        !target.closest('.user-menu-toggle') &&
        !target.closest('.user-menu')
      ) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleExploreClick = () => {
    if (currentView !== 'explore') {
      onExploreClick();
      setShowUserMenu(false);
    }
  };

  const handleProfileClick = () => {
    if (currentView !== 'my') {
      onProfileClick();
      setShowUserMenu(false);
    }
  };

  const handleChatClick = () => {
    if (currentView !== 'chat') {
      if (onChatClick) onChatClick(); // optional side effect
      navigate('/chats');
    }
  }

  return (
    <>
      <nav className="topbar">
        <div className="nav-brand">
          <span>Blogrr</span>
          <div className="user-info">
            <i className="fas fa-user-circle"></i>
            <span>{username}</span>
          </div>
        </div>

        {/* Desktop navigation with Logout */}
        <ul className="nav-links">
          <li>
            <button 
              className={`nav-btn ${currentView === 'explore' ? 'active' : ''}`} 
              onClick={handleExploreClick}
            >
              <i className="fas fa-compass"></i> Explore
            </button>
          </li>
          <li>
            <button 
              className={`nav-btn ${currentView === 'my' ? 'active' : ''}`} 
              onClick={handleProfileClick}
            >
              <i className="fas fa-user-circle"></i> My Profile
            </button>
          </li>
          <li>
          <button 
              className={currentView === 'chat' ? 'active' : ''}
              onClick={() => { setShowUserMenu(false); handleChatClick(); }}
            >
              <i className="fas fa-comments"></i> Chat
              {unreadMessageCount > 0 && (
                <span className="message-badge">{unreadMessageCount}</span>
              )}
            </button>
          </li>
          <li>
            <button className="nav-btn logout-btn" onClick={onLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </li>
          
        </ul>

        {/* Mobile User Menu Toggle Button */}
        <button 
          className="user-menu-toggle" 
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <i className="fas fa-user-circle"></i>
          {unreadMessageCount > 0 && (
            <span className="mobile-message-badge">{unreadMessageCount}</span>
          )}
        </button>
      </nav>

      {/* Mobile User Menu Panel */}
      {showUserMenu && (
        <div className="user-menu">
          <div className="user-menu-header">
            <div className="user-avatar">
              <i className="fas fa-user-circle"></i>
            </div>
            <div className="user-details">
              <h4>{username}</h4>
              <p>Logged in</p>
            </div>
          </div>
          <div className="user-menu-items">
            <button 
              className={currentView === 'explore' ? 'active' : ''}
              onClick={() => { setShowUserMenu(false); handleExploreClick(); }}
            >
              <i className="fas fa-compass"></i> Explore
            </button>
            <button 
              className={currentView === 'my' ? 'active' : ''}
              onClick={() => { setShowUserMenu(false); handleProfileClick(); }}
            >
              <i className="fas fa-user-circle"></i> My Profile
            </button>
            {onChatClick && (
              <button 
                className={currentView === 'chat' ? 'active' : ''}
                onClick={() => { setShowUserMenu(false); handleChatClick(); }}
              >
                <i className="fas fa-comments"></i> Chat
                {unreadMessageCount > 0 && (
                  <span className="message-badge">{unreadMessageCount}</span>
                )}
              </button>
            )}
          </div>
          <div className="user-menu-actions">
            <button onClick={() => { setShowUserMenu(false); onLogout(); }}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;
