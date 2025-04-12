import { useDispatch, useSelector } from 'react-redux';
import { useState, useEffect, useRef } from 'react';
import { addMessage } from '@/features/chats/store/slices/ChatSlice';
import { RootState } from '@/store/store';
import { webSocketService } from '@/features/chats/services/socket';


export default function MessageInput() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const dispatch = useDispatch();
  const chatId = useSelector((state: RootState) => state.chat.activeChatId);
  const userId = localStorage.getItem('userId') || '';
  const typingTimeoutRef = useRef<number | null>(null);

  const handleSend = () => {
    if (!input.trim() || !chatId || isSending) return;
    
    setIsSending(true);

    const messageId = crypto.randomUUID();
    const msg = {
      id: messageId,
      sender: userId,
      content: input,
      timestamp: Date.now(),
      delivered: false, // Will be updated when confirmed
      read: false,
    };

    // Send message via WebSocket using multiplexer format
    webSocketService.sendMessage({
      type: 'direct_message',
      content: {
        message: input,
        receiver_id: parseInt(chatId, 10),
        message_id: messageId // Include client message ID for tracking
      },
    });

    if(isTyping) {
      setIsTyping(false);
      sendTypingStatus(false);
    }

    // Optimistically add the message to the Redux store
    dispatch(addMessage({ chatId, message: msg }));
    setInput('');
    setIsSending(false);
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (chatId) {
      webSocketService.sendMessage({
        type: 'typing',
        content: {
          chat_type: 'direct',
          chat_id: chatId,
          is_typing: isTyping,
        },
      });
    }
  };

  useEffect(() => {
    if (input.trim().length > 0) {

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if(!isTyping){
        setIsTyping(true);
        sendTypingStatus(true);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        setIsTyping(false);
        sendTypingStatus(false);
      }, 3000);
    } else if (isTyping) {
      setIsTyping(false);
      sendTypingStatus(false);
    } 
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  },[input,chatId, isTyping]);
  
  useEffect(() => {
    return () => {
      if(isTyping && chatId){
        sendTypingStatus(false);
      }
    };
  }, [chatId, isTyping]);

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-gray-300 outline-none text-sm"
          placeholder="Type a message..."
          disabled={isSending}
        />
        <button 
          onClick={handleSend} 
          className={`${isSending ? 'bg-blue-300' : 'bg-blue-500'} text-white px-4 py-2 rounded text-sm`}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}