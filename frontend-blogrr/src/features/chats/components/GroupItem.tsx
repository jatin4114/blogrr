import { useDispatch } from 'react-redux';
import { setActiveChat } from '../store/chatSlice';
import { ChatType } from '../types/chatTypes';
import { Group } from '../types/groupTypes';
import { formatLastActive } from '../utils/timeUtils';

interface GroupItemProps {
  group: Group;
  isActive: boolean;
}

const GroupItem = ({ group, isActive }: GroupItemProps) => {
  const dispatch = useDispatch();
  
  const handleGroupClick = () => {
    dispatch(setActiveChat({
      type: ChatType.GROUP,
      id: group.id
    }));
  };
  
  const initial = group.name.charAt(0).toUpperCase();
  
  return (
    <div 
      className={`group-item ${isActive ? 'active' : ''}`} 
      onClick={handleGroupClick}
    >
      <div className="group-avatar">
        {initial}
      </div>
      
      <div className="group-info">
        <div className="group-name-row">
          <h3 className="group-name">{group.name}</h3>
          {group.lastMessage && (
            <span className="last-message-time">
              {formatLastActive(group.lastMessage.timestamp)}
            </span>
          )}
        </div>
        
        <div className="last-message-row">
          {group.lastMessage ? (
            <p className="last-message">
              {group.lastMessage.senderName}: {group.lastMessage.content}
            </p>
          ) : (
            <p className="no-messages">No messages yet</p>
          )}
          
          {group.unreadCount > 0 && (
            <div className="unread-badge">
              {group.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupItem;