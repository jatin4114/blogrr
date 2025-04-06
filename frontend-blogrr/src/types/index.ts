import { Blog, Comment, User, FilterOptions, BlogsState } from '../features/blogs/types';

// Re-export types for use as absolute imports
export type { Blog, Comment, User, FilterOptions, BlogsState };

// Global type declarations
declare global {
  interface Window {
    scrollTimer: NodeJS.Timeout;
  }
}
