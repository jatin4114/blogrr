import { createAsyncThunk,createSlice,PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";  

interface SearchUser {
id:number,
email:string,
username:string,
}

interface SearchState {
    results: SearchUser[];
    loading: boolean;
    query: string
}

const initialState: SearchState = {
    results: [],
    loading: false,
    query: "",
};

export const FetchSearchUsers = createAsyncThunk(
    'search/fetchUsers',
    async (query: string) => {
        const token = localStorage.getItem('token');
        const response =await axios.get(`http://localhost:8000/users/search`,{
            params: {
                search_term: query,
                page: 1,
                size: 10,
            },
        
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data.items ?? []; // Return an empty array if no users found
    }
);

const SearchSlice = createSlice({
    name: 'search',
    initialState,
    reducers: {
        clearResults: (state) => {
            state.results = [];
            state.query = "";
        },
        setQuery: (state, action: PayloadAction<string>) => {
            state.query = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(FetchSearchUsers.pending, (state) => {
                state.loading = true;
            })
            .addCase(FetchSearchUsers.fulfilled, (state, action) => {
                state.results = action.payload;
                state.loading = false;
            })
            .addCase(FetchSearchUsers.rejected, (state) => {
                state.loading = false;
            });
    },
});
export const { clearResults,setQuery } = SearchSlice.actions;
export default SearchSlice.reducer;