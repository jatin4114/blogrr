import { useEffect, useState } from 'react';
import '../styles/WelcomeBanner.css';

interface WelcomeBannerProps {
  username: string;
}

const WelcomeBanner = ({ username }: WelcomeBannerProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  
  useEffect(() => {
    // Show the banner with animation
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    // Auto hide after 1.5 seconds
    const hideTimer = setTimeout(() => {
      setIsHiding(true);
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        setIsVisible(false);
      }, 800); // Match fade-out animation duration
    }, 1500);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  
  if (!isVisible && !isHiding) return null;
  
  return (
    <div className={`welcome-banner ${isVisible ? 'show' : ''} ${isHiding ? 'hide' : ''}`}>
      <div className="welcome-content">
        <div className="user-avatar">
          <i className="fas fa-user-circle"></i>
        </div>
        <div className="welcome-text">
          <h3>Welcome back, <span>{username}</span></h3>
          <p>Your story matters. Share it with the world.</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
