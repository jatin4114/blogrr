import { useEffect, useState } from "react";
import { webSocketService, ConnectionStatus } from "@/features/chats/services/socket";
import { useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@/store/store";
import { addMessage, updateMessageStatus, setTyping } from "@/features/chats/store/slices/ChatSlice";
import { logout } from "@/features/auth/store/authSlice";

export default function UseSocket() {
  const dispatch = useAppDispatch();
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

  // Message handler - Handle multiplexer WebSocket messages
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("Setting up message handler for authenticated user");

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        console.log("💬 WebSocket message received:", message);
        
        // Get current user ID
        const userId = localStorage.getItem('userId') || '';
        
        // Handle different message types from multiplexer
        switch (message.type) {
          case 'direct_message':
            // Process incoming direct message
            handleDirectMessage(message, userId);
            break;
            
          case 'confirmation':
            // Handle message delivery confirmation
            handleConfirmation(message, userId);
            break;
            
          case 'read_receipt':
            // Handle read receipt
            handleReadReceipt(message, userId);
            break;
            
          case 'typing':
            // Handle typing indicator
            handleTypingIndicator(message, userId);
            break;
            
          case 'error':
            console.error("WebSocket error message:", message.message);
            break;
            
          case 'system':
            console.log("System message:", message.message);
            break;
            
          case 'heartbeat_ack':
            // Just log for debugging
            console.debug("Heartbeat acknowledged:", message.timestamp);
            break;
            
          default:
            console.log(`Unhandled message type: ${message.type}`, message);
            break;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
    
    // Handler functions for different message types
    const handleDirectMessage = (message: any, userId: string) => {
      console.log("Processing direct message:", message);
      const messageId = message.message_id || crypto.randomUUID();
      const senderId = String(message.sender_id || '');
      const messageContent = message.message || '';
      
      // Enhanced timestamp parsing logic
      let timestamp: number;
      if (message.timestamp) {
        try {
          // Handle multiple possible timestamp formats
          if (typeof message.timestamp === 'number') {
            // Already a number (milliseconds)
            timestamp = message.timestamp;
          } else if (typeof message.timestamp === 'string') {
            // ISO string or other format, create date and get time
            const date = new Date(message.timestamp);
            if (!isNaN(date.getTime())) {
              timestamp = date.getTime();
            } else {
              // Fallback for non-standard formats
              timestamp = Date.now();
              console.warn(`Could not parse timestamp: ${message.timestamp}, using current time`);
            }
          } else {
            // Unknown type, use current time
            timestamp = Date.now();
          }
        } catch (e) {
          console.error("Error parsing timestamp:", e, message.timestamp);
          timestamp = Date.now();
        }
      } else {
        timestamp = Date.now();
      }
      
      if (!senderId || !messageContent) {
        console.error("Invalid message format:", message);
        return;
      }
      
      // In direct messages, the chatId is the id of the other person
      const chatId = senderId === userId ? String(message.receiver_id) : senderId;
      
      console.log(`🔑 Chat ID determined: ${chatId}, Timestamp: ${new Date(timestamp).toISOString()}`);
      
      dispatch(addMessage({
        chatId,
        message: {
          id: messageId,
          server_message_id: messageId,
          sender: senderId,
          content: messageContent,
          timestamp: timestamp,
          delivered: true,
          image: message.image || undefined,
        }
      }));
      
      // Auto-send read receipt if this is the active chat
      if (activeChatId === chatId && senderId !== userId) {
        webSocketService.sendMessage({
          type: 'read_receipt',
          content: {
            message_id: messageId,
            sender_id: senderId
          }
        });
        console.log(`📨 Sent read receipt for message ${messageId}`);
      }
    };
    
    const handleConfirmation = (message: any, userId: string) => {
      console.log("Processing confirmation message:", message);
      const clientMessageId = message.message_id;
      const serverMessageId = message.server_message_id;
      const status = message.status;
      
      if (clientMessageId) {
        dispatch(updateMessageStatus({
          messageId: clientMessageId,
          delivered: status === 'sent' || status === 'delivered',
          read: status === 'read',
          serverMessageId: serverMessageId
        }));
      }
    };
    
    const handleReadReceipt = (message: any, userId: string) => {
      console.log("Processing read receipt:", message);
      const messageId = message.message_id;
      const readerId = String(message.reader_id);
      
      if (messageId) {
        dispatch(updateMessageStatus({
          messageId: messageId,
          delivered: true,
          read: true
        }));
      }
    };
    
    const handleTypingIndicator = (message: any, userId: string) => {
      console.log("Processing typing indicator:", message);
      const typingUserId = String(message.user_id || '');
      const isTyping = Boolean(message.is_typing);
      let chatId: string;
      
      // For direct chats, from receiver's perspective, the chat_id is the sender's ID
      if (message.chat_type === 'direct') {
        chatId = typingUserId;
      } else {
        // For group chats, use the actual chat_id
        chatId = String(message.chat_id || '');
      }
      
      if (chatId && typingUserId && typingUserId !== userId) {
        dispatch(setTyping({
          chatId,
          userId: typingUserId,
          isTyping
        }));
      }
    };

    const removeHandler = webSocketService.addMessageHandler(handleMessage);
    console.log("WebSocket message handler registered");

    return () => {
      removeHandler();
      console.log("WebSocket message handler removed");
    };
  }, [dispatch, isAuthenticated, activeChatId]);

  return connectionStatus;
}


