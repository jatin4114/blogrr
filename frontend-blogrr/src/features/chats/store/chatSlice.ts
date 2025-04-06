import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Contact } from '../types/chatTypes';
import { Group, GroupMessage } from '../types/groupTypes';
import { ChatState, Message, ChatType, ActiveChat } from '../types/chatTypes';
import { UserBasic } from '../types/userTypes';

// Create API base URL - Fix this to point to the actual backend server
const API_URL = 'http://localhost:8000'; // Ensure this matches your backend server address
console.log("Using API URL:", API_URL);

// Fix the endpoint methods to match the backend implementation
export const fetchContacts = createAsyncThunk(
  'chat/fetchContacts',
  async (_, { rejectWithValue }) => {
    try {
      // Change from POST to GET method since the endpoint doesn't accept POST
      const response = await axios.get(`${API_URL}/users/get_contacts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log("Contacts response:", response.data);
      return response.data || []; // Return empty array as fallback
    } catch (error) {
      console.error("Error fetching contacts:", error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('Failed to fetch contacts');
    }
  }
);

export const fetchGroups = createAsyncThunk(
  'chat/fetchGroups',
  async (_, { rejectWithValue }) => {
    try {
      // Remove /api prefix from the URL
      const response = await axios.get(`${API_URL}/chat/groups`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log("Groups response:", response.data);
      return response.data || []; // Return empty array as fallback
    } catch (error) {
      console.error("Error fetching groups:", error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('Failed to fetch groups');
    }
  }
);

export const fetchChatHistory = createAsyncThunk(
  'chat/fetchChatHistory',
  async ({ type, id }: { type: ChatType, id: number }, { rejectWithValue }) => {
    try {
      let endpoint = '';
      const userId = localStorage.getItem('userId');
      
      if (!userId) {
        return rejectWithValue('User ID not found in local storage');
      }
      
      if (type === ChatType.SINGLE) {
        // Use userId from localStorage instead of hardcoding or expecting candidateId
        endpoint = `${API_URL}/chat_messages/chat/history/${userId}/${id}`;
      } else {
        endpoint = `${API_URL}/chat/groups/${id}/messages`;
      }
      
      console.log(`Fetching chat history from: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('Chat history response:', response.data);
      
      // Normalize response format based on chat type
      const messages = type === ChatType.SINGLE ? 
        (response.data.history || []) : 
        (response.data || []);

      // For single chat, sort messages by timestamp in ascending order
      if (type === ChatType.SINGLE) {
        messages.sort((a: Message, b: Message) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
        
      return { type, id, messages };
    } catch (error) {
      console.error('Error fetching chat history:', error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(`Failed to fetch chat history for ${type} ${id}`);
    }
  }
);

export const createGroup = createAsyncThunk(
  'chat/createGroup',
  async (groupData: { name: string, description?: string, members: number[] }, { rejectWithValue }) => {
    try {
      // First create the group - Remove /api prefix from the URL
      const response = await axios.post(
        `${API_URL}/chat/groups`, 
        { name: groupData.name, description: groupData.description },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const groupId = response.data.id;
      
      // Then add members to it (if any) - Remove /api prefix from the URL
      if (groupData.members && groupData.members.length > 0) {
        await Promise.all(groupData.members.map(userId => 
          axios.post(
            `${API_URL}/chat/groups/${groupId}/members`,
            { user_id: userId, role: 'member' },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            }
          )
        ));
      }
      
      // Return the created group
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('Failed to create group');
    }
  }
);

export const markMessagesAsRead = createAsyncThunk(
  'chat/markMessagesAsRead',
  async ({ type, id }: { type: ChatType, id: number }, { rejectWithValue }) => {
    try {
      let endpoint = '';
      if (type === ChatType.SINGLE) {
        // Use the new endpoint we created
        endpoint = `${API_URL}/chat_messages/mark-read/${id}`;
      } else {
        // Group chat endpoint
        endpoint = `${API_URL}/chat/groups/${id}/mark-read`;
      }
      
      console.log(`Marking messages as read at: ${endpoint}`);
      
      const response = await axios.post(endpoint, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('Mark as read response:', response.data);
      return { type, id, count: response.data.count || 0 };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(`Failed to mark messages as read for ${type} ${id}`);
    }
  }
);

export const fetchUnreadCounts = createAsyncThunk(
  'chat/fetchUnreadCounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/chat_messages/unread-count`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log("Unread counts response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching unread counts:", error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('Failed to fetch unread counts');
    }
  }
);

export const searchUsers = createAsyncThunk(
  'chat/searchUsers',
  async ({ searchTerm, page = 1, size = 10 }: { searchTerm: string; page?: number; size?: number }, { rejectWithValue }) => {
    try {
      console.log(`Sending search request to backend: ${API_URL}/users/search`);
      
      // Get the auth token
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("No authentication token found in localStorage");
        return rejectWithValue('Authentication token not found');
      }
      
      console.log("Authorization header will use token:", token.substring(0, 10) + "...");
      
      // Use GET request with query parameters (not POST with body)
      const response = await axios.get(`${API_URL}/users/search`, {
        params: {
          search_term: searchTerm,
          page,
          size
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log("Backend search response data:", response.data);
      
      // Handle various response formats
      if (response.data && response.data.items) {
        return {
          users: response.data.items,
          total: response.data.total,
          page: response.data.page,
          size: response.data.size
        };
      } else if (Array.isArray(response.data)) {
        return {
          users: response.data,
          total: response.data.length,
          page: 1,
          size: response.data.length
        };
      } else {
        console.warn("Unexpected response format:", response.data);
        return {
          users: [],
          total: 0, 
          page: 1,
          size: 10
        };
      }
    } catch (error) {
      console.error("Search API error:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response status:", error.response?.status);
        console.error("Response data:", error.response?.data);
        
        // Add specific error handling for common issues
        if (error.response?.status === 401) {
          console.error("Authentication failed. Token may be invalid or expired.");
          // You could attempt to refresh the token here if you have that mechanism
        } else if (error.response?.status === 405) {
          console.error("Method not allowed. The endpoint doesn't support this HTTP method.");
        }
        
        return rejectWithValue(error.response?.data || 'API request failed');
      }
      return rejectWithValue('Failed to search users: Network error');
    }
  }
);

// Initial state
const initialState: ChatState = {
  contacts: [], // Ensure contacts is initialized as an array
  groups: [],   // Ensure groups is initialized as an array
  activeChat: null,
  isLoading: false,
  isContactsLoading: false, // Add explicit initialization
  isGroupsLoading: false,   // Add explicit initialization
  error: null,
  searchResults: {  // Ensure searchResults is initialized
    users: [],
    total: 0,
    page: 1,
    size: 10
  },
  isSearching: false,
  searchError: null,
  unreadCounts: {  // Add unread counts tracking
    total: 0,
    bySender: {}
  }
};

// Create the slice
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChat: (state, action: PayloadAction<{ type: ChatType, id: number }>) => {
      const { type, id } = action.payload;
      // Prevent redundant API calls by checking if the active chat is already set
      if (
        state.activeChat?.type === type &&
        ((type === ChatType.SINGLE && state.activeChat.contactId === id) ||
         (type === ChatType.GROUP && state.activeChat.groupId === id))
      ) {
        return;
      }
      
      // Set up the active chat object
      let newActiveChat: ActiveChat = {
        type,
        messages: [],
        isLoading: true
      };
      
      if (type === ChatType.SINGLE) {
        newActiveChat.contactId = id;
      } else {
        newActiveChat.groupId = id;
      }
      
      // Check if we already have message history
      if (state.activeChat?.type === type) {
        if ((type === ChatType.SINGLE && state.activeChat.contactId === id) || 
            (type === ChatType.GROUP && state.activeChat.groupId === id)) {
          // Keep existing messages if we're just reactivating the same chat
          newActiveChat.messages = state.activeChat.messages;
          newActiveChat.isLoading = false;
        }
      }
      
      state.activeChat = newActiveChat;
      
      // Reset unread counter for this chat
      if (type === ChatType.SINGLE) {
        const contactIndex = state.contacts.findIndex(c => c.id === id);
        if (contactIndex >= 0) {
          state.contacts[contactIndex].unreadCount = 0;
        }
      } else {
        const groupIndex = state.groups.findIndex(g => g.id === id);
        if (groupIndex >= 0) {
          state.groups[groupIndex].unreadCount = 0;
        }
      }
    },
    clearActiveChat: (state) => {
      state.activeChat = null;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      const userId = parseInt(localStorage.getItem('userId') || '0');
      
      // Update the activeChat if this message belongs to it
      if (state.activeChat?.type === ChatType.SINGLE) {
        const contactId = state.activeChat.contactId;
        
        if ((message.senderId === userId && message.receiverId === contactId) || 
            (message.senderId === contactId && message.receiverId === userId)) {
          // Add to active chat
          state.activeChat.messages.push(message);
          // Sort by timestamp
          state.activeChat.messages.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
      }
      
      // Update the contact's last message
      const contactIndex = state.contacts.findIndex(c => 
        c.id === (message.senderId === userId ? message.receiverId : message.senderId));
      
      if (contactIndex >= 0) {
        const contact = state.contacts[contactIndex];
        contact.lastMessage = {
          content: message.message,
          timestamp: message.timestamp,
          senderName: message.senderId === userId ? 'You' : contact.username
        };
        
        // Increment unread count if the message is not from the current user 
        // and it's not the active chat
        if (message.senderId !== userId && 
            (!state.activeChat || 
             state.activeChat.type !== ChatType.SINGLE || 
             state.activeChat.contactId !== contact.id)) {
          contact.unreadCount = (contact.unreadCount || 0) + 1;
        }
        
        // Move the contact to the top of the list
        if (contactIndex > 0) {
          const updatedContact = { ...contact };
          state.contacts.splice(contactIndex, 1);
          state.contacts.unshift(updatedContact);
        }
      }
    },
    addGroupMessage: (state, action: PayloadAction<GroupMessage>) => {
      const message = action.payload;
      const userId = parseInt(localStorage.getItem('userId') || '0');
      
      // Update the activeChat if this message belongs to it
      if (state.activeChat?.type === ChatType.GROUP && 
          state.activeChat.groupId === message.groupId) {
        // Add to active chat
        state.activeChat.messages.push(message);
        // Sort by timestamp
        state.activeChat.messages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      
      // Update the group's last message
      const groupIndex = state.groups.findIndex(g => g.id === message.groupId);
      
      if (groupIndex >= 0) {
        const group = state.groups[groupIndex];
        
        // Find sender's name
        let senderName = 'Unknown';
        const sender = state.contacts.find(c => c.id === message.senderId);
        if (sender) {
          senderName = sender.username;
        } else if (message.senderId === userId) {
          senderName = 'You';
        }
        
        group.lastMessage = {
          content: message.message,
          timestamp: message.timestamp,
          senderName
        };
        
        // Increment unread count if the message is not from the current user
        // and it's not the active chat
        if (message.senderId !== userId && 
            (!state.activeChat || 
             state.activeChat.type !== ChatType.GROUP || 
             state.activeChat.groupId !== group.id)) {
          group.unreadCount = (group.unreadCount || 0) + 1;
        }
        
        // Move the group to the top of the list
        if (groupIndex > 0) {
          const updatedGroup = { ...group };
          state.groups.splice(groupIndex, 1);
          state.groups.unshift(updatedGroup);
        }
      }
    },
    markMessageDelivered: (state, action: PayloadAction<string>) => {
      const messageId = action.payload;
      
      if (state.activeChat) {
        const messageIndex = state.activeChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex >= 0) {
          state.activeChat.messages[messageIndex].delivered = true;
        }
      }
    },
    resetUnreadCounter: (state, action: PayloadAction<{ type: ChatType, id: number }>) => {
      const { type, id } = action.payload;
      
      if (type === ChatType.SINGLE) {
        const contactIndex = state.contacts.findIndex(c => c.id === id);
        if (contactIndex >= 0) {
          state.contacts[contactIndex].unreadCount = 0;
        }
      } else {
        const groupIndex = state.groups.findIndex(g => g.id === id);
        if (groupIndex >= 0) {
          state.groups[groupIndex].unreadCount = 0;
        }
      }
    },
    updateContactOnlineStatus: (state, action: PayloadAction<{ userId: number, isOnline: boolean }>) => {
      const { userId, isOnline } = action.payload;
      const contactIndex = state.contacts.findIndex(c => c.id === userId);
      
      if (contactIndex >= 0) {
        state.contacts[contactIndex].isOnline = isOnline;
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch contacts
    builder.addCase(fetchContacts.pending, (state) => {
      state.isContactsLoading = true;
      state.error = null;
    });
    builder.addCase(fetchContacts.fulfilled, (state, action) => {
      state.isContactsLoading = false;
      state.contacts = action.payload || [];
    });
    builder.addCase(fetchContacts.rejected, (state, action) => {
      state.isContactsLoading = false;
      state.error = action.payload as string;
    });
    
    // Fetch groups
    builder.addCase(fetchGroups.pending, (state) => {
      state.isGroupsLoading = true;
      state.error = null;
    });
    builder.addCase(fetchGroups.fulfilled, (state, action) => {
      state.isGroupsLoading = false;
      state.groups = action.payload || [];
    });
    builder.addCase(fetchGroups.rejected, (state, action) => {
      state.isGroupsLoading = false;
      state.error = action.payload as string;
    });
    
    // Fetch chat history
    builder.addCase(fetchChatHistory.pending, (state) => {
      if (state.activeChat) {
        state.activeChat.isLoading = true;
      }
      state.error = null;
    });
    builder.addCase(fetchChatHistory.fulfilled, (state, action) => {
      const { type, id, messages } = action.payload;
      
      if (state.activeChat && 
          ((type === ChatType.SINGLE && state.activeChat.type === ChatType.SINGLE && state.activeChat.contactId === id) ||
           (type === ChatType.GROUP && state.activeChat.type === ChatType.GROUP && state.activeChat.groupId === id))) {
        state.activeChat.messages = messages;
        state.activeChat.isLoading = false;
      }
      
      // Reset unread counter
      if (type === ChatType.SINGLE) {
        const contactIndex = state.contacts.findIndex(c => c.id === id);
        if (contactIndex >= 0) {
          state.contacts[contactIndex].unreadCount = 0;
        }
      } else {
        const groupIndex = state.groups.findIndex(g => g.id === id);
        if (groupIndex >= 0) {
          state.groups[groupIndex].unreadCount = 0;
        }
      }
    });
    builder.addCase(fetchChatHistory.rejected, (state, action) => {
      if (state.activeChat) {
        state.activeChat.isLoading = false;
      }
      state.error = action.payload as string;
    });
    
    // Create group
    builder.addCase(createGroup.fulfilled, (state, action) => {
      // Add the new group to the state
      state.groups.unshift({
        id: action.payload.id,
        name: action.payload.name,
        description: action.payload.description,
        members: [], // Will be populated later
        lastMessage: null,
        unreadCount: 0
      });
    });
    
    // Mark messages as read
    builder.addCase(markMessagesAsRead.fulfilled, (state, action) => {
      const { type, id } = action.payload;
      
      if (type === ChatType.SINGLE) {
        const contactIndex = state.contacts.findIndex(c => c.id === id);
        if (contactIndex >= 0) {
          state.contacts[contactIndex].unreadCount = 0;
        }
      } else {
        const groupIndex = state.groups.findIndex(g => g.id === id);
        if (groupIndex >= 0) {
          state.groups[groupIndex].unreadCount = 0;
        }
      }
      
      // If this is the active chat, mark all messages as read
      if (state.activeChat && 
          ((type === ChatType.SINGLE && state.activeChat.type === ChatType.SINGLE && state.activeChat.contactId === id) ||
           (type === ChatType.GROUP && state.activeChat.type === ChatType.GROUP && state.activeChat.groupId === id))) {
        state.activeChat.messages.forEach(message => {
          if (message.senderId !== parseInt(localStorage.getItem('userId') || '0')) {
            message.read = true;
          }
        });
      }
    });
    
    // Fetch unread counts
    builder.addCase(fetchUnreadCounts.fulfilled, (state, action) => {
      state.unreadCounts = {
        total: action.payload.total || 0,
        bySender: action.payload.by_sender || {}
      };
      
      // Update unread counts for contacts
      if (action.payload.by_sender) {
        for (const [senderId, count] of Object.entries(action.payload.by_sender)) {
          const contactIndex = state.contacts.findIndex(c => c.id === parseInt(senderId));
          if (contactIndex >= 0) {
            state.contacts[contactIndex].unreadCount = count as number;
          }
        }
      }
    });
    
    // Search users
    builder.addCase(searchUsers.pending, (state) => {
      state.isSearching = true;
      state.searchError = null;
    });
    builder.addCase(searchUsers.fulfilled, (state, action) => {
      state.isSearching = false;
      state.searchResults = action.payload;
    });
    builder.addCase(searchUsers.rejected, (state, action) => {
      state.isSearching = false;
      state.searchError = action.payload as string;
    });
  }
});

export const { 
  setActiveChat, 
  clearActiveChat, 
  addMessage, 
  addGroupMessage,
  markMessageDelivered,
  resetUnreadCounter,
  updateContactOnlineStatus
} = chatSlice.actions;

export default chatSlice.reducer;