import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from 'store/store';
import { register } from 'features/auth/store/authSlice';

interface RegisterFormProps {
  switchToLogin: () => void; // Added prop to switch to login tab
}

const RegisterForm = ({ switchToLogin }: RegisterFormProps) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { error } = useSelector((state: RootState) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await dispatch(register({ username, email, password })).unwrap();
      console.info('Registration successful for user:', username);
      
      // Show success popup
      setIsSuccess(true);
      
      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        switchToLogin();
        // Reset form after redirect
        setUsername('');
        setEmail('');
        setPassword('');
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="register-section" className="form-section active">
      {error && <div className="auth-error">{error}</div>}
      
      {isSuccess && (
        <div className="success-popup">
          <div className="success-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <h4>Registration Successful!</h4>
          <p>Redirecting to login in a moment...</p>
          <div className="redirect-progress"></div>
        </div>
      )}
      
      <form id="register-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="register-username">
            <i className="fas fa-user"></i> Username
          </label>
          <input 
            type="text" 
            id="register-username" 
            required 
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isSubmitting || isSuccess}
          />
        </div>
        <div className="form-group">
          <label htmlFor="register-email">
            <i className="fas fa-envelope"></i> Email
          </label>
          <input 
            type="email" 
            id="register-email" 
            required 
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting || isSuccess}
          />
        </div>
        <div className="form-group">
          <label htmlFor="register-password">
            <i className="fas fa-lock"></i> Password
          </label>
          <input 
            type="password" 
            id="register-password" 
            required 
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting || isSuccess}
          />
        </div>
        <button type="submit" className="btn" disabled={isSubmitting || isSuccess}>
          {isSubmitting ? (
            <>
              <span className="loading-spinner-small"></span> Registering...
            </>
          ) : (
            <>
              <i className="fas fa-user-plus"></i> Register
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
