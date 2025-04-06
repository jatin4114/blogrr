import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from 'store/store';
import { ChatType, MemberRole } from '../types/chatTypes';
// Import components with correct relative paths
// The components need to be imported directly from the parent directory without subdirectories
import NewGroupModal from './NewGroupModal';
import ContactItem from './ContactItem';
import GroupItem from './GroupItem';

interface ChatSidebarProps {
  onNewChat?: () => void;
}

enum TabType {
  CONTACTS = 'contacts',
  GROUPS = 'groups'
}

const ChatSidebar = ({ onNewChat }: ChatSidebarProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(TabType.CONTACTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  
  const { contacts, groups, activeChat, isContactsLoading = false, isGroupsLoading = false } = useSelector((state: RootState) => state.chat);
  
  // Use loading state from individual properties
  const isLoading = activeTab === TabType.CONTACTS ? isContactsLoading : isGroupsLoading;
  
  // Filter contacts and groups based on search query
  const filteredContacts = Array.isArray(contacts)
    ? contacts.filter(contact => 
        contact.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];
  
  const filteredGroups = Array.isArray(groups)
    ? groups.filter(group => 
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []; // Fallback to an empty array if groups is not an array
  
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleNewChat = () => {
    if (activeTab === TabType.GROUPS) {
      setShowNewGroupModal(true);
    } else if (onNewChat) {
      // For contacts tab, use the new search modal
      onNewChat();
    }
  };
  
  const handleCloseModal = () => {
    setShowNewGroupModal(false);
  };

  const totalUnreadContacts = Array.isArray(contacts) 
    ? contacts.reduce((count, contact) => count + (contact.unreadCount || 0), 0)
    : 0;

  const totalUnreadGroups = Array.isArray(groups)
    ? groups.reduce((count, group) => count + (group.unreadCount || 0), 0)
    : 0;

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Chats</h2>
        <button 
          className="new-chat-button" 
          onClick={handleNewChat}
          title={activeTab === TabType.CONTACTS ? "New Chat" : "New Group"}
        >
          <i className="fas fa-plus"></i>
        </button>
      </div>
      
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={handleSearch}
        />
        <i className="fas fa-search search-icon"></i>
      </div>
      
      <div className="chat-tabs">
        <button 
          className={`tab-button ${activeTab === TabType.CONTACTS ? 'active' : ''}`}
          onClick={() => handleTabChange(TabType.CONTACTS)}
        >
          <i className="fas fa-user"></i>
          Contacts
          {totalUnreadContacts > 0 && (
            <span className="tab-badge">
              {totalUnreadContacts}
            </span>
          )}
        </button>
        <button 
          className={`tab-button ${activeTab === TabType.GROUPS ? 'active' : ''}`}
          onClick={() => handleTabChange(TabType.GROUPS)}
        >
          <i className="fas fa-users"></i>
          Groups
          {totalUnreadGroups > 0 && (
            <span className="tab-badge">
              {totalUnreadGroups}
            </span>
          )}
        </button>
      </div>
      
      <div className="chat-list">
        {isLoading ? (
          <div className="loading-indicator">
            <div className="loader"></div>
            <p>Loading chats...</p>
          </div>
        ) : activeTab === TabType.CONTACTS ? (
          filteredContacts.length > 0 ? (
            filteredContacts.map(contact => (
              <ContactItem 
                key={contact.id}
                contact={{
                  ...contact,
                  lastMessage: contact.lastMessage 
                    ? { 
                        content: contact.lastMessage.content, 
                        timestamp: contact.lastMessage.timestamp, 
                        senderName: contact.lastMessage.senderName 
                      } 
                    : null
                }}
                isActive={
                  activeChat?.type === ChatType.SINGLE && 
                  activeChat.contactId === contact.id
                }
              />
            ))
          ) : searchQuery ? (
            <div className="empty-list-message">
              <p>No contacts found</p>
              <p className="subtext">Try a different search term</p>
            </div>
          ) : (
            <div className="empty-list-message">
              <p>No contacts yet</p>
              <p className="subtext">Connect with other users to start chatting</p>
            </div>
          )
        ) : (
          // Groups Tab
          filteredGroups.length > 0 ? (
            filteredGroups.map(group => (
              <GroupItem 
                key={group.id}
                group={{
                  ...group,
                  members: group.members.map(member => ({
                    ...member,
                    userId: member.id, // Map `id` to `userId`
                    role: member.role as MemberRole // Cast `role` to `MemberRole`
                  })),
                  lastMessage: group.lastMessage 
                    ? { 
                        content: group.lastMessage.content, 
                        timestamp: group.lastMessage.timestamp, 
                        senderName: group.lastMessage.senderName 
                      } 
                    : null
                }}
                isActive={
                  activeChat?.type === ChatType.GROUP && 
                  activeChat.groupId === group.id
                }
              />
            ))
          ) : searchQuery ? (
            <div className="empty-list-message">
              <p>No groups found</p>
              <p className="subtext">Try a different search term</p>
            </div>
          ) : (
            <div className="empty-list-message">
              <p>No groups yet</p>
              <p className="subtext">Create a new group to start chatting</p>
              <button className="create-group-button" onClick={() => setShowNewGroupModal(true)}>
                <i className="fas fa-users"></i>
                Create Group
              </button>
            </div>
          )
        )}
      </div>
      
      {showNewGroupModal && (
        <NewGroupModal onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default ChatSidebar;