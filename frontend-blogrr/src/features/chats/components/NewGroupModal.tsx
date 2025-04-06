import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from 'store/store';
import { createGroup } from '../store/chatSlice';

interface NewGroupModalProps {
  onClose: () => void;
}

const NewGroupModal = ({ onClose }: NewGroupModalProps) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const dispatch = useDispatch<AppDispatch>();
  const contacts = useSelector((state: RootState) => state.chat.contacts);
  
  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => 
    contact.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedUsers.includes(contact.id)
  );
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGroupName(e.target.value);
  };
  
  const handleSelectUser = (userId: number) => {
    setSelectedUsers([...selectedUsers, userId]);
    setSearchQuery(''); // Clear search after selecting
  };
  
  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter(id => id !== userId));
  };
  
  const handleCreateGroup = () => {
    if (groupName.trim() && selectedUsers.length > 0) {
      dispatch(createGroup({
        name: groupName.trim(),
        description: '', // Add empty description as it's required by the API
        members: selectedUsers // Ensure members are included
      }))
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch((error: Error) => {
        console.error('Failed to create group:', error);
      });
    }
  };
  
  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-overlay')) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-content new-group-modal">
        <div className="modal-header">
          <h3>Create New Group</h3>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="group-name-input">
            <label htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={handleNameChange}
              placeholder="Enter group name"
              autoFocus
            />
          </div>
          
          {selectedUsers.length > 0 && (
            <div className="selected-users">
              <label>Selected Members</label>
              <div className="user-chips">
                {selectedUsers.map(userId => {
                  const contact = contacts.find(c => c.id === userId);
                  return (
                    <div key={userId} className="user-chip">
                      <span>{contact?.username}</span>
                      <button 
                        className="remove-user-button" 
                        onClick={() => handleRemoveUser(userId)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="user-search">
            <label htmlFor="user-search">Add Members</label>
            <input
              id="user-search"
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search contacts..."
            />
            
            {searchQuery && filteredContacts.length > 0 && (
              <div className="search-results">
                {filteredContacts.map(contact => (
                  <div 
                    key={contact.id} 
                    className="search-result-item"
                    onClick={() => handleSelectUser(contact.id)}
                  >
                    <div className="contact-initial">
                      {contact.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-name">{contact.username}</div>
                  </div>
                ))}
              </div>
            )}
            
            {searchQuery && filteredContacts.length === 0 && (
              <div className="no-results-message">
                No contacts found
              </div>
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="create-button" 
            disabled={!groupName.trim() || selectedUsers.length === 0}
            onClick={handleCreateGroup}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGroupModal;