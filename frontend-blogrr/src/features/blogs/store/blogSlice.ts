import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Blog, FilterOptions, BlogsState } from 'features/blogs/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Async thunks
export const loadBlogs = createAsyncThunk(
  'blogs/loadBlogs',
  async ({ 
    view, 
    filters, 
    sortBy 
  }: { 
    view: 'explore' | 'my'; 
    filters?: FilterOptions;
    sortBy?: string;
  }, { rejectWithValue }) => {
    try {
      console.log(`Loading blogs API call for ${view} view`);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const response = await fetch(`${API_BASE_URL}/blogs/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load blogs');
      }

      let blogs: Blog[] = await response.json();
      console.log(`API returned ${blogs.length} blogs before filtering`);

      // Filter blogs based on type
      blogs = view === 'explore'
        ? blogs.filter(blog => blog.creator_id !== parseInt(userId!))
        : blogs.filter(blog => blog.creator_id === parseInt(userId!));
      
      console.log(`After type filtering: ${blogs.length} blogs for ${view} view`);

      // Apply additional filters
      if (filters?.categoryFilter && filters.categoryFilter !== 'all') {
        blogs = blogs.filter(blog => 
          blog.category.toLowerCase() === filters.categoryFilter!.toLowerCase()
        );
      }

      // Date filtering
      if (filters?.dateFilter && filters.dateFilter !== 'all') {
        const now = new Date();
        const filterDate = new Date();

        switch (filters.dateFilter) {
          case 'today':
            filterDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            filterDate.setDate(filterDate.getDate() - 7);
            break;
          case 'month':
            filterDate.setMonth(filterDate.getMonth() - 1);
            break;
        }

        blogs = blogs.filter(blog => new Date(blog.created_at) >= filterDate);
      }

      // Sorting
      if (sortBy) {
        switch (sortBy) {
          case 'newest':
            blogs.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            break;
          case 'oldest':
            blogs.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            break;
          case 'comments':
            blogs.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
            break;
        }
      }

      return { blogs };
    } catch (error) {
      console.error('Error loading blogs:', error);
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createBlog = createAsyncThunk(
  'blogs/createBlog',
  async ({ 
    title, 
    body, 
    category 
  }: { 
    title: string; 
    body: string; 
    category: string 
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title, body, category })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create blog');
      }

      const blog = await response.json();
      return blog;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateBlog = createAsyncThunk(
  'blogs/updateBlog',
  async ({ 
    id, 
    title, 
    body, 
    category 
  }: { 
    id: number; 
    title: string; 
    body: string; 
    category: string 
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/${id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title, body, category })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update blog');
      }

      const updatedBlog = await response.json();
      return updatedBlog;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteBlog = createAsyncThunk(
  'blogs/deleteBlog',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete blog');
      }

      return id;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addComment = createAsyncThunk(
  'blogs/addComment',
  async ({ 
    blogId, 
    text, 
    isModal = false 
  }: { 
    blogId: number; 
    text: string; 
    isModal?: boolean 
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${blogId}/add-comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add comment');
      }

      // If in modal, we need to get the updated blog with comments
      if (isModal) {
        const blogResponse = await fetch(`${API_BASE_URL}/blogs/${blogId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!blogResponse.ok) {
          throw new Error('Failed to get updated blog');
        }
        
        const blog = await blogResponse.json();
        return { blog, isModal };
      }
      
      const comment = await response.json();
      return { comment, blogId, isModal };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Retrieve persisted view from localStorage
const persistedView = localStorage.getItem('blogView') as 'explore' | 'my' | null;

// Define initial state with persisted view if available; default to 'explore'
const initialState: BlogsState = {
  blogs: [],
  loading: false,
  error: null,
  view: persistedView ? persistedView : 'explore',
  filters: {},
  sortBy: 'newest',
  showModal: false,
  modalBlog: null,
  showEditModal: false,
  editBlog: null
};

const blogSlice = createSlice({
  name: 'blogs',
  initialState,
  reducers: {
    setView: (state, action: PayloadAction<'explore' | 'my'>) => {
      state.view = action.payload;
    },
    setFilters: (state, action: PayloadAction<FilterOptions>) => {
      state.filters = action.payload;
    },
    setSortBy: (state, action: PayloadAction<'newest' | 'oldest' | 'comments'>) => {
      state.sortBy = action.payload;
    },
    openBlogModal: (state, action: PayloadAction<Blog>) => {
      state.modalBlog = action.payload;
      state.showModal = true;
    },
    closeBlogModal: (state) => {
      state.showModal = false;
      state.modalBlog = null;
    },
    openEditModal: (state, action: PayloadAction<Blog>) => {
      state.editBlog = action.payload;
      state.showEditModal = true;
    },
    closeEditModal: (state) => {
      state.showEditModal = false;
      state.editBlog = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBlogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadBlogs.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.blogs) {
          state.blogs = action.payload.blogs;
          console.log(`Updated state with ${state.blogs.length} blogs`);
        }
        // Don't update the view here - this prevents the loop
      })
      .addCase(loadBlogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createBlog.fulfilled, (state, action) => {
        if (state.view === 'my') {
          state.blogs.unshift(action.payload);
        }
      })
      .addCase(updateBlog.fulfilled, (state, action) => {
        const index = state.blogs.findIndex(blog => blog.id === action.payload.id);
        if (index !== -1) {
          state.blogs[index] = action.payload;
        }
        if (state.modalBlog?.id === action.payload.id) {
          state.modalBlog = action.payload;
        }
      })
      .addCase(deleteBlog.fulfilled, (state, action) => {
        state.blogs = state.blogs.filter(blog => blog.id !== action.payload);
        if (state.modalBlog?.id === action.payload) {
          state.showModal = false;
          state.modalBlog = null;
        }
      })
      .addCase(addComment.fulfilled, (state, action) => {
        const { isModal, blog, comment, blogId } = action.payload;
        
        if (isModal && blog) {
          state.modalBlog = blog;
          return;
        }
        
        // Update comments in blogs array
        if (!isModal && comment && blogId) {
          const blogIndex = state.blogs.findIndex(b => b.id === blogId);
          if (blogIndex !== -1) {
            if (!state.blogs[blogIndex].comments) {
              state.blogs[blogIndex].comments = [];
            }
            state.blogs[blogIndex].comments!.push(comment);
          }
        }
      });
  }
});

export const { 
  setView, 
  setFilters, 
  setSortBy, 
  openBlogModal, 
  closeBlogModal,
  openEditModal,
  closeEditModal
} = blogSlice.actions;

export default blogSlice.reducer;
