import { configureStore } from '@reduxjs/toolkit';
import authReducer from 'features/auth/store/authSlice';
import blogsReducer from 'features/blogs/store/blogSlice';
import chatReducer from 'features/chats/store/chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    blogs: blogsReducer,
    chat: chatReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
