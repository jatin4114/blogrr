import { createSlice } from '@reduxjs/toolkit';

interface Contact {
  id: string;
  name: string;
  isOnline: boolean;
}

interface ContactsState {
  list: Contact[];
}

const initialState: ContactsState = {
  list: [
    { id: '1', name: 'John Doe', isOnline: true },
    { id: '2', name: 'Jane Smith', isOnline: false },
    { id: '3', name: 'Alice', isOnline: true }
  ]
};

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {}
});

export default contactsSlice.reducer;
