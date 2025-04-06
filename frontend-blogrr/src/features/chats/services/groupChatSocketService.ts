import { addMessage, addGroupMessage } from '../store/chatSlice';
import { store } from 'store/store';
import { GroupMessage } from '../types/groupTypes';

class GroupChatSocketService {
  private sockets: Map<number, WebSocket> = new Map();
  private userId: number = 0;
  private reconnectAttempts: Map<number, number> = new Map();
  private maxReconnectAttempts: number = 10;
  private reconnectTimeouts: Map<number, number> = new Map();
  private reconnectTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private baseUrl: string = 'ws://localhost:8000'; // Update to the correct WebSocket server base URL

  constructor() {
    // Use a consistent WebSocket URL that's accessible from browser
    this.baseUrl = 'ws://localhost:8000';
    
    // Get user ID from local storage
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      this.userId = parseInt(storedUserId);
    }
  }

  setUserId(userId: number) {
    this.userId = userId;
  }

  connectToGroup(groupId: number) {
    if (!this.userId) {
      console.error('User ID not set, cannot connect to group chat');
      return;
    }

    // Check if already connected
    if (this.sockets.has(groupId) && this.sockets.get(groupId)?.readyState === WebSocket.OPEN) {
      console.log(`Already connected to group ${groupId}`);
      return;
    }

    this.setupGroupWebSocket(groupId);
  }

  disconnectFromGroup(groupId: number) {
    const socket = this.sockets.get(groupId);
    if (socket) {
      socket.close(1000, 'User left group');
      this.sockets.delete(groupId);
    }

    // Clear any reconnect timer
    const timer = this.reconnectTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(groupId);
    }

    this.reconnectAttempts.delete(groupId);
    this.reconnectTimeouts.delete(groupId);
  }

  disconnectFromAllGroups() {
    // Close all sockets
    this.sockets.forEach((socket, groupId) => {
      this.disconnectFromGroup(groupId);
    });
  }

  private setupGroupWebSocket(groupId: number) {
    // Close existing connection if any
    this.disconnectFromGroup(groupId);

    try {
      const socketUrl = `${this.baseUrl}/ws/chat/${this.userId}`;
      console.log(`Attempting to connect to WebSocket for group ${groupId}: ${socketUrl}`);
      
      // Connect to the group chat WebSocket endpoint
      const socket = new WebSocket(socketUrl);
      this.sockets.set(groupId, socket);
      
      // Initialize timeout and attempts for this group
      if (!this.reconnectTimeouts.has(groupId)) {
        this.reconnectTimeouts.set(groupId, 2000); // Start with 2 seconds
      }
      
      if (!this.reconnectAttempts.has(groupId)) {
        this.reconnectAttempts.set(groupId, 0);
      }
      
      // Reset reconnect attempt counter on successful connection
      socket.onopen = () => {
        console.log(`WebSocket connection established for group ${groupId}`);
        this.reconnectAttempts.set(groupId, 0);
        this.reconnectTimeouts.set(groupId, 2000); // Reset timeout
      };
      
      // Handle incoming messages
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`Received message for group ${groupId}:`, data);
          
          if (data.type === 'group_message') {
            // New group message received, dispatch to Redux
            const message: GroupMessage = {
              id: data.message_id || `temp-${Date.now()}`,
              groupId: data.group_id,
              senderId: data.sender_id,
              message: data.message,
              timestamp: data.timestamp || new Date().toISOString(),
              delivered: true
            };
            
            store.dispatch(addGroupMessage(message));
          } else if (data.type === 'confirmation') {
            // Message was delivered, update status
            console.log(`Message ${data.message_id} confirmed`);
            // Could implement delivery status updates here
          } else if (data.type === 'system') {
            // System messages like user joined/left
            console.log(`System message: ${data.message}`);
          } else if (data.type === 'error') {
            // Error messages
            console.error(`WebSocket error for group ${groupId}: ${data.message}`);
          }
        } catch (error) {
          console.error(`Error parsing WebSocket message for group ${groupId}:`, error);
        }
      };
      
      // Handle errors
      socket.onerror = (error) => {
        console.error(`WebSocket error for group ${groupId}:`, error);
        console.error(`WebSocket readyState: ${socket.readyState}`);
      };
      
      // Handle disconnection and attempt to reconnect
      socket.onclose = (event) => {
        console.log(`WebSocket closed for group ${groupId} with code ${event.code}`);
        
        const attempts = this.reconnectAttempts.get(groupId) || 0;
        if (attempts < this.maxReconnectAttempts) {
          // Clear any existing reconnect timer
          const timer = this.reconnectTimers.get(groupId);
          if (timer) {
            clearTimeout(timer);
          }
          
          // Attempt to reconnect with exponential backoff
          this.reconnectAttempts.set(groupId, attempts + 1);
          console.log(`Attempting to reconnect to group ${groupId} (${attempts + 1}/${this.maxReconnectAttempts})...`);
          
          const timeout = this.reconnectTimeouts.get(groupId) || 2000;
          const newTimer = setTimeout(() => {
            this.setupGroupWebSocket(groupId);
          }, timeout);
          
          this.reconnectTimers.set(groupId, newTimer);
          
          // Increase timeout for next attempt (exponential backoff)
          this.reconnectTimeouts.set(groupId, Math.min(30000, timeout * 1.5));
        } else {
          console.error(`Maximum reconnection attempts reached for group ${groupId}`);
        }
      };
    } catch (error) {
      console.error(`Error setting up WebSocket for group ${groupId}:`, error);
      
      // Attempt reconnection after error
      const attempts = this.reconnectAttempts.get(groupId) || 0;
      if (attempts < this.maxReconnectAttempts) {
        this.reconnectAttempts.set(groupId, attempts + 1);
        const timeout = this.reconnectTimeouts.get(groupId) || 2000;
        console.log(`Error in setup for group ${groupId}, will try again in ${timeout/1000}s...`);
        
        const newTimer = setTimeout(() => {
          this.setupGroupWebSocket(groupId);
        }, timeout);
        
        this.reconnectTimers.set(groupId, newTimer);
        this.reconnectTimeouts.set(groupId, Math.min(30000, timeout * 1.5));
      }
    }
  }

  sendGroupMessage(groupId: number, message: string): boolean {
    const socket = this.sockets.get(groupId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket not connected for group ${groupId}, cannot send message`);
      return false;
    }

    try {
      const messageData = {
        message: message
      };

      socket.send(JSON.stringify(messageData));
      
      // Optimistically add message to store
      const tempId = `temp-${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      store.dispatch(addGroupMessage({
        id: tempId,
        groupId: groupId,
        senderId: this.userId,
        message: message,
        timestamp: timestamp,
        delivered: false
      }));
      
      return true;
    } catch (error) {
      console.error(`Error sending message to group ${groupId}:`, error);
      return false;
    }
  }

  disconnectAll() {
    // Clear all reconnect timers
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();
    
    // Close all WebSocket connections
    this.sockets.forEach(socket => socket.close(1000, 'User disconnected'));
    this.sockets.clear();
    
    // Reset tracking
    this.reconnectAttempts.clear();
    this.reconnectTimeouts.clear();
  }
}

// Create a singleton instance
export const groupChatSocketService = new GroupChatSocketService();