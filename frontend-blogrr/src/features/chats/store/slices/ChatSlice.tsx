import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

interface ChatState {
  activeChatId: string | null;
  messages: Record<string, Message[]>;
}

const initialState: ChatState = {
  activeChatId: '1',
  messages: {
    '1': [
      {
        id: 'm1',
        sender: '1',
        content: 'Hello!',
        timestamp: Date.now()
      },
      {
        id: 'm2',
        sender: 'me',
        content: 'Hi there!',
        timestamp: Date.now()
      }
    ]
  }
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChatId: (state, action: PayloadAction<string>) => {
      state.activeChatId = action.payload;
    },
    addMessage: (state, action: PayloadAction<{ chatId: string; message: Message }>) => {
      const { chatId, message } = action.payload;
      if (!state.messages[chatId]) state.messages[chatId] = [];
      state.messages[chatId].push(message);
    }
  }
});

export const { setActiveChatId, addMessage } = chatSlice.actions;
export default chatSlice.reducer;
