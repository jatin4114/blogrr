import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from 'store/store';
import { searchUsers, setActiveChat } from '../store/chatSlice';
import { ChatType } from '../types/chatTypes';
import { UserBasic } from '../types/userTypes';
import '../styles/SearchUser.css';

interface SearchUserProps {
  onClose: () => void;
  onSelectUser?: (userId: number) => void;
}

const SearchUser = ({ onClose, onSelectUser }: SearchUserProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialState, setIsInitialState] = useState(true);
  
  const dispatch = useDispatch<AppDispatch>();
  const { searchResults, isSearching, searchError } = useSelector((state: RootState) => state.chat);
  
  // Safely access users with a fallback to an empty array
  const users = searchResults?.users || [];
  const totalItems = searchResults?.total || 0;
  const pageSize = searchResults?.size || 10;
  
  // Debounce search term to avoid too many API calls
  useEffect(() => {
    if (searchTerm) {
      const timer = setTimeout(() => {
        setDebouncedTerm(searchTerm);
        setIsInitialState(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);
  
  // Fetch results when debounced term changes
  const performSearch = useCallback(() => {
    if (debouncedTerm) {
      console.log(`Searching for users with term: "${debouncedTerm}", page: ${currentPage}`);
      
      dispatch(searchUsers({ searchTerm: debouncedTerm, page: currentPage }))
        .unwrap()
        .then(response => {
          console.log("Search successful:", response);
        })
        .catch(error => {
          console.error("Search failed:", error);
        });
    }
  }, [debouncedTerm, currentPage, dispatch]);
  
  useEffect(() => {
    if (debouncedTerm) {
      performSearch();
    }
  }, [debouncedTerm, currentPage, performSearch]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    
    if (!newTerm) {
      setIsInitialState(true);
    } else {
      setCurrentPage(1); // Reset to first page on new search
    }
  };
  
  const handleSelectUser = (userId: number) => {
    if (onSelectUser) {
      onSelectUser(userId);
    } else {
      // Start a chat with this user
      dispatch(setActiveChat({ type: ChatType.SINGLE, id: userId }));
    }
    onClose();
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= Math.ceil(totalItems / pageSize)) {
      setCurrentPage(newPage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter is pressed, immediately trigger search
    if (e.key === 'Enter' && searchTerm) {
      setDebouncedTerm(searchTerm);
      setIsInitialState(false);
    }
    
    // If Escape is pressed, close the search modal
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="search-user-modal" onClick={(e) => {
      // Close when clicking on the backdrop (not the content)
      if ((e.target as HTMLElement).className === 'search-user-modal') {
        onClose();
      }
    }}>
      <div className="search-user-content">
        <div className="search-user-header">
          <h2>Search Users</h2>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="search-input-container">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="search-input"
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="search-results-container">
          {isSearching ? (
            <div className="search-loading">
              <div className="search-spinner"></div>
              <p>Searching users...</p>
            </div>
          ) : searchError ? (
            <div className="search-error">
              <i className="fas fa-exclamation-circle"></i>
              <p>Error: {typeof searchError === 'string' ? searchError : 'Failed to search users'}</p>
              <button
                className="retry-button"
                onClick={() => performSearch()}
              >
                Retry
              </button>
            </div>
          ) : isInitialState ? (
            <div className="search-prompt">
              <i className="fas fa-search"></i>
              <p>Start typing to search for users</p>
              <p className="hint">Search by username or email</p>
            </div>
          ) : users.length > 0 ? (
            <>
              <ul className="search-results-list">
                {users.map((user: UserBasic) => (
                  <li 
                    key={user.id}
                    className="search-result-item"
                    onClick={() => handleSelectUser(user.id)}
                  >
                    <div className="user-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-info">
                      <h3 className="user-name">{user.username}</h3>
                      <p className="user-email">{user.email}</p>
                    </div>
                    <button 
                      className="start-chat-button"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the parent click
                        handleSelectUser(user.id);
                      }}
                    >
                      <i className="fas fa-comments"></i>
                    </button>
                  </li>
                ))}
              </ul>
              
              {totalItems > pageSize && (
                <div className="pagination">
                  <button
                    className="pagination-button"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {Math.ceil(totalItems / pageSize)}
                  </span>
                  <button 
                    className="pagination-button"
                    disabled={currentPage === Math.ceil(totalItems / pageSize)}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="no-results">
              <i className="fas fa-search"></i>
              <p>No users found matching "{debouncedTerm}"</p>
              <p className="hint">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchUser;
