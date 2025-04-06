import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createGroup, addMembersToGroup, searchUsers } from '../../store/chatSlice';
import { AppDispatch, RootState } from 'store/store';

interface NewGroupModalProps {
  onClose: () => void;
}

const NewGroupModal = ({ onClose }: NewGroupModalProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { searchResults, contacts } = useSelector((state: RootState) => state.chat);
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [step, setStep] = useState<'details' | 'members'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Search for users when query changes
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timer = setTimeout(() => {
        dispatch(searchUsers(searchQuery));
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [searchQuery, dispatch]);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    
    setError('');
    setStep('members');
  };

  const handleAddUser = (userId: number) => {
    if (!selectedUsers.includes(userId)) {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter(id => id !== userId));
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one member');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      // Create the group first
      const groupResult = await dispatch(createGroup({
        name: groupName,
        description: groupDescription
      })).unwrap();
      
      // Then add members to the group
      if (groupResult.id) {
        await dispatch(addMembersToGroup({
          groupId: groupResult.id,
          userIds: selectedUsers
        }));
      }
      
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to create group');
      setIsSubmitting(false);
    }
  };

  const matchedUsers = searchResults.users.filter(user => 
    !selectedUsers.includes(user.id)
  );

  const selectedUserDetails = selectedUsers.map(userId => 
    contacts.find(c => c.id === userId) || searchResults.users.find(u => u.id === userId)
  ).filter(Boolean);

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{step === 'details' ? 'Create New Group' : 'Add Group Members'}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        {/* ...existing code... */}
      </div>
    </div>
  );
};

export default NewGroupModal;