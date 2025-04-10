import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { addMessage } from '../../store/slices/ChatSlice';
import { RootState } from '@/store/store';
import { socket, webSocketService } from '../../services/socket';

export default function MessageInput() {
  const [input, setInput] = useState('');
  const dispatch = useDispatch();
  const chatId = useSelector((state: RootState) => state.chat.activeChatId);

  const handleSend = () => {
    if (!input.trim() || !chatId) return;

    const msg = {
      id: crypto.randomUUID(),
      sender: 'me',
      content: input,
      timestamp: Date.now(),
      chatId
    };

    // Send message via WebSocket
    const userId = localStorage.getItem('userId') || '';
    webSocketService.sendMessage({
      type: 'direct',
      message: input,
      sender_id: userId,
      receiver_id: chatId,
      timestamp: new Date().toISOString()
    });

    dispatch(addMessage({ chatId, message: msg }));
    setInput('');
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-gray-300 outline-none text-sm"
          placeholder="Type a message..."
        />
        <button onClick={handleSend} className="bg-blue-500 text-white px-4 py-2 rounded text-sm">
          Send
        </button>
      </div>
    </div>
  );
}
