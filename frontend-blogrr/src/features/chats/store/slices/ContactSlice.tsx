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
        id: item.contact.id.toString(),
        name: item.contact.username,
        isOnline: false, // You can update this based on your logic
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
  },
});
export const { addContact } = contactsSlice.actions;
export default contactsSlice.reducer;
