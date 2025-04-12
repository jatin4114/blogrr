import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Topbar from 'shared/ui/topbar/Topbar';
import { logout } from 'features/auth/store/authSlice';
import { RootState } from 'store/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  

  

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const username = user?.username || localStorage.getItem('username') || '';

  return (
    <div className="app-layout">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      
      <Topbar 
        username={username}
        onLogout={handleLogout}
        onExploreClick={() => navigate('/blogs')}
        onProfileClick={() => navigate('/my-blogs')}
        onChatClick={() => navigate('/chats')}
        
        currentView={'explore'}
      />
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
