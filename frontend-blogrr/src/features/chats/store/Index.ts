import chatReducer from './slices/ChatSlice';
import contactsReducer from './slices/ContactSlice';
import uiReducer from './slices/UiSlice';
import SearchReducer from './slices/SearchSlice';

export const ChatReducers = {
  chat: chatReducer,
  contacts: contactsReducer,
  ui: uiReducer,
  search: SearchReducer
};
