import { useDispatch, useSelector } from 'react-redux';
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { addMessage } from '@/features/chats/store/slices/ChatSlice';
import { RootState } from '@/store/store';
import { webSocketService } from '@/features/chats/services/socket';


export default function MessageInput() {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const dispatch = useDispatch();
  const chatId = useSelector((state: RootState) => state.chat.activeChatId);
  const userId = localStorage.getItem('userId') || '';
  const typingTimeoutRef = useRef<number | null>(null);

  const handleSend = () => {
    if ((!input.trim() && !image) || !chatId || isSending) return;
    setIsSending(true);
    const messageId = crypto.randomUUID();
    const currentTime = Date.now();
    // Create the message object for local state
    const msg = {
      id: messageId,
      sender: userId,
      content: input,
      timestamp: currentTime,
      delivered: false,
      read: false,
      image: image || undefined,
    };
    // Send message via WebSocket using multiplexer format
    webSocketService.sendMessage({
      type: 'direct_message',
      content: {
        message: input,
        receiver_id: parseInt(chatId, 10),
        message_id: messageId,
        timestamp: new Date().toISOString(),
        image: image || undefined,
      },
    });
    if(isTyping) {
      setIsTyping(false);
      sendTypingStatus(false);
    }
    dispatch(addMessage({ chatId, message: msg }));
    setInput('');
    setImage(null);
    setIsSending(false);
  };
  // Handle image file selection and convert to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle key press events for the input field
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Send message on Enter key (but not with Shift+Enter which is for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default to avoid form submission or line break
      handleSend();
    }
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
        {/* Paperclip icon for image upload */}
        <label className="cursor-pointer flex items-center" title="Attach image">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 10-5.657-5.657l-7.07 7.07a6 6 0 108.485 8.485l6.586-6.586" />
          </svg>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 rounded border border-gray-300 outline-none text-sm"
          placeholder="Type a message... (Press Enter to send)"
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
      {/* Show image preview if selected */}
      {image && (
        <div className="mt-2 flex items-center">
          <img src={image} alt="preview" className="max-h-32 rounded shadow" />
          <button className="ml-2 text-xs text-red-500" onClick={() => setImage(null)}>Remove</button>
        </div>
      )}
    </div>
  );
}