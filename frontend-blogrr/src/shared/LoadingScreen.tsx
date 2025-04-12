import './LoadingScreen.css';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ message = 'Loading Blogrr' }: LoadingScreenProps) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <h2>{message}</h2>
        <p>Please wait while we load your content...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
