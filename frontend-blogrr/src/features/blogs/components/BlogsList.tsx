import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlogs } from 'features/blogs/store/blogSlice';
import BlogCard from 'features/blogs/components/BlogCard';
import CreateBlogButton from './CreateBlogButton';
import { RootState, AppDispatch } from 'store/store';
import '../styles/BlogsList.css';

interface BlogsListProps {
  view: 'explore' | 'my';
  onCreateClick?: () => void;
  animationPhase?: string; // Add prop to sync with parent animation
}

const BlogsList = ({ view, onCreateClick, animationPhase = 'visible' }: BlogsListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { blogs, loading, filters, sortBy } = useSelector((state: RootState) => state.blogs);
  const { user } = useSelector((state: RootState) => state.auth);
  const [quote, setQuote] = useState<string>("");
  const [showQuote, setShowQuote] = useState<boolean>(true); // New state to control quote visibility
  const previousView = useRef(view);
  const isMounted = useRef(false);
  
  // Generate quote once for the view and memoize it
  const getQuote = useCallback(() => {
    if (previousView.current !== view || !quote) {
      const exploreQuotes = [
        "Discover stories that inspire, challenge, and connect.",
        "Explore new perspectives, one story at a time.",
        "Find your next favorite read in our community.",
        "Join the conversation, discover new voices.",
        "Where great minds share their stories."
      ];
      
      const createQuotes = [
        "Your story matters. Share it with the world.",
        "Turn your thoughts into words, your words into impact.",
        "Create, inspire, and leave your mark.",
        "Every great writer started with a single post.",
        "Your unique voice deserves to be heard."
      ];
      
      const quotes = view === 'explore' ? exploreQuotes : createQuotes;
      return quotes[Math.floor(Math.random() * quotes.length)];
    }
    return quote;
  }, [view, quote]);
  
  // Set quote when view changes, but don't regenerate during transition phases
  useEffect(() => {
    if ((!isMounted.current || previousView.current !== view) && animationPhase === 'visible') {
      const newQuote = getQuote();
      setQuote(newQuote);
      setShowQuote(true); // Make sure quote is visible when view changes
      previousView.current = view;
      isMounted.current = true;
    }
  }, [view, getQuote, animationPhase]);
  
  // Hide quote after a delay
  useEffect(() => {
    if (showQuote && isMounted.current) {
      const timer = setTimeout(() => {
        setShowQuote(false);
      }, 1300); // Hide after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showQuote, view]);
  
  // Load blogs when view changes - fixed to load properly during tab switches
  useEffect(() => {
    // Only load blogs on mount or view change
    if (!isMounted.current || previousView.current !== view) {
      console.log(`Loading blogs for ${view} view`);
      dispatch(loadBlogs({ view, filters, sortBy }));
    }
  }, [dispatch, view, filters, sortBy]);

  // Use animationPhase from parent to sync animations
  const fadeClass = animationPhase !== 'visible' ? 'fade-transition' : '';

  // Debug the blog count to identify empty state issues
  const blogCount = blogs ? blogs.length : 0;
  console.log(`Rendering ${view} blogs, count: ${blogCount}, loading: ${loading}`);

  return (
    <div className={`blogs-container ${fadeClass}`}>
      <h2>{view === 'explore' ? 'Explore' : 'My Blogs'}</h2>
      <p className={`blogs-subtitle ${!showQuote ? 'fade-out' : ''}`}>{quote}</p>
      
      <div className="blogs-grid">
        {loading ? (
          <div className="loading-blogs">
            <div className="loading-spinner"></div>
            <p>Loading blogs...</p>
          </div>
        ) : blogs && blogs.length > 0 ? (
          blogs.map((blog) => (
            <BlogCard 
              key={blog.id} 
              blog={blog} 
              isAuthor={view === 'my'} 
            />
          ))
        ) : (
          <div className="no-blogs-message">
            <div className="no-blogs-icon">
              {view === 'explore' 
                ? <i className="fas fa-compass"></i>
                : <i className="fas fa-pencil-alt"></i>
              }
            </div>
            {view === 'explore'
              ? <p>No blogs to explore yet. Be the first to create content and inspire others!</p>
              : <p>You haven't created any blogs yet. Click the <i className="fas fa-plus"></i> button below to share your first story!</p>
            }
            {view === 'my' && 
              <button className="start-writing-btn" onClick={onCreateClick}>
                <i className="fas fa-edit"></i> Start Writing
              </button>
            }
          </div>
        )}
      </div>
      
      {view === 'my' && <CreateBlogButton onClick={onCreateClick} />}
    </div>
  );
};

export default BlogsList;
