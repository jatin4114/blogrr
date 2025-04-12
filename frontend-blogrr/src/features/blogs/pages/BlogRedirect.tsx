import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { handleOAuthCallback } from 'features/auth/store/authSlice';
import { RootState } from 'store/store';
import BlogApp from '../BlogApp';
import LoadingScreen from 'shared/LoadingScreen';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * This component handles OAuth redirects from the backend to /blogs with query parameters
 */
const BlogRedirect = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use location to access query parameters - this is more reliable than window.location
  const location = useLocation();

  useEffect(() => {
    // Define the processing function inside useEffect to avoid stale closures
    const processOAuthParams = () => {
      try {
        console.log('BlogRedirect: Processing with location:', location);
        console.log('Full pathname:', location.pathname);
        console.log('Full search string:', location.search);
        
        // Get parameters from location.search which is more reliable
        const params = new URLSearchParams(location.search);
        
        // Debugging: Log all params found
        console.log('All URL parameters:');
        params.forEach((value, key) => {
          console.log(`${key}: ${value}`);
        });
        
        const accessToken = params.get('access_token');
        const userId = params.get('user_id');
        const username = params.get('username');

        console.log('Extracted OAuth parameters:');
        console.log('- access_token:', accessToken ? `${accessToken.substring(0, 15)}...` : 'null');
        console.log('- user_id:', userId);
        console.log('- username:', username);

        if (accessToken && userId && username && !processed && !processing) {
          console.log('Valid OAuth parameters found, starting processing...');
          setProcessing(true);
          
          // Process OAuth data
          console.log('Dispatching handleOAuthCallback with parameters');
          dispatch(handleOAuthCallback({ 
            accessToken, 
            userId, 
            username 
          }));
          
          // Small delay before cleaning URL to ensure state is updated
          setTimeout(() => {
            // Clean the URL by removing query parameters
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              console.log('Cleaned URL params, new URL:', window.location.href);
            }
            
            setProcessed(true);
            setProcessing(false);
            console.log('OAuth login processed successfully');
          }, 100);
          
          return true;
        } else if (isAuthenticated) {
          // User is already authenticated
          console.log('User is already authenticated, skipping OAuth processing');
          return false;
        } else if (!accessToken || !userId || !username) {
          // Missing parameters - expected when visiting /blogs directly
          console.log('Missing OAuth parameters - normal for direct navigation');
          return false;
        }
        
        return false;
      } catch (err) {
        console.error('Error processing OAuth parameters:', err);
        setError(`Authentication error: ${(err as Error).message}`);
        setProcessing(false);
        return false;
      }
    };

    // Only process if not already processed or processing
    if (!processed && !processing) {
      console.log('BlogRedirect component mounted, checking for OAuth parameters...');
      processOAuthParams();
    }
  }, [dispatch, isAuthenticated, processed, processing, location]);

  // If there was an error, display it
  if (error) {
    return (
      <div className="oauth-error-container">
        <div className="oauth-error">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Authentication Error</h2>
          <p>{error}</p>
          <p className="redirect-message">Please try logging in again.</p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="btn"
            style={{ marginTop: '20px' }}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // If we're still processing, show loading screen
  if (processing) {
    return <LoadingScreen message="Completing authentication..." />;
  }

  // If user is authenticated (either previously or after OAuth processing), show BlogApp
  if (isAuthenticated) {
    return <BlogApp />;
  }

  // Otherwise redirect to login page
  return <Navigate to="/" replace />;
};

export default BlogRedirect;
