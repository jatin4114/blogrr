import Topbar from 'shared/ui/topbar/Topbar';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from 'features/auth/store/authSlice';
import { chatSocketService } from './services/chatSocketService';
import { groupChatSocketService } from './services/groupChatSocketService';
import ChatSidebar from './components/ChatSidebar';
import ActiveChatPanel from './components/ActiveChatPanel';
import { fetchContacts, fetchGroups, fetchUnreadCounts } from './store/chatSlice';
import { AppDispatch, RootState } from 'store/store';
import './styles/chat-styles.css';
import ErrorBoundary from '../../shared/ErrorBoundary';
import SearchUser from './components/SearchUser';

const ChatApp = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { activeChat } = useSelector((state: RootState) => state.chat);
  const username = localStorage.getItem('username') || '';
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const [showSearchUser, setShowSearchUser] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  // Initialize WebSocket connections when component mounts
  useEffect(() => {
    // Only attempt to connect if we have a valid user ID
    if (userId > 0) {
      console.log(`Initializing chat services for user ${userId}`);
      
      // Initialize WebSocket service for direct chats with small delay
      // to ensure any previous connections are properly closed
      setTimeout(() => {
        chatSocketService.connect(userId);
      }, 500);

      // Initialize the user ID for group chat service
      groupChatSocketService.setUserId(userId);

      // Fetch initial data
      dispatch(fetchContacts());
      dispatch(fetchGroups());
      dispatch(fetchUnreadCounts());
    } else {
      console.warn('No valid user ID found, chat services not initialized');
    }

    // Cleanup when component unmounts
    return () => {
      console.log('ChatApp unmounting, cleaning up connections...');
      chatSocketService.disconnect();
      groupChatSocketService.disconnectAll();
    };
  }, [dispatch, userId]);

  // Set up polling for unread counts
  useEffect(() => {
    if (!userId) return;
    
    // Poll for unread messages every minute
    const intervalId = setInterval(() => {
      dispatch(fetchUnreadCounts());
    }, 60000); // 60 seconds
    
    return () => clearInterval(intervalId);
  }, [dispatch, userId]);

  // Handle WebSocket reconnection
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser became online, reconnecting chat services...');
      if (userId) {
        chatSocketService.connect(userId);
        // Refresh data
        dispatch(fetchContacts());
        dispatch(fetchGroups());
        dispatch(fetchUnreadCounts());
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [dispatch, userId]);

  const handleNewChatClick = () => {
    setShowSearchUser(true);
  };

  return (
    <div className="chat-app">
      <Topbar 
        username={username}
        onLogout={handleLogout}
        onExploreClick={() => navigate('/blogs')}
        onProfileClick={() => navigate('/blogs')} 
        currentView={'explore'}
      />
      
      <div className="chat-container">
        <ErrorBoundary>
          <ChatSidebar onNewChat={handleNewChatClick} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ActiveChatPanel />
        </ErrorBoundary>
      </div>
      
      {showSearchUser && (
        <SearchUser onClose={() => setShowSearchUser(false)} />
      )}
    </div>
  );
};

export default ChatApp;
