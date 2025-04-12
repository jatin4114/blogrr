import { useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@/store/store";
import { useState, useEffect } from "react";
import { FetchSearchUsers, clearResults, setQuery as setQueryAction } from "../../store/slices/SearchSlice";

export default function SearchBar() {
    const [localQuery, setLocalQuery] = useState("");
    const [query, setQuery] = useState("");
    const dispatch = useAppDispatch(); // Use typed dispatch
    const {results,loading} = useSelector((state: RootState) => state.search);
    
    
    useEffect(() => {
    const timeout = setTimeout(() => {
      if (localQuery.trim()) {
        dispatch(setQueryAction(localQuery));
        dispatch(FetchSearchUsers(localQuery));
      } else {
        dispatch(clearResults());
      }
    }, 300); // debounce search

    return () => clearTimeout(timeout);
  }, [localQuery, dispatch]);



  useEffect(() => {
    console.log("Raw API Response:", results);
    // You can also check what fields are available in the first result
    if (results.length > 0) {
      console.log("First result fields:", Object.keys(results[0]));
    }
  }, [results]);

    return (
        <div className="relative w-full ">
        <div className="flex items-center gap-2 px-2 bg-gray-100 rounded">
            <svg className="w-5 h-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            height={24}
            width={24}>
                <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"
        />
           </svg>
            <input
                type="text"
                placeholder="Search Users"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="flex-1 px-2 py-1 bg-transparent outline-none"
            />


        </div>
        </div>
    );
}