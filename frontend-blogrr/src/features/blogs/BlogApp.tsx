import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Topbar from 'shared/ui/topbar/Topbar';
import BlogsList from 'features/blogs/components/BlogsList';
import BlogModal from 'features/blogs/components/BlogModal';
import CreateBlogForm from 'features/blogs/components/CreateBlogForm';
import EditBlogForm from 'features/blogs/components/EditBlogForm';
import FilterPanel from 'features/blogs/components/FilterPanel';
import WelcomeBanner from 'features/blogs/components/WelcomeBanner';
import BottomBar from 'shared/ui/bottombar/BottomBar';
import { loadBlogs, setView } from 'features/blogs/store/blogSlice';
import { logout } from 'features/auth/store/authSlice';
import { RootState, AppDispatch } from 'store/store';
import { useNavigate } from 'react-router-dom';
import './styles/BlogApp.css';

const BlogApp = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { view, showModal, showEditModal } = useSelector((state: RootState) => state.blogs);
  const [showWelcome, setShowWelcome] = useState(() => {
    // Check if welcome banner has been shown already in this session
    return view === 'my' && sessionStorage.getItem('welcomeBannerShown') !== 'true';
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousView = useRef(view);
  const isChangingView = useRef(false);
  const [currentContent, setCurrentContent] = useState(view);
  const [animationPhase, setAnimationPhase] = useState('visible'); // 'fadeOut', 'switching', 'fadeIn', 'visible'
  const [filterButtonVisible, setFilterButtonVisible] = useState(view === 'explore');

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    } else if (!isChangingView.current) {
      // Only load blogs on initial mount, not during view changes
      dispatch(loadBlogs({ view }));
    }
  }, [dispatch, navigate]);

  // Add a useEffect to load persisted view on mount
  useEffect(() => {
    const persistedView = localStorage.getItem('blogView');
    if (persistedView && (persistedView === 'explore' || persistedView === 'my') && persistedView !== view) {
      dispatch(setView(persistedView as 'explore' | 'my'));
    }
  }, [dispatch]);

  // Handle view changes without causing loops
  useEffect(() => {
    if (previousView.current !== view && !isChangingView.current) {
      // Load blogs when view changes
      dispatch(loadBlogs({ view }));
      previousView.current = view;
    }
    
    // Reset the changing flag after view is updated
    if (isChangingView.current) {
      isChangingView.current = false;
    }
  }, [view, dispatch]);

  // Hide welcome banner after appropriate time and set flag in session storage
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
        // Set flag in session storage to indicate welcome banner has been shown
        sessionStorage.setItem('welcomeBannerShown', 'true');
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const handleLogout = () => {
    // Remove the welcome banner flag from session storage
    sessionStorage.removeItem('welcomeBannerShown');
    dispatch(logout());
    navigate('/');
  };

  // Improved transition handling with synchronized data loading
  const handleViewChange = (newView: 'explore' | 'my') => {
    if (view !== newView && !isChangingView.current && animationPhase === 'visible') {
      // Save the new view in localStorage
      localStorage.setItem('blogView', newView);
      // Prevent multiple changes
      isChangingView.current = true;
      
      // Phase 1: Fade out current content
      setAnimationPhase('fadeOut');
      setIsTransitioning(true);
      
      // Phase 2: Update view state and load data
      setTimeout(() => {
        // Update Redux state (this will trigger data loading in BlogsList)
        dispatch(setView(newView));
        setAnimationPhase('switching');
        
        // Phase 3: Brief pause before fade in begins
        setTimeout(() => {
          setCurrentContent(newView); // Update content to render
          setAnimationPhase('fadeIn');
          
          // Phase 4: After fade in completes, finalize
          setTimeout(() => {
            setAnimationPhase('visible');
            setIsTransitioning(false);
            isChangingView.current = false;
          }, 300);
          
        }, 50);
        
      }, 200);
      
      previousView.current = newView;
    }
  };

  // Simplify the filter button visibility logic to prevent repositioning
  useEffect(() => {
    // Force immediate visibility update when view changes
    setFilterButtonVisible(view === 'explore');
    
    // Close the filter panel when switching views
    if (view !== 'explore') {
      setShowFilterPanel(false);
    }
  }, [view]);

  const username = user?.username || localStorage.getItem('username') || '';

  return (
    <div className={`blog-app ${animationPhase !== 'visible' ? 'transitioning' : ''} ${animationPhase}`}>
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
      </div>
      
      <Topbar 
        username={username}
        onLogout={handleLogout}
        onExploreClick={() => handleViewChange('explore')}
        onProfileClick={() => handleViewChange('my')}
        currentView={view} // Fixed: Pass the actual current view from state
      />
      
      {/* Position filter button below the BLOGRR logo */}
      {view === 'explore' && (
        <div className="filter-button-container">
          <button 
            type="button"
            className={`filter-toggle ${showFilterPanel ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFilterPanel(!showFilterPanel);
            }}
          >
            <i className="fas fa-sliders-h"></i>
            <span className="filter-text">Filters</span>
          </button>
          
          <FilterPanel 
            show={showFilterPanel} 
            onClose={() => setShowFilterPanel(false)} 
          />
        </div>
      )}
      
      {view === 'my' && showWelcome && <WelcomeBanner username={username} />}
      
      <main className="main-content">
        {/* Fix structure to ensure clickability */}
        <div className="blogs-scroll-container">
          {/* BlogsList must be the first child for proper layering */}
          <BlogsList 
            view={view}
            onCreateClick={() => setShowCreateForm(true)}
            animationPhase={animationPhase}
          />
        </div>
      </main>

      {/* Modals */}
      {showModal && <BlogModal />}
      {showEditModal && <EditBlogForm />}
      {showCreateForm && (
        <CreateBlogForm onClose={() => setShowCreateForm(false)} />
      )}
      <BottomBar onToggleCreateBlog={() => setShowCreateForm(prev => !prev)} />
    </div>
  );
};

export default BlogApp;
