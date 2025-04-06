import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';

const AuthRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    
    if (token) {
      // User is authenticated, redirect to blogs page
      navigate('/blogs');
    } else {
      // No token found, still go to blogs page where auth screen will show
      navigate('/blogs');
    }
  }, [navigate]);

  // Show loading screen while redirecting
  return <LoadingScreen />;
};

export default AuthRedirect;
