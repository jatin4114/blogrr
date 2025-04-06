import { useDispatch } from 'react-redux';
import { setActiveChat } from '../store/chatSlice';
import { Contact, ChatType } from '../types/chatTypes';
import { formatLastActive } from '../utils/timeUtils';

interface ContactItemProps {
  contact: Contact;
  isActive: boolean;
}

const ContactItem = ({ contact, isActive }: ContactItemProps) => {
  const dispatch = useDispatch();
  
  const handleContactClick = () => {
    dispatch(setActiveChat({
      type: ChatType.SINGLE,
      id: contact.id
    }));
  };
  
  const initial = contact.username.charAt(0).toUpperCase();
  
  return (
    <div 
      className={`contact-item ${isActive ? 'active' : ''}`} 
      onClick={handleContactClick}
    >
      <div className="contact-avatar">
        {initial}
        <div className={`status-indicator ${contact.isOnline ? 'online' : 'offline'}`}></div>
      </div>
      
      <div className="contact-info">
        <div className="contact-name-row">
          <h3 className="contact-name">{contact.username}</h3>
          {contact.lastMessage && (
            <span className="last-message-time">
              {formatLastActive(contact.lastMessage.timestamp)}
            </span>
          )}
        </div>
        
        <div className="last-message-row">
          {contact.lastMessage ? (
            <p className="last-message">
              {contact.lastMessage.content}
            </p>
          ) : (
            <p className="no-messages">No messages yet</p>
          )}
          
          {contact.unreadCount > 0 && (
            <div className="unread-badge">
              {contact.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactItem;