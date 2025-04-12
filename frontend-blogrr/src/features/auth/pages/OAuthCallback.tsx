import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { handleOAuthCallback } from '../store/authSlice';
import LoadingScreen from 'shared/LoadingScreen';
import '../styles/OAuthCallback.css';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('OAuthCallback component: processing callback');
        console.log('Current path:', location.pathname);
        console.log('Search params:', location.search);
        
        // First check URL parameters from the current location
        const params = new URLSearchParams(location.search);
        const accessToken = params.get('access_token');
        const userId = params.get('user_id');
        const username = params.get('username');
        const error = params.get('error');

        if (error) {
          setError(`Authentication failed: ${params.get('error_description') || error}`);
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // If we have all the parameters, process them
        if (accessToken && userId && username) {
          console.log('Processing OAuth data with params from URL');
          
          // Dispatch action to store credentials
          dispatch(handleOAuthCallback({ 
            accessToken, 
            userId, 
            username 
          }));

          // Clean URL parameters
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }

          // Success! Navigate to the blogs page
          navigate('/blogs', { replace: true });
          return;
        }

        // If we reach here, we don't have the expected parameters
        console.error('Missing OAuth parameters in URL');
        setError('Missing authentication data');
        setTimeout(() => navigate('/'), 3000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Failed to complete authentication');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processCallback();
  }, [dispatch, navigate, location]);

  if (error) {
    return (
      <div className="oauth-error-container">
        <div className="oauth-error">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Authentication Error</h2>
          <p>{error}</p>
          <p className="redirect-message">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return <LoadingScreen message="Completing authentication..." />;
};

export default OAuthCallback;
