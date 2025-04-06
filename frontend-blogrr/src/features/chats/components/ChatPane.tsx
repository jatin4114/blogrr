import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

interface ChatPaneProps {
  currentUserId: number;
  messages: {
    id: number;
    sender_id: number;
    receiver_id: number;
    message: string;
    timestamp: string;
  }[];
  onSendMessage: (msg: string) => void;
}

const ChatPane: React.FC<ChatPaneProps> = ({ currentUserId, messages, onSendMessage }) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowSenderChange = (index: number) => {
    if (index === 0) return true;
    return messages[index].sender_id !== messages[index - 1].sender_id;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.map((msg, index) => (
          <div key={msg.id} className="flex flex-col">
            {shouldShowSenderChange(index) && (
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm font-bold">
                  {msg.sender_id === currentUserId ? 'You' : `U${msg.sender_id}`}
                </div>
                <span className="ml-2 text-xs text-gray-500">
                  {msg.sender_id === currentUserId ? 'You' : `User ${msg.sender_id}`}
                </span>
              </div>
            )}
            <div
              className={classNames('max-w-xs p-3 rounded-lg shadow', {
                'bg-blue-500 text-white self-end': msg.sender_id === currentUserId,
                'bg-gray-300 text-gray-800 self-start': msg.sender_id !== currentUserId,
              })}
            >
              {msg.message}
            </div>
            <div
              className={classNames('text-xs mt-1', {
                'text-right': msg.sender_id === currentUserId,
                'text-left': msg.sender_id !== currentUserId,
              })}
            >
              {formatTimestamp(msg.timestamp)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSendMessage} className="flex items-center p-4 bg-white border-t">
        <input
          type="text"
          className="flex-1 border rounded-lg p-2 mr-2 focus:outline-none focus:ring focus:ring-blue-300"
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
          disabled={!messageText.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPane;
