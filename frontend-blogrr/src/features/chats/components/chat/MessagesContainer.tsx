import { useSelector } from 'react-redux';
import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/store';
import { RootState } from '@/store/store';
import { fetchChatHistory, markMessagesAsRead } from '@/features/chats/store/slices/ChatSlice';

export default function MessagesContainer() {
  const dispatch = useAppDispatch();
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);
  const messages = useSelector((state: RootState) =>
    activeChatId ? state.chat.messages[activeChatId] || [] : []
  );
  const messageStatus = useSelector((state: RootState) => state.chat.messageStatus || {});
  const userId = localStorage.getItem('userId') || '';
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch chat history when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      dispatch(fetchChatHistory(activeChatId));
      
      // Mark messages from this sender as read
      if (activeChatId !== userId) {
        dispatch(markMessagesAsRead(activeChatId));
      }
    }
  }, [activeChatId, dispatch, userId]);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!activeChatId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a chat to start messaging
      </div>
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No messages yet. Start the conversation!
      </div>
    );
  }

  // Filter out invalid or empty messages
  const validMessages = messages.filter(
    (msg) => msg && msg.id && msg.content && msg.sender
  );

  // Sort messages by timestamp to ensure proper ordering
  const sortedMessages = [...validMessages].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
      {sortedMessages.map((msg) => {
        const isSentByMe = msg.sender === userId;
        
        // Get message status with proper defaults to prevent undefined errors
        const status = messageStatus[msg.id] 
          ? messageStatus[msg.id] 
          : { 
              delivered: !!msg.delivered, 
              read: !!msg.read, 
              error: undefined 
            };
        
        return (
          <div
            key={msg.id}
            className={`max-w-xs px-4 py-2 rounded-lg text-sm relative ${
              isSentByMe
                ? 'self-end bg-blue-500 text-white'
                : 'self-start bg-gray-200 text-gray-900'
            }`}
          >
            {msg.content}
            
            {/* Show delivery status for sent messages, with null checks */}
            {isSentByMe && (
              <div className="text-xs opacity-70 text-right mt-1">
                {status && status.error ? (
                  <span className="text-red-300">Failed ⚠️</span>
                ) : status && status.read ? (
                  <span>Read ✓✓</span>
                ) : status && status.delivered ? (
                  <span>Delivered ✓✓</span>
                ) : (
                  <span>Sent ✓</span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}