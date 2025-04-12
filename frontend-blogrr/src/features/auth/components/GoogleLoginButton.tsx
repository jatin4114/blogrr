import { useDispatch, useSelector } from 'react-redux';
import { initiateGoogleLogin } from '../store/authSlice';
import { AppDispatch, RootState } from 'store/store';
import '../styles/GoogleLoginButton.css';

const GoogleLoginButton = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.auth);

  const handleGoogleLogin = () => {
    dispatch(initiateGoogleLogin());
  };

  return (
    <button 
      className="oauth-btn google-btn"
      onClick={handleGoogleLogin}
      disabled={loading}
    >
      <i className="fab fa-google"></i> 
      {loading ? 'Connecting...' : 'Login with Google'}
    </button>
  );
};

export default GoogleLoginButton;
