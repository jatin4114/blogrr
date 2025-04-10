import { useEffect, useState } from "react";
import { webSocketService, ConnectionStatus } from "@/features/chats/services/socket";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { addMessage } from "@/features/chats/store/slices/ChatSlice";
import { logout } from "@/features/auth/store/authSlice";
import { AuthService } from "@/features/auth/services/authService";

export default function UseSocket() {
  const dispatch = useDispatch();
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    webSocketService.getStatus()
  );

  // Monitor WebSocket connection status
  useEffect(() => {
    const unsubscribe = webSocketService.subscribeToStatus(setConnectionStatus);
    return unsubscribe;
  }, []);

  // Check token validity and handle connection accordingly
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      // Instead of calling AuthService.isTokenValid here we can use our similar logic:
      let valid = false;
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            valid = !(payload.exp && payload.exp * 1000 < Date.now());
          }
        } catch {
          valid = false;
        }
      }
      console.log(`Token exists: ${!!token}, Valid: ${valid}`);
      if (valid) {
        if (connectionStatus === ConnectionStatus.DISCONNECTED || connectionStatus === ConnectionStatus.ERROR) {
          console.log('Connecting WebSocket with valid token');
          webSocketService.connect();
        }
      } else if (token) {
        console.error('Token is invalid or expired, logging out');
        dispatch(logout());
      }
    } else {
      webSocketService.disconnect();
    }
  }, [isAuthenticated, connectionStatus, dispatch]);

  // Add event listeners for auth events
  useEffect(() => {
    // Connect when auth:login-success is triggered
    const handleLoginSuccess = () => {
      webSocketService.connect();
    };

    // Disconnect when auth:logout is triggered
    const handleLogout = () => {
      webSocketService.disconnect();
    };

    // Handle token invalidation
    const handleTokenInvalid = () => {
      console.error('Token is invalid or expired');
      dispatch(logout());
    };

    // Register event listeners
    window.addEventListener('auth:login-success', handleLoginSuccess);
    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:token-invalid', handleTokenInvalid);

    // Cleanup
    return () => {
      window.removeEventListener('auth:login-success', handleLoginSuccess);
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:token-invalid', handleTokenInvalid);
    };
  }, [dispatch]);

  // Register message handler
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Filter messages for the active chat
        if (message.type === 'direct' && 
            activeChatId && 
            (message.sender_id === activeChatId || message.receiver_id === activeChatId)) {
          
          dispatch(
            addMessage({
              chatId: activeChatId,
              message: {
                id: message.message_id || crypto.randomUUID(),
                sender: message.sender_id.toString(),
                content: message.message,
                timestamp: new Date(message.timestamp || Date.now()).getTime(),
              },
            })
          );
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    // Add message handler and get cleanup function
    const removeHandler = webSocketService.addMessageHandler(handleMessage);

    // Return cleanup function
    return removeHandler;
  }, [activeChatId, dispatch, isAuthenticated]);

  return connectionStatus;
}