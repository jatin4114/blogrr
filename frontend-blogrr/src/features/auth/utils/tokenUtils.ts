/**
 * Helper functions for token management
 */

// Store auth data in localStorage
export const storeAuthData = (token: string, userId: string | number, username: string): void => {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId.toString());
  localStorage.setItem('username', username);
};

// Remove auth data from localStorage
export const clearAuthData = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
};

// Load auth data from localStorage
export const loadAuthData = (): {
  token: string | null;
  userId: string | null;
  username: string | null;
} => {
  return {
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('userId'),
    username: localStorage.getItem('username')
  };
};

// Check if user is authenticated based on localStorage
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('token');
  return !!token;
};

// Get authorization header for API requests
export const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
