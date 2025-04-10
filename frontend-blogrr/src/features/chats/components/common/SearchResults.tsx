import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import Tab from "./Tab";
import { useState, useEffect } from "react";

export default function SearchResults() {
  const { results, loading } = useSelector((state: RootState) => state.search);
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
  const [showNoResults, setShowNoResults] = useState(false);

  useEffect(() => {
    // When not loading and results are empty, wait a brief moment before showing "no results"
    if (!loading && results.length === 0) {
      const timer = setTimeout(() => {
        setShowNoResults(true);
      }, 500); // delay (in ms) before showing "No user results found"
      return () => clearTimeout(timer);
    } else {
      setShowNoResults(false);
    }
  }, [loading, results]);

  return (
    <div className="border-b p-2 bg-gray-50">
      <div className="flex">
        <Tab label="direct" />
        <Tab label="groups" />
      </div>
      {activeTab === "direct" && (
        <div className="mt-2">
          <h3 className="text-lg font-semibold mb-2">User Search Results</h3>
          {loading ? (
            <p className="text-gray-500 p-2">Searching...</p>
          ) : results.length > 0 ? (
            <ul>
              {results.map((user) => (
                <li key={user.id} className="p-2 hover:bg-gray-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://api.dicebear.com/6.x/initials/svg?seed=${user.username}`}
                      alt={user.username}
                      className="rounded-full w-8 h-8 object-cover"
                    />
                    <span>{user.username}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            showNoResults && (
              <p className="text-sm text-gray-400 p-2">
                No user results found.
              </p>
            )
          )}
        </div>
      )}
      {activeTab === "groups" && (
        <div className="mt-2">
          <h3 className="text-lg font-semibold mb-2">Group Search Results</h3>
          <p className="text-gray-500 p-2">Groups search coming soon...</p>
        </div>
      )}
    </div>
  );
}