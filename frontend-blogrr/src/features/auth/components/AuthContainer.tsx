import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import '../styles/Auth.css';

const AuthContainer = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isAnimating, setIsAnimating] = useState(false);

  const switchTab = (tab: 'login' | 'register') => {
    if (activeTab !== tab && !isAnimating) {
      setIsAnimating(true);
      setActiveTab(tab);
      // Reset animation flag after animation completes
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  return (
    <div className="auth-container">
      <div className="app-header">
        <div className="d-flex center justify-center">
          <i className="fas fa-user-circle font-xxxl"></i>
          <h1>Blogrr</h1>
        </div>
        <p>Express yourself through words</p>
      </div>
      
      {/* Auth Tabs */}
      <div className="tabs">
        <button 
          id="login-tab" 
          className={`tab ${activeTab === 'login' ? 'active' : ''}`} 
          onClick={() => switchTab('login')}
          disabled={isAnimating}
        >
          <i className="fas fa-sign-in-alt"></i> Login
        </button>
        <button 
          id="register-tab" 
          className={`tab ${activeTab === 'register' ? 'active' : ''}`} 
          onClick={() => switchTab('register')}
          disabled={isAnimating}
        >
          <i className="fas fa-user-plus"></i> Register
        </button>
      </div>

      {activeTab === 'login' ? (
        <LoginForm />
      ) : (
        <RegisterForm switchToLogin={() => switchTab('login')} />
      )}
    </div>
  );
};

export default AuthContainer;
