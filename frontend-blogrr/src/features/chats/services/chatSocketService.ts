import { addMessage, markMessageDelivered } from '../store/chatSlice';
import { Message } from '../types/chatTypes';
import { store } from 'store/store';

class ChatSocketService {
  private socket: WebSocket | null = null;
  private userId: number = 0;
  private reconnectAttempt: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: number = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private baseUrl: string = '';
  private isConnecting: boolean = false;

  constructor() {
    // Use a consistent WebSocket URL that's accessible from browser
    this.baseUrl = 'ws://localhost:8000';
  }

  connect(userId: number) {
    // Don't try to connect if we're already connecting
    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    // Only proceed if not already connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    this.userId = userId;
    this.setupWebSocket();
  }

  private setupWebSocket() {
    // Set the connecting flag
    this.isConnecting = true;

    // Clean up any existing connection
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.error('Error closing existing socket:', error);
      }
      this.socket = null;
    }

    const socketUrl = `${this.baseUrl}/ws/chat/${this.userId}`;
    console.log(`Attempting to connect to WebSocket: ${socketUrl}`);

    try {
      this.socket = new WebSocket(socketUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established successfully');
        this.isConnecting = false;
        this.reconnectAttempt = 0;
        this.reconnectTimeout = 2000;
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received websocket message:', data);

        if (data.type === 'message') {
          const message: Message = {
            id: data.message_id || `temp-${Date.now()}`,
            senderId: data.sender_id,
            receiverId: this.userId,
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            delivered: true
          };
          store.dispatch(addMessage(message));
        } else if (data.type === 'confirmation') {
          if (data.message_id) {
            store.dispatch(markMessageDelivered(data.message_id));
          }
        } else if (data.type === 'system') {
          console.log(`System message: ${data.message}`);
        }
      };

      this.socket.onerror = (error) => {
        this.isConnecting = false;
        console.error('WebSocket error occurred:', error);
        console.error(`WebSocket readyState: ${this.socket?.readyState}`);
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        console.log(`WebSocket closed with code ${event.code}, reason: ${event.reason}`);
        this.stopHeartbeat();

        // Don't attempt to reconnect if it was a normal closure
        if (event.code === 1000) {
          console.log("WebSocket closed normally, not reconnecting");
          return;
        }

        // Implement retry with exponential backoff
        if (this.reconnectAttempt < this.maxReconnectAttempts) {
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
          }

          this.reconnectAttempt++;
          const backoffTime = this.reconnectTimeout + (Math.random() * 1000);
          console.log(`Attempting to reconnect (${this.reconnectAttempt}/${this.maxReconnectAttempts}) in ${Math.round(backoffTime/1000)}s...`);
          
          this.reconnectTimer = setTimeout(() => {
            console.log('Executing reconnection attempt now');
            this.setupWebSocket();
          }, backoffTime);
          
          this.reconnectTimeout = Math.min(30000, this.reconnectTimeout * 1.5);
        } else {
          console.error('Maximum reconnection attempts reached');
        }
      };
    } catch (error) {
      this.isConnecting = false;
      console.error('Error setting up WebSocket:', error);
      
      // Still try to reconnect after an error
      if (this.reconnectAttempt < this.maxReconnectAttempts) {
        this.reconnectAttempt++;
        console.log(`Error in setup, will try again (${this.reconnectAttempt}/${this.maxReconnectAttempts})...`);
        
        this.reconnectTimer = setTimeout(() => {
          this.setupWebSocket();
        }, this.reconnectTimeout);
        
        this.reconnectTimeout = Math.min(30000, this.reconnectTimeout * 1.5);
      }
    }
  }

  sendMessage(receiverId: number, message: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, cannot send message');
      return false;
    }

    const messageData = {
      receiver_id: receiverId,
      message: message,
      timestamp: new Date().toISOString()
    };

    try {
      this.socket.send(JSON.stringify(messageData));
      
      // Optimistically add message to store
      const tempId = `temp-${Date.now()}`;
      store.dispatch(addMessage({
        id: tempId,
        senderId: this.userId,
        receiverId,
        message,
        timestamp: messageData.timestamp,
        delivered: false
      }));
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket service');
    // Cancel any pending reconnection attempts
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    // Only attempt to close if the socket exists and isn't already closed
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      try {
        // Use a normal closure code
        this.socket.close(1000, 'User disconnected');
      } catch (error) {
        console.error('Error during WebSocket disconnect:', error);
      }
      this.socket = null;
    }
    
    this.isConnecting = false;
  }

  private startHeartbeat() {
    this.stopHeartbeat(); // clear existing
    
    // Instead of sending ping messages, implement a connection monitoring approach
    this.heartbeatInterval = setInterval(() => {
      if (this.socket) {
        // Check if the connection is still open
        if (this.socket.readyState === WebSocket.OPEN) {
          console.log('WebSocket connection is healthy');
        } 
        // If connection is closing or closed, attempt to reconnect
        else if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
          console.log('WebSocket connection is closed or closing, attempting to reconnect');
          this.setupWebSocket();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const chatSocketService = new ChatSocketService();
