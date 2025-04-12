import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Default storage (localStorage)
import authReducer from 'features/auth/store/authSlice';
import blogsReducer from 'features/blogs/store/blogSlice';
import { ChatReducers } from 'features/chats/store/Index';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['chat', 'contacts'], // Persist only specific slices
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  blogs: blogsReducer,
  ...ChatReducers,
});

// Wrap reducers with persistReducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Required for redux-persist
    }),
});

// Persistor for PersistGate
export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;