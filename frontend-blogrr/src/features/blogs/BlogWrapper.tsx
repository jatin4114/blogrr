import { useEffect, useRef } from 'react';
import { setupApp } from './index';
import './styles/styles.css';

const BlogWrapper = () => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      // Load Font Awesome
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);

      // Call the setup function
      setupApp();
      initialized.current = true;

      // Ensure we're showing the right view based on authentication
      const token = localStorage.getItem('token');
      if (token) {
        // If we're authenticated, make sure we show the blogs view
        const blogsContainer = document.getElementById('blogs-container');
        const authContainer = document.getElementById('auth-container');
        const topbar = document.getElementById('topbar');
        
        if (topbar) topbar.classList.remove('hidden');
        if (authContainer) authContainer.classList.add('hidden');
        if (blogsContainer) blogsContainer.classList.remove('hidden');
      }
    }

    return () => {
      // Clean up if needed when component unmounts
    };
  }, []);

  // Handle tab clicks before the global functions are available
  const handleLoginTabClick = () => {
    if (window.showLoginForm) {
      window.showLoginForm();
    } else {
      const loginSection = document.getElementById('login-section');
      const registerSection = document.getElementById('register-section');
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      
      if (loginSection) loginSection.classList.add('active');
      if (registerSection) registerSection.classList.remove('active');
      if (loginTab) loginTab.classList.add('active');
      if (registerTab) registerTab.classList.remove('active');
    }
  };

  const handleRegisterTabClick = () => {
    if (window.showRegisterForm) {
      window.showRegisterForm();
    } else {
      const loginSection = document.getElementById('login-section');
      const registerSection = document.getElementById('register-section');
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      
      if (registerSection) registerSection.classList.add('active');
      if (loginSection) loginSection.classList.remove('active');
      if (registerTab) registerTab.classList.add('active');
      if (loginTab) loginTab.classList.remove('active');
    }
  };

  return (
    <>
      {/* Hamburger button outside topbar */}
      <button className="menu-toggle" id="menu-toggle">
        <i className="fas fa-bars"></i>
      </button>

      {/* Update Topbar */}
      <nav className="topbar hidden" id="topbar">
        <div className="nav-brand">
          <span>Blogrr</span>
          <div className="user-info">
            <i className="fas fa-user-circle"></i>
            <span id="topbar-username"></span>
          </div>
        </div>
        {/* Desktop Navigation Links */}
        <ul className="nav-links">
          <li>
            <button className="nav-btn" id="explore-btn">
              <i className="fas fa-compass"></i> Explore
            </button>
          </li>
          <li>
            <button className="nav-btn" id="profile-btn">
              <i className="fas fa-user-circle"></i> My Profile
            </button>
          </li>
          <li>
            <button className="nav-btn" id="logout-btn">
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </li>
        </ul>
        {/* Mobile Menu Toggle */}
        <button className="menu-toggle" id="menu-toggle">
          <i className="fas fa-bars"></i>
        </button>
      </nav>

      {/* Separate Mobile Navigation Menu */}
      <div className="nav-menu" id="nav-menu">
        <ul className="nav-links">
          <li>
            <button className="nav-btn" id="mobile-explore-btn">
              <i className="fas fa-compass"></i> Explore
            </button>
          </li>
          <li>
            <button className="nav-btn" id="mobile-profile-btn">
              <i className="fas fa-user-circle"></i> My Profile
            </button>
          </li>
          <li>
            <button className="nav-btn" id="mobile-logout-btn">
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </li>
        </ul>
      </div>

      {/* Add this after the topbar */}
      <div className="welcome-banner hidden" id="welcome-banner">
        <div className="welcome-content">
          <div className="user-avatar">
            <i className="fas fa-user-circle"></i>
          </div>
          <div className="welcome-text">
            <h3>Welcome back, <span id="username-display"></span></h3>
            <p>Your story matters. Share it with the world.</p>
          </div>
        </div>
      </div>

      {/* Auth Container */}
      <div className="auth-container" id="auth-container">
        <div className="app-header">
          <div className="d-flex center justify-center">
            <i className="fas fa-user-circle font-xxxl"></i>
            <h1>Blogrr</h1>
          </div>
          <p>Express yourself through words</p>
        </div>
        
        {/* Auth Tabs */}
        <div className="tabs">
          <button id="login-tab" className="tab active" onClick={handleLoginTabClick}>
            <i className="fas fa-sign-in-alt"></i> Login
          </button>
          <button id="register-tab" className="tab" onClick={handleRegisterTabClick}>
            <i className="fas fa-user-plus"></i> Register
          </button>
        </div>

        {/* Login Form */}
        <div id="login-section" className="form-section active">
          <form id="login-form">
            <div className="form-group">
              <label htmlFor="login-email">
                <i className="fas fa-envelope"></i> Email
              </label>
              <input type="email" id="login-email" required placeholder="Enter your email" />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">
                <i className="fas fa-lock"></i> Password
              </label>
              <input type="password" id="login-password" required placeholder="Enter your password" />
            </div>
            <button type="submit" className="btn">
              <i className="fas fa-sign-in-alt"></i> Login
            </button>
          </form>
          
          <div className="oauth-separator">
            <span>OR</span>
          </div>
          
          <button id="google-login-btn" className="oauth-btn google-btn">
            <i className="fab fa-google"></i> Login with Google
          </button>
        </div>

        {/* Register Form */}
        <div id="register-section" className="form-section">
          <form id="register-form">
            <div className="form-group">
              <label htmlFor="register-username">
                <i className="fas fa-user"></i> Username
              </label>
              <input type="text" id="register-username" required placeholder="Choose a username" />
            </div>
            <div className="form-group">
              <label htmlFor="register-email">
                <i className="fas fa-envelope"></i> Email
              </label>
              <input type="email" id="register-email" required placeholder="Enter your email" />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">
                <i className="fas fa-lock"></i> Password
              </label>
              <input type="password" id="register-password" required placeholder="Choose a password" />
            </div>
            <button type="submit" className="btn">
              <i className="fas fa-user-plus"></i> Register
            </button>
          </form>
        </div>
      </div>

      {/* Add Blogs Container */}
      <div className="blogs-container hidden" id="blogs-container">
        <h2>Latest Blogs</h2>
        <button className="create-blog-btn" id="create-blog-btn">
          <i className="fas fa-plus"></i>
        </button>
        <div className="blogs-grid" id="blogs-grid">
          {/* Blogs will be loaded here */}
        </div>
      </div>

      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
    </>
  );
};

export default BlogWrapper;
