import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";



export default function ChatHeader() {
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);
  const contacts = useSelector((state: RootState) => state.contacts.list);

  // Find the active contact by matching IDs
  const activeContact = contacts.find(contact => contact.id === activeChatId);
  const name = activeContact ? activeContact.name : "Start Chat";

  return (
    <div className="p-4 border-b border-gray-200 font-medium text-lg flex items-center">
      <div className="flex-1">{name}</div>
      <div className="flex gap-2">
        {/* Optional: Add action icons here */}
      </div>
    </div>
  );
}