import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
// Replace AuthService import with tokenUtils helpers
import { getAuthHeader, loadAuthData, storeAuthData, clearAuthData } from '../utils/tokenUtils';

interface User {
  id: number;
  username: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper function to load auth state from localStorage
const loadAuthFromStorage = (): {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
} => {
  const { token, userId, username } = loadAuthData();
  if (token && userId && username) {
    return {
      token,
      user: { id: parseInt(userId, 10), username },
      isAuthenticated: true
    };
  }
  return { user: null, token: null, isAuthenticated: false };
};

// Helper function to safely parse userId
const safeParseInt = (value: string): number => {
  try {
    return parseInt(value, 10);
  } catch (e) {
    console.error('Error parsing userId:', e);
    return 0;
  }
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return rejectWithValue((error as Error).message || 'Network error occurred');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (
    { username, email, password }: { username: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return rejectWithValue((error as Error).message || 'Network error occurred');
    }
  }
);

export const initiateGoogleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({}) 
      });

      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.detail || 'Failed to initiate Google login');
      }

      const data = await response.json();

      if (!data.auth_url) {
        return rejectWithValue('Invalid response: No authorization URL received');
      }

      // Redirect to Google login
      window.location.href = data.auth_url;
      return data;
    } catch (error) {
      console.error('Google login error:', error);
      return rejectWithValue((error as Error).message || 'Network error occurred');
    }
  }
);

// Load initial state from localStorage using loadAuthFromStorage
const { user, token, isAuthenticated } = loadAuthFromStorage();

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user,
    token,
    isAuthenticated,
    loading: false,
    error: null
  } as AuthState,
  reducers: {
    logout: (state) => {
      // Use tokenUtils to clear auth data
      clearAuthData();
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    handleOAuthCallback: (state, action: PayloadAction<{ 
      accessToken: string; 
      userId: string; 
      username: string 
    }>) => {
      const { accessToken, userId, username } = action.payload;
      
      try {
        console.log('OAuth callback received with data:');
        console.log('- Token length:', accessToken.length);
        console.log('- User ID:', userId);
        console.log('- Username:', username);
        
        if (!accessToken || accessToken.length < 10) {
          throw new Error('Invalid access token received');
        }
        
        if (!userId) {
          throw new Error('Invalid user ID received');
        }
        
        if (!username) {
          throw new Error('Invalid username received');
        }
        
        // Store auth data using tokenUtils
        storeAuthData(accessToken, userId, username);
        
        state.token = accessToken;
        state.user = { id: safeParseInt(userId), username };
        state.isAuthenticated = true;
        state.loading = false;
        state.error = null;
        
        console.log('OAuth login complete, user is now authenticated:', username);
      } catch (error) {
        console.error('Error in handleOAuthCallback:', error);
        if (accessToken && userId && username) {
          state.isAuthenticated = true;
          state.user = { id: safeParseInt(userId), username };
        } else {
          state.error = `Authentication error: ${(error as Error).message}`;
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login actions
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.access_token;
        state.user = {
          id: action.payload.user_id,
          username: action.payload.username
        };
        state.isAuthenticated = true;
        // Store auth data using tokenUtils
        storeAuthData(
          action.payload.access_token,
          action.payload.user_id,
          action.payload.username
        );
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Registration actions
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
        // Don't set authenticated here - user still needs to login
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Google OAuth actions
      .addCase(initiateGoogleLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initiateGoogleLogin.fulfilled, (state) => {
        // Don't change state here - we're redirecting to Google
        state.loading = true;
      })
      .addCase(initiateGoogleLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { logout, clearError, handleOAuthCallback } = authSlice.actions;
export default authSlice.reducer;
