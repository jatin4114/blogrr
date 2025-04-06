import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { markMessagesAsRead, fetchChatHistory } from '../store/chatSlice';
import { ChatType, Message } from '../types/chatTypes';
import { AppDispatch, RootState } from 'store/store';
import { chatSocketService } from '../services/chatSocketService';
import { groupChatSocketService } from '../services/groupChatSocketService';

const ChatPanel = () => {
  const dispatch = useDispatch<AppDispatch>();
  const messagesRef = useRef<HTMLDivElement>(null);
  const [messageText, setMessageText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { activeChat, contacts, groups } = useSelector((state: RootState) => state.chat);
  const userId = parseInt(localStorage.getItem('userId') || '0');

  const activeContact = activeChat?.type === ChatType.SINGLE
    ? contacts.find(c => c.id === activeChat.contactId)
    : null;

  const activeGroup = activeChat?.type === ChatType.GROUP
    ? groups.find(g => g.id === activeChat.groupId)
    : null;

  const chatName = activeContact?.username || activeGroup?.name || '';
  const chatInitial = chatName.charAt(0).toUpperCase();

  useEffect(() => {
    if (activeChat) {
      const chatId = activeChat.type === ChatType.SINGLE 
        ? activeChat.contactId 
        : activeChat.groupId;

      if (chatId) {
        dispatch(fetchChatHistory({ type: activeChat.type, id: chatId }));
      }
    }
  }, [activeChat, dispatch]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }

    if (activeChat && activeChat.messages.length > 0) {
      const unreadMessages = activeChat.messages.filter(
        (msg: Message) => !msg.read && msg.senderId !== userId
      );

      if (unreadMessages.length > 0) {
        dispatch(markMessagesAsRead({
          type: activeChat.type,
          id: activeChat.type === ChatType.SINGLE ? activeChat.contactId! : activeChat.groupId!
        }));
      }
    }
  }, [activeChat?.messages, activeChat, dispatch, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChat || !userId) return;

    try {
      setIsSubmitting(true);
      let sent = false;

      if (activeChat.type === ChatType.SINGLE && activeChat.contactId) {
        sent = chatSocketService.sendMessage(activeChat.contactId, messageText);
      } else if (activeChat.type === ChatType.GROUP && activeChat.groupId) {
        sent = groupChatSocketService.sendGroupMessage(activeChat.groupId, messageText);
      }

      if (sent) setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowDate = (message: Message, index: number) => {
    if (index === 0) return true;

    const currentDate = new Date(message.timestamp).toLocaleDateString();
    const prevMessage = activeChat?.messages[index - 1];
    const prevDate = prevMessage?.timestamp 
      ? new Date(prevMessage.timestamp).toLocaleDateString() 
      : '';

    return currentDate !== prevDate;
  };

  const formatDateSeparator = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div className="chat-content">
      {activeChat ? (
        <>
          <div className="chat-header">
            <div className="chat-header-avatar">{chatInitial}</div>
            <div className="chat-header-info">
              <h2 className="chat-header-name">{chatName}</h2>
              {activeContact && (
                <div className="chat-header-status">
                  <span className={`status-dot ${activeContact.isOnline ? 'online' : 'offline'}`}></span>
                  <span>{activeContact.isOnline ? 'Online' : 'Offline'}</span>
                </div>
              )}
              {activeGroup && (
                <div className="chat-header-status">
                  <span>{activeGroup.members?.length || 0} members</span>
                </div>
              )}
            </div>
          </div>

          <div className="chat-messages" ref={messagesRef}>
            {activeChat.isLoading ? (
              <div className="loading-indicator">
                <div className="loader"></div>
                <p>Loading messages...</p>
              </div>
            ) : activeChat.messages.length > 0 ? (
              activeChat.messages.map((message, index) => (
                <div key={message.id}>
                  {shouldShowDate(message, index) && (
                    <div className="date-separator">
                      <span>{formatDateSeparator(message.timestamp)}</span>
                    </div>
                  )}
                  <div className={`message-item ${message.senderId === userId ? 'sent' : 'received'}`}>
                    <div className="message-bubble">{message.message}</div>
                    <div className="message-meta">
                      <span className="message-time">{formatMessageTime(message.timestamp)}</span>
                      {message.senderId === userId && (
                        <span className="message-status">
                          {message.delivered ? (
                            <i className="fas fa-check" title="Delivered"></i>
                          ) : (
                            <i className="fas fa-clock" title="Sending"></i>
                          )}
                          {message.read && (
                            <i className="fas fa-check-double" title="Read"></i>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-messages">
                <p>No messages yet</p>
                <p className="subtext">Send a message to start a conversation</p>
              </div>
            )}
          </div>

          <div className="chat-input">
            <form className="chat-input-form" onSubmit={handleSubmit}>
              <textarea
                className="chat-input-textbox"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button 
                type="submit" 
                className="chat-input-button"
                disabled={!messageText.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-paper-plane"></i>
                )}
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="empty-chat">
          <div className="empty-chat-icon">
            <i className="far fa-comment-dots"></i>
          </div>
          <h2>Select a conversation</h2>
          <p>Choose a contact or group from the sidebar to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;