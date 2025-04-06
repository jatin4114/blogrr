import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from 'store/store';
import { login } from 'features/auth/store/authSlice';
import GoogleLoginButton from './GoogleLoginButton';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  // Removed alert side effect for error; errors are shown inline

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(login({ email, password })).unwrap();
      console.info('Login successful for email:', email);
      // Success message can be displayed via CSS styles if needed
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div id="login-section" className="form-section active">
      {error && <div className="auth-error">{error}</div>}
      <form id="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-email">
            <i className="fas fa-envelope"></i> Email
          </label>
          <input 
            type="email" 
            id="login-email" 
            required 
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">
            <i className="fas fa-lock"></i> Password
          </label>
          <input 
            type="password" 
            id="login-password" 
            required 
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          <i className="fas fa-sign-in-alt"></i> 
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div className="oauth-separator">
        <span>OR</span>
      </div>
      
      <GoogleLoginButton />
    </div>
  );
};

export default LoginForm;
