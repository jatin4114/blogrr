/**
 * Centralized service for managing authentication state
 */
export class AuthService {
  /**
   * Store authentication data in localStorage
   */
  static setAuthData(token: string, userId: string | number, username: string): void {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId.toString());
    localStorage.setItem('username', username);
    
    // Dispatch a custom event that the WebSocketService can listen for
    const authChangeEvent = new CustomEvent('auth:login-success');
    window.dispatchEvent(authChangeEvent);
  }
  
  /**
   * Clear authentication data from localStorage
   */
  static clearAuthData(): void {
    // Dispatch event before clearing storage
    const authLogoutEvent = new CustomEvent('auth:logout');
    window.dispatchEvent(authLogoutEvent);
    
    // Clear storage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
  }
  
  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
  
  /**
   * Get authentication token
   */
  static getToken(): string | null {
    return localStorage.getItem('token');
  }
  
  /**
   * Get user ID
   */
  static getUserId(): string | null {
    return localStorage.getItem('userId');
  }
  
  /**
   * Get username
   */
  static getUsername(): string | null {
    return localStorage.getItem('username');
  }
  
  /**
   * Verify token is valid (basic check)
   */
  static isTokenValid(token: string): boolean {
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
}
