const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:8000/ws/multiplex';

// Define message handler type
type MessageHandler = (event: MessageEvent) => void;
type MessageType = 'direct_message' | 'group' |'read_receipt'| 'system' | 'error' | 'heartbeat' | 'typing' | 'auth' | 'presence';

// Message structure for sending
interface SocketMessage {
  type: MessageType;
  [key: string]: any;
}

// Status of WebSocket connection
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * WebSocketService - Singleton class to handle WebSocket connections with improved state management
 */
class WebSocketService {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private messageHandlers: MessageHandler[] = [];
  private reconnectTimeout: number | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS: number = 10;
  private readonly RECONNECT_DELAY: number = 3000; // 3 seconds
  private heartbeatInterval: number | null = null;
  
  // Listeners for status changes
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];

  constructor() {
    // Check if token exists on startup and set initial status
    const token = this.getToken();
    if (token) {
      this.status = ConnectionStatus.DISCONNECTED;
    }
    
    // Add event listener for storage changes (for multi-tab support)
    window.addEventListener('storage', this.handleStorageChange);
  }

  /**
   * Handle localStorage changes (for multi-tab support)
   */
  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === 'token') {
      if (!event.newValue) {
        // Token was removed, disconnect
        this.disconnect();
      } else if (!this.socket && event.newValue) {
        // New token was added and we're not connected
        this.connect();
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  subscribeToStatus(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    // Immediately notify of current status
    callback(this.status);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Update connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    // Notify all listeners
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Get the current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get the token directly from localStorage (avoiding a circular dependency with AuthService)
   */
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }

  /**
   * Check if token is valid (basic implementation)
   */
  private isTokenValid(token: string): boolean {
    if (!token) return false;
    
    try {
      // Simple structure validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Check expiration if possible
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return false;
        }
      } catch {
        // If we can't parse the payload, assume it's still valid
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect a WebSocket and add authentication information
   */
  connect(): void {
    // Don't proceed if already connecting or connected
    if (this.status === ConnectionStatus.CONNECTING || 
        this.status === ConnectionStatus.CONNECTED) {
      return;
    }

    const token = this.getToken();
    // NEW: Retrieve the user ID from localStorage
    const userId = localStorage.getItem('userId') || '';
    if (!token || !userId) {
      console.warn('Cannot connect: missing authentication token or user ID');
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);
    this.cleanupSocket(); // Ensure any previous socket is properly closed
    
    try {
      console.log('Creating new WebSocket connection');
      
      // Use the multiplexer endpoint which provides improved delivery status tracking
      const url = `${SOCKET_URL}`;
      console.log('Connecting to WebSocket URL:', url);
      
      this.socket = new WebSocket(url);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.setStatus(ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect the WebSocket
   */
  disconnect(): void {
    console.log('Disconnecting WebSocket');
    this.cancelHeartbeat();
    this.cleanupSocket();
    this.cancelReconnect();
    this.reconnectAttempts = 0;
    this.setStatus(ConnectionStatus.DISCONNECTED);
  }

  /**
   * Clean up the existing socket
   */
  private cleanupSocket(): void {
    if (this.socket) {
      // Remove event listeners to avoid memory leaks
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Close connection if open
      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      
      this.socket = null;
    }
  }

  /**
   * Setup heartbeat to keep connection alive
   */
  private setupHeartbeat(): void {
    this.cancelHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      this.sendMessage({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      });
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Cancel the heartbeat interval
   */
  private cancelHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Add a message handler
   */
  addMessageHandler(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => this.removeMessageHandler(handler);
  }

  /**
   * Remove a message handler
   */
  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  /**
   * Send a message through the WebSocket
   */
  sendMessage(message: SocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      // Add timestamp to all outgoing messages if not already present
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      // Log all outgoing messages
      console.log('📤 Sending WebSocket message:', message);
      
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    console.log('WebSocket connected successfully');
    
    // Send authentication message with token after connection is established
    const token = this.getToken();
    const userId = localStorage.getItem('userId') || '';
    if (token && userId) {
      // Send initial auth message - use the proper format expected by the multiplexer
      if (token.length > 20) {
        // Looks like a JWT token
        this.sendMessage({
          token: token,
          type: "auth"
        });
      } else {
        // Might be a development mode direct user_id
        this.sendMessage({
          user_id: parseInt(userId, 10),
          type: "auth"
        });
      }
      
      // Also send presence update to let server know user is online
      setTimeout(() => {
        this.sendMessage({
          type: 'presence',
          content: {
            status: 'online'
          }
        });
        console.log('Presence update sent to WebSocket');
      }, 500);
      
      console.log('Authentication message sent to WebSocket');
    } else {
      console.error('Cannot authenticate: missing token or user ID');
    }
    
    this.setStatus(ConnectionStatus.CONNECTED);
    this.reconnectAttempts = 0;
    this.setupHeartbeat();
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket disconnected: ${event.code} - ${event.reason || 'No reason provided'}`);
    this.cancelHeartbeat();
    this.socket = null;
    
    if (event.code === 1000) {
      // Normal closure, don't reconnect
      this.setStatus(ConnectionStatus.DISCONNECTED);
    } else if (event.code === 1008 || event.code === 403) {
      // Policy violation (likely auth issue) or Forbidden (403)
      this.setStatus(ConnectionStatus.ERROR);
      console.error('Authentication failed. Please log in again.');
      
      // Token might be invalid or expired
      const token = this.getToken();
      if (token) {
        const isValid = this.isTokenValid(token);
        console.log('Current token validity:', isValid);
        
        // If authentication failed, we could dispatch a custom event
        // that the auth system can listen for
        if (!isValid) {
          const authErrorEvent = new CustomEvent('auth:token-invalid');
          window.dispatchEvent(authErrorEvent);
        }
      }
    } else {
      // Abnormal closure, attempt reconnect
      this.setStatus(ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.setStatus(ConnectionStatus.ERROR);
    // Error is usually followed by close event
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Log all incoming messages for debugging
      console.log('🔔 WebSocket raw message received:', data);
      
      // Special handling for system messages
      if (data.type === 'system') {
        console.log('System message received:', data.message);
        return;
      }
      
      // Notify all handlers with raw event
      if (this.messageHandlers.length === 0) {
        console.warn('No message handlers registered to process this message');
      }
      
      this.messageHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    this.cancelReconnect();
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Maximum reconnect attempts reached');
      return;
    }
    
    // Exponential backoff with jitter
    const delay = this.RECONNECT_DELAY * 
                  Math.pow(1.5, this.reconnectAttempts) * 
                  (0.9 + Math.random() * 0.2); // Add jitter
                  
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${Math.round(delay)}ms`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Cancel any pending reconnect attempt
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  /**
   * Cleanup resources when service is no longer needed
   */
  destroy(): void {
    window.removeEventListener('storage', this.handleStorageChange);
    this.disconnect();
    this.messageHandlers = [];
    this.statusListeners = [];
  }
}

// Create and export a singleton instance
export const webSocketService = new WebSocketService();

// For backward compatibility - all calls should eventually migrate to using the service directly
export const socket = {
  get current() {
    return webSocketService.getStatus() === ConnectionStatus.CONNECTED ? 
      webSocketService['socket'] : null;
  }
};

export function reconnectSocket(): WebSocket | null {
  webSocketService.connect();
  return webSocketService['socket'];
}

export function initializeSocket(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    webSocketService.connect();
  } else {
    webSocketService.disconnect();
  }
}