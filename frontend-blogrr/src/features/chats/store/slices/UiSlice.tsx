import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Tab = 'direct' | 'groups';

interface UiState {
    activeTab: Tab;
    showEmojiPicker: boolean;
}

const initialState: UiState = {
    activeTab: 'direct',
    showEmojiPicker: false
};

const UiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setActiveTab: (state, action: PayloadAction<Tab>) => {
            state.activeTab = action.payload;
        },
        toggleEmojiPicker: (state) => {
            state.showEmojiPicker = !state.showEmojiPicker;
        }
    }
});

export const { setActiveTab, toggleEmojiPicker } = UiSlice.actions;
export default UiSlice.reducer;
