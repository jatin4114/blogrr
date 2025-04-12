import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

export default function TypingIndicator() {
  const typingUsers = useSelector((state: RootState) => state.chat.typingUsers);
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);
  const contacts = useSelector((state: RootState) => state.contacts.list);

  // Return null if there's no active chat or no typing users for the active chat
  if (!activeChatId || !typingUsers[activeChatId] || typingUsers[activeChatId].length === 0) {
    return null;
  }

  // Convert user IDs to usernames when possible
  const typingUsernames = typingUsers[activeChatId].map(userId => {
    const contact = contacts.find(c => c.id === userId);
    return contact ? contact.name : userId;
  });

  // Only show typing indicator if we have typing users
  if (typingUsernames.length === 0) {
    return null;
  }

  return (
    <div className="text-sm text-gray-500 px-4 py-1 flex items-center">
      <div className="typing-indicator mr-2">
        <span></span>
        <span></span>
        <span></span>
      </div>
      {typingUsernames.length === 1
        ? `${typingUsernames[0]} is typing...`
        : `${typingUsernames.slice(0, 2).join(", ")} ${typingUsernames.length > 2 ? 'and others' : ''} are typing...`}
    </div>
  );
}