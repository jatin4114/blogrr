export interface User {
  id: number;
  username: string;
}

export interface Comment {
  id: number;
  text: string;
  user: User;
  created_at: string;
}

export interface Blog {
  id: number;
  title: string;
  body: string;
  category: string;
  creator_id: number;
  creator: User;
  created_at: string;
  comments?: Comment[];
}

export interface FilterOptions {
  categoryFilter?: string;
  dateFilter?: string;
}

export interface BlogsState {
  blogs: Blog[];
  loading: boolean;
  error: string | null;
  view: 'explore' | 'my';
  filters: FilterOptions;
  sortBy: 'newest' | 'oldest' | 'comments';
  showModal: boolean;
  modalBlog: Blog | null;
  showEditModal: boolean;
  editBlog: Blog | null;
}
