import { useEffect, useState } from "react";
// Simple notification popup component
const UnreadNotification: React.FC<{ total: number }> = ({ total }) => (
  <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
    You have {total} unread message{total > 1 ? 's' : ''}!
  </div>
);
import React from "react";
import SearchBar from "../common/SearchBar";
import SearchResults from "../common/SearchResults";
import ContactItem from "../chat/ContactItem";
import { fetchChatHistory } from "../../store/slices/ChatSlice";
import { useSelector } from "react-redux";
import { useAppDispatch } from '@/store/store';
import { RootState } from "@/store/store";
import { setActiveChatId } from "../../store/slices/ChatSlice";
// import Topbar from "@/shared/ui/topbar/Topbar";
const SideBar = () => {
  const [showNotification, setShowNotification] = useState(false);
  const dispatch = useAppDispatch();
  const contacts = useSelector((state: RootState) => state.contacts.list);
  // Calculate total unread messages
  const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  useEffect(() => {
    if (totalUnread > 0) {
      setShowNotification(true);
      const timer = setTimeout(() => setShowNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [totalUnread]);
  // ...existing code...

  // Use Redux state for search results, loading status, and query
  const { loading, query } = useSelector((state: RootState) => state.search);
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);

  // Show the container if loading or query is non-empty
  const showSearchResults = loading || query.trim().length > 0;

  return ( 
    
    <aside className="w-1/4 min-w-[250px] border-r border-gray-200 flex flex-col h-full">
      {showNotification && <UnreadNotification total={totalUnread} />}
      
      <div className="p-4 border-b border-gray-100">
        <SearchBar />
      </div>

      {/* Smooth transition container for SearchResults */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          showSearchResults ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <SearchResults />
      </div>

      {/* Always show contacts below */}
      <div className="flex-1 overflow-y-auto py-2 px-2 transition-all duration-300 ease-out">
        {contacts.map((contact) => (
          <ContactItem
            key={contact.id}
            name={contact.name}
            active={activeChatId === contact.id}
            unreadCount={contact.unreadCount}
            onClick={() => {
              dispatch(setActiveChatId(contact.id));
              dispatch(fetchChatHistory(contact.id));
            }}
          />
        ))}
      </div>
    </aside>
  );
};

export default SideBar;