import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from 'store/store';
import { fetchChatHistory, markMessagesAsRead } from '../store/chatSlice';
import { ChatType } from '../types/chatTypes';
import { chatSocketService } from '../services/chatSocketService';
import { groupChatSocketService } from '../services/groupChatSocketService';
import '../styles/ActiveChatPanel.css';

const ActiveChatPanel = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { activeChat, contacts, groups } = useSelector((state: RootState) => state.chat);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = parseInt(localStorage.getItem('userId') || '0');
  
  // Keep track of previous scroll position to determine auto-scroll behavior
  const scrollPositionRef = useRef({
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0
  });

  // Track if user was near bottom before new messages
  const wasNearBottomRef = useRef(true);

  // Mark messages as read when opening a chat
  useEffect(() => {
    if (activeChat) {
      const chatId = activeChat.type === ChatType.SINGLE 
        ? activeChat.contactId 
        : activeChat.groupId;
      
      if (chatId) {
        // Set focus to input field when changing chats
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
        
        // Reset state when changing chats
        setMessage('');
        setSendError(null);
        setIsSending(false);
        
        // Fetch messages
        dispatch(fetchChatHistory({ type: activeChat.type, id: chatId }));
        
        // Mark messages as read
        dispatch(markMessagesAsRead({ type: activeChat.type, id: chatId }))
          .unwrap()
          .then(result => {
            console.log(`Marked ${result.count || 0} messages as read`);
          })
          .catch(error => {
            console.error('Error marking messages as read:', error);
          });
      }
    }
  }, [activeChat?.type, activeChat?.contactId, activeChat?.groupId, dispatch]);

  // Track scroll position in messages container
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = messagesContainer;
      // User is "near bottom" if scrolled to within 100px of bottom
      wasNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
      
      // Update the scroll position reference
      scrollPositionRef.current = {
        scrollHeight,
        scrollTop,
        clientHeight
      };
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom only if user was already near bottom or is sender of new message
  useEffect(() => {
    if (!activeChat?.messages?.length) return;
    
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    // Check if new message height causes container to need scroll
    const neededScroll = messagesContainer.scrollHeight > messagesContainer.clientHeight;
    
    // Only auto-scroll if:
    // 1. User was already near bottom before new messages
    // 2. The last message was sent by current user
    const lastMessage = activeChat.messages[activeChat.messages.length - 1];
    const isLastMessageFromCurrentUser = lastMessage?.senderId === userId;
    
    if (neededScroll && (wasNearBottomRef.current || isLastMessageFromCurrentUser)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeChat || isSending) return;

    setSendError(null);
    setIsSending(true);
    let sent = false;
    
    try {
      if (activeChat.type === ChatType.SINGLE && activeChat.contactId) {
        // Use the direct chat socket service for single chats
        sent = chatSocketService.sendMessage(activeChat.contactId, message.trim());
      } else if (activeChat.type === ChatType.GROUP && activeChat.groupId) {
        // Use the group chat socket service for group chats
        sent = groupChatSocketService.sendGroupMessage(activeChat.groupId, message.trim());
      }
      
      if (sent) {
        setMessage('');
        // Ensure we scroll to bottom when sending new message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setSendError('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError('An error occurred while sending the message.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter key sends message, unless Shift is pressed (allows multiline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
    
    // Escape clears the input field
    if (e.key === 'Escape') {
      setMessage('');
    }
  };

  // Get the name of the current chat
  const getChatName = () => {
    if (!activeChat) return '';
    
    if (activeChat.type === ChatType.SINGLE && activeChat.contactId) {
      const contact = contacts.find(c => c.id === activeChat.contactId);
      return contact ? contact.username : '';
    } else if (activeChat.type === ChatType.GROUP && activeChat.groupId) {
      const group = groups.find(g => g.id === activeChat.groupId);
      return group ? group.name : '';
    }
    
    return '';
  };

  // Get status or member count
  const getChatSubtitle = () => {
    if (!activeChat) return '';
    
    if (activeChat.type === ChatType.SINGLE && activeChat.contactId) {
      const contact = contacts.find(c => c.id === activeChat.contactId);
      return contact?.isOnline ? 'Online' : 'Offline';
    } else if (activeChat.type === ChatType.GROUP && activeChat.groupId) {
      const group = groups.find(g => g.id === activeChat.groupId);
      return group ? `${group.members.length} members` : '';
    }
    
    return '';
  };

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Format timestamp consistently for both sender and receiver
  const formatMessageTime = (timestamp: string) => {
    try {
      // Parse the timestamp string to a Date object in UTC
      const date = new Date(timestamp);
      
      // Format in 12-hour time with AM/PM
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true // Ensure 12-hour format with AM/PM
      });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return 'Unknown time';
    }
  };

  // Group messages by date for better display
  const groupMessagesByDate = useCallback(() => {
    if (!activeChat?.messages) return [];
    
    // First, ensure messages are sorted by timestamp
    const sortedMessages = [...activeChat.messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = '';
    let currentGroup: any[] = [];
    
    sortedMessages.forEach(msg => {
      const msgDate = new Date(msg.timestamp).toLocaleDateString();
      
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });
    
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }
    
    return groups;
  }, [activeChat?.messages]);

  // Determine if we should show sender's name for consecutive messages
  const shouldShowSender = useCallback((messages: any[], index: number) => {
    if (index === 0) return true;
    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];
    return currentMessage.senderId !== previousMessage.senderId;
  }, []);

  if (!activeChat) {
    return (
      <div className="chat-panel empty-chat">
        <div className="empty-chat-content">
          <div className="empty-chat-icon">
            <i className="fas fa-comments"></i>
          </div>
          <h2>Select a conversation</h2>
          <p>Choose a contact or group to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-avatar">
          <span className="avatar-text">{getInitial(getChatName())}</span>
          {activeChat.type === ChatType.SINGLE && contacts.find(c => c.id === activeChat.contactId)?.isOnline && (
            <span className="status-dot online"></span>
          )}
        </div>
        <div className="chat-header-info">
          <h2 className="chat-header-name">{getChatName() || 'Loading...'}</h2>
          <span className="chat-header-status">{getChatSubtitle()}</span>
        </div>
      </div>
      
      <div className="chat-messages" ref={messagesContainerRef}>
        {activeChat.isLoading ? (
          <div className="loading-messages">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : activeChat.messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <p className="hint">Start the conversation by sending a message</p>
          </div>
        ) : (
          <div className="messages-container">
            {groupMessagesByDate().map((group, groupIndex) => (
              <React.Fragment key={groupIndex}>
                <div className="date-separator">
                  <span>{new Date(group.date).toLocaleDateString([], { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric',
                    year: new Date(group.date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                  })}</span>
                </div>
                
                {group.messages.map((msg, msgIndex) => {
                  // Determine if we should group this message with the previous one
                  const isSameSender = msgIndex > 0 && group.messages[msgIndex - 1].senderId === msg.senderId;
                  // Determine if this message is within 2 minutes of the previous one
                  const isCloseTime = msgIndex > 0 && 
                    (new Date(msg.timestamp).getTime() - new Date(group.messages[msgIndex - 1].timestamp).getTime() < 120000);
                  // Only group messages from same sender that are sent within 2 minutes of each other
                  const shouldGroup = isSameSender && isCloseTime;
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`message ${msg.senderId === userId ? 'outgoing' : 'incoming'} ${shouldGroup ? 'grouped' : ''}`}
                    >
                      <div className="message-content">
                        {activeChat.type === ChatType.GROUP && 
                         msg.senderId !== userId && 
                         shouldShowSender(group.messages, msgIndex) && (
                          <div className="message-sender">
                            {contacts.find(c => c.id === msg.senderId)?.username || `User ${msg.senderId}`}
                          </div>
                        )}
                        <div className="message-bubble">
                          {msg.message}
                        </div>
                        <div className="message-meta">
                          <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
                          {msg.senderId === userId && (
                            <span className="message-status">
                              {msg.read ? (
                                <i className="fas fa-check-double" title="Read"></i>
                              ) : msg.delivered ? (
                                <i className="fas fa-check" title="Delivered"></i>
                              ) : (
                                <i className="fas fa-clock" title="Sending"></i>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {sendError && (
        <div className="send-error">
          <i className="fas fa-exclamation-circle"></i>
          <span>{sendError}</span>
          <button onClick={() => setSendError(null)}>Dismiss</button>
        </div>
      )}
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={activeChat.isLoading || isSending}
        />
        <button 
          type="submit" 
          className={`send-button ${isSending ? 'sending' : ''}`}
          disabled={!message.trim() || activeChat.isLoading || isSending}
        >
          {isSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
        </button>
      </form>
    </div>
  );
};

export default ActiveChatPanel;