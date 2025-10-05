// Thunk to fetch unread counts
export const fetchUnreadCounts = createAsyncThunk(
  'contacts/fetchUnreadCounts',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.by_sender;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch unread counts');
    }
  }
);
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface Contact {
  id: string;
  name: string;
  isOnline: boolean;
  lastMessage?: string | null;
  unreadCount?: number;
}

interface ContactsState {
  list: Contact[];
  loading?: boolean;
  error?: string;
}

const initialState: ContactsState = {
  list: [],
  loading: false,
  
};

export const fetchContacts = createAsyncThunk<Contact[]>(
  'contacts/fetchContacts',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/users/get_contacts`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const contacts = response.data.map((item: any) => ({
        id: item.contact.id.toString(), // Ensure `contact.id` exists in the backend response
        name: item.contact.username,    // Ensure `contact.username` exists in the backend response
        isOnline: false,                // Update this based on your logic
        lastMessage: null,
        unreadCount: 0,
      }));

      // response.data is expected to be an array of contacts formatted by your backend.
      return contacts;
    } catch (err: any) {
      return rejectWithValue(err.response.data);
    }
  }
);

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    addContact: (state, action: PayloadAction<Contact>) => {
      const exists = state.list.find(contact => contact.id === action.payload.id);
      if(!exists)
      state.list.push(action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContacts.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(fetchContacts.fulfilled, (state, action:PayloadAction<Contact[]>) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    builder.addCase(fetchUnreadCounts.fulfilled, (state, action: PayloadAction<Record<string, number>>) => {
      // Update unreadCount for each contact
      const unreadBySender = action.payload;
      state.list.forEach(contact => {
        contact.unreadCount = unreadBySender[contact.id] || 0;
      });
    });
  },
});
export const { addContact } = contactsSlice.actions;
export default contactsSlice.reducer;
