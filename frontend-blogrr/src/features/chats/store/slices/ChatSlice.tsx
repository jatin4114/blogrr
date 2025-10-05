import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  delivered?: boolean;
  read?: boolean;
  server_message_id?: string; // For tracking messages using server-assigned IDs
  image?: string; // base64 image data
}

interface ChatState {
  activeChatId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>; // Use an array instead of a Set
  messageStatus: Record<string, {
    delivered: boolean;
    read: boolean;
    error?: string;
  }>;
}

const initialState: ChatState = {
  activeChatId: null,
  messages: {},
  typingUsers: {},
  messageStatus: {},
};

// Fetch chat history from server
export const fetchChatHistory = createAsyncThunk(
  'chat/fetchChatHistory',
  async (chatId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/chat/history/${chatId}/${localStorage.getItem('userId')}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("🔄 Chat history API response:", response.data);
      
      // Map the response data to our expected format
      interface ApiMessage {
        id?: string;
        sender_id?: string;
        content?: string;
        message?: string;
        timestamp?: number;
        delivered?: boolean;
        read?: boolean;
      }

  const messages = response.data?.history?.map((msg: ApiMessage): Message => ({
        id: msg.id || crypto.randomUUID(),
        sender: String(msg.sender_id || ''),
        content: msg.content || msg.message || '',
        timestamp: msg.timestamp || Date.now(),
        delivered: Boolean(msg.delivered),
        read: Boolean(msg.read),
      })) || [];
      
      return { chatId, messages };
    } catch (error) {
      console.error("❌ Error fetching chat history:", error);
      return rejectWithValue("Failed to load chat history");
    }
  }
);

// Mark messages as read
export const markMessagesAsRead = createAsyncThunk(
  'chat/markMessagesAsRead',
  async (senderId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8000/mark-read/${senderId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return senderId;
    } catch (error) {
      console.error("Error marking messages as read:", error);
      return rejectWithValue("Failed to mark messages as read");
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChatId: (state, action: PayloadAction<string>) => {
      state.activeChatId = action.payload;
      console.log(`Active chat set to: ${action.payload}`);
    },
    
    addMessage: (state, action: PayloadAction<{ chatId: string; message: Message }>) => {
      const { chatId, message } = action.payload;

      // Skip if chatId or message is invalid
      if (!chatId || !message) {
        console.error("Invalid message data:", { chatId, message });
        return;
      }

      console.log(`📝 Adding message to chatId ${chatId}:`, message);

      // Ensure the chatId exists in the messages object and is an array
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }

      // Check if the message already exists to avoid duplicates
      // For better identification, we check both client-generated id and server_message_id
      const existingMessageIndex = state.messages[chatId].findIndex(m => 
        (m.id === message.id) || 
        (message.server_message_id && m.server_message_id === message.server_message_id) ||
        (m.sender === message.sender && 
         m.content === message.content && 
         Math.abs(m.timestamp - message.timestamp) < 5000) // Within 5 seconds
      );

      if (existingMessageIndex === -1) {
        // Message doesn't exist, add it
        state.messages[chatId].push(message);
        console.log(`✅ Message added to Redux store for chatId ${chatId}`);
      } else {
        // Message exists, update it with new details but keep content
        const existingMessage = state.messages[chatId][existingMessageIndex];
        state.messages[chatId][existingMessageIndex] = {
          ...existingMessage,
          ...message,
          // Preserve content if the new message doesn't have it
          content: message.content || existingMessage.content,
          // Keep track of server message ID for future updates
          server_message_id: message.server_message_id || existingMessage.server_message_id,
        };
        console.log(`📌 Updated existing message in Redux store for chatId ${chatId}`);
      }

      // Also update messageStatus if needed
      if (message.id) {
        state.messageStatus[message.id] = {
          delivered: message.delivered || false,
          read: message.read || false,
        };
      }
    },
    
    updateMessageStatus: (state, action: PayloadAction<{ 
      messageId: string; 
      delivered?: boolean; 
      read?: boolean;
      error?: string;
      serverMessageId?: string;
    }>) => {
      const { messageId, delivered, read, error, serverMessageId } = action.payload;
      
      // Update the message status tracking
      if (!state.messageStatus[messageId]) {
        state.messageStatus[messageId] = { delivered: false, read: false };
      }
      
      if (delivered !== undefined) {
        state.messageStatus[messageId].delivered = delivered;
      }
      
      if (read !== undefined) {
        state.messageStatus[messageId].read = read;
      }
      
      if (error !== undefined) {
        state.messageStatus[messageId].error = error;
      }
      
      // Find the message in all chats and update its status
      Object.keys(state.messages).forEach(chatId => {
        const msgIndex = state.messages[chatId].findIndex(
          msg => msg.id === messageId || 
                (serverMessageId && msg.server_message_id === serverMessageId)
        );
        
        if (msgIndex !== -1) {
          if (delivered !== undefined) {
            state.messages[chatId][msgIndex].delivered = delivered;
          }
          if (read !== undefined) {
            state.messages[chatId][msgIndex].read = read;
          }
          if (serverMessageId) {
            state.messages[chatId][msgIndex].server_message_id = serverMessageId;
          }
        }
      });
      
      console.log(`💬 Message ${messageId} status updated: delivered=${delivered}, read=${read}`);
    },
    
    setTyping: (state, action: PayloadAction<{ chatId: string; userId: string; isTyping: boolean }>) => {
      const { chatId, userId, isTyping } = action.payload;

      // Skip if chatId or userId is invalid
      if (!chatId || !userId) {
        console.error("Invalid typing data:", { chatId, userId, isTyping });
        return;
      }

      console.log(`⌨️ Setting typing status: user=${userId}, chat=${chatId}, isTyping=${isTyping}`);

      // Ensure the chatId exists in the typingUsers object and is an array
      if (!Array.isArray(state.typingUsers[chatId])) {
        state.typingUsers[chatId] = [];
      }

      if (isTyping) {
        // Add the user to the typing array if not already present
        if (!state.typingUsers[chatId].includes(userId)) {
          state.typingUsers[chatId].push(userId);
          console.log(`User ${userId} is now typing in chat ${chatId}`);
        }
      } else {
        // Remove the user from the typing array
        state.typingUsers[chatId] = state.typingUsers[chatId].filter(id => id !== userId);
        console.log(`User ${userId} stopped typing in chat ${chatId}`);
      }
    },
    
    clearMessages: (state, action: PayloadAction<string>) => {
      const chatId = action.payload;

      // Clear messages for the specified chat
      if (Array.isArray(state.messages[chatId])) {
        state.messages[chatId] = [];
        console.log(`Cleared messages for chatId ${chatId}`);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatHistory.fulfilled, (state, action) => {
        const { chatId, messages } = action.payload;
        state.messages[chatId] = messages;
        console.log(`📚 Chat history fetched for chatId=${chatId}, ${messages.length} messages`);
      })
      .addCase(markMessagesAsRead.fulfilled, (state, action) => {
        const senderId = action.payload as string;
        
        // Update all messages from this sender as read
        if (state.messages[senderId]) {
          state.messages[senderId].forEach(msg => {
            if (msg.sender === senderId) {
              msg.read = true;
              
              // Also update in messageStatus
              if (state.messageStatus[msg.id]) {
                state.messageStatus[msg.id].read = true;
              }
            }
          });
        }
        
        console.log(`📚 Marked all messages from ${senderId} as read`);
      });
  },
});

export const { setActiveChatId, addMessage, setTyping, clearMessages, updateMessageStatus } = chatSlice.actions;
export default chatSlice.reducer;