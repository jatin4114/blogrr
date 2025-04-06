import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlogs, setFilters, setSortBy } from 'features/blogs/store/blogSlice';
import { AppDispatch, RootState } from 'store/store';
import '../styles/FilterPanel.css';

interface FilterPanelProps {
  show: boolean;
  onClose: () => void;
}

const FilterPanel = ({ show, onClose }: FilterPanelProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { filters, sortBy } = useSelector((state: RootState) => state.blogs);
  
  const [categoryFilter, setCategoryFilter] = useState(filters.categoryFilter || 'all');
  const [dateFilter, setDateFilter] = useState(filters.dateFilter || 'all');
  const [sortByValue, setSortByValue] = useState(sortBy || 'newest');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserInteracted = useRef(false);
  const initialRender = useRef(true);
  
  // Function to debounce filter application
  const debouncedApplyFilters = useCallback(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Show applying indicator
    setIsApplying(true);
    
    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      dispatch(setFilters({ categoryFilter, dateFilter }));
      dispatch(setSortBy(sortByValue as any));
      dispatch(loadBlogs({
        view: 'explore',
        filters: { categoryFilter, dateFilter },
        sortBy: sortByValue
      }));
      
      // Hide applying indicator after a short delay
      setTimeout(() => setIsApplying(false), 300);
    }, 600); // 600ms delay
  }, [categoryFilter, dateFilter, sortByValue, dispatch]);
  
  // Track clicks outside panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        show && 
        panelRef.current && 
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('.filter-toggle')
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show, onClose]);

  // Initialize filter values when panel opens
  useEffect(() => {
    if (show) {
      setCategoryFilter(filters.categoryFilter || 'all');
      setDateFilter(filters.dateFilter || 'all');
      setSortByValue(sortBy || 'newest');
      
      // Reset user interaction flag when panel opens
      hasUserInteracted.current = false;
      initialRender.current = true;
    }
  }, [show, filters.categoryFilter, filters.dateFilter, sortBy]);
  
  // Count active filters
  useEffect(() => {
    let count = 0;
    if (categoryFilter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    setActiveFiltersCount(count);
  }, [categoryFilter, dateFilter]);
  
  // Apply filters when values change (debounced), but only after user interaction
  useEffect(() => {
    // Skip on first render or when panel opens
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    
    // If user has changed a value, mark as interacted
    if (
      categoryFilter !== (filters.categoryFilter || 'all') ||
      dateFilter !== (filters.dateFilter || 'all') ||
      sortByValue !== (sortBy || 'newest')
    ) {
      hasUserInteracted.current = true;
    }
    
    // Only apply filters if user has interacted with them
    if (show && hasUserInteracted.current) {
      debouncedApplyFilters();
    }
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [categoryFilter, dateFilter, sortByValue, show, debouncedApplyFilters, filters, sortBy]);

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  // Handler for category change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    hasUserInteracted.current = true;
  };
  
  // Handler for date change
  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFilter(e.target.value);
    hasUserInteracted.current = true;
  };
  
  // Handler for sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortByValue(e.target.value);
    hasUserInteracted.current = true;
  };
  
  return (
    <div 
      ref={panelRef}
      className={`sort-filter-panel ${show ? 'show' : ''}`} 
      onClick={handlePanelClick}
    >
      {activeFiltersCount > 0 && (
        <div className="active-filters show">{activeFiltersCount}</div>
      )}
      
      <div className="filter-section">
        <h3><i className="fas fa-filter"></i> Filter</h3>
        <div className="filter-group">
          <label>By Category</label>
          <select 
            value={categoryFilter}
            onChange={handleCategoryChange}
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="technology">Technology</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="travel">Travel</option>
            <option value="food">Food</option>
          </select>
        </div>
        <div className="filter-group">
          <label>By Date</label>
          <select
            value={dateFilter}
            onChange={handleDateChange}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>
      <div className="sort-section">
        <h3><i className="fas fa-sort"></i> Sort</h3>
        <div className="sort-group">
          <label>Sort By</label>
          <select
            value={sortByValue}
            onChange={handleSortChange}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="comments">Most Comments</option>
          </select>
        </div>
      </div>
      
      {isApplying && (
        <div className="filters-applying">
          <div className="applying-spinner"></div>
          <span>Applying...</span>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
