import React from "react";
import SearchBar from "../common/SearchBar";
import SearchResults from "../common/SearchResults";
import ContactItem from "../chat/ContactItem";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { setActiveChatId } from "../../store/slices/ChatSlice";

const SideBar = () => {
  const dispatch = useDispatch();
  const contacts = useSelector((state: RootState) => state.contacts.list);

  // Use Redux state for search results, loading status, and query
  const { results, loading, query } = useSelector((state: RootState) => state.search);
  const activeChatId = useSelector((state: RootState) => state.chat.activeChatId);

  // Show the container if loading or query is non-empty
  const showSearchResults = loading || query.trim().length > 0;

  return (
    <aside className="w-1/4 min-w-[250px] border-r border-gray-200 flex flex-col h-full">
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
            onClick={() => dispatch(setActiveChatId(contact.id))}
          />
        ))}
      </div>
    </aside>
  );
};

export default SideBar;