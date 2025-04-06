import AuthContainer from '../components/AuthContainer';
import '../styles/Auth.css';

const AuthPage = () => {
  return (
    <div className="auth-page">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      <AuthContainer />
    </div>
  );
};

export default AuthPage;
