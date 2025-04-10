import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

export default function MessagesContainer() {
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);
  const messages = useSelector((state: RootState) =>
    activeChatId ? state.chat.messages[activeChatId] || [] : []
  );
  
  if (!activeChatId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a chat to start messaging
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No messages yet. Start the conversation!
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
            msg.sender === 'me'
              ? 'self-end bg-blue-500 text-white'
              : 'self-start bg-gray-200 text-gray-900'
          }`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  );
  }