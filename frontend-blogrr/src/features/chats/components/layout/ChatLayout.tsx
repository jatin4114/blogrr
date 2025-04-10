import UseSocket from "../hooks/UseSocket";
import SideBar from "./SideBar";
import ChatWindow from "./ChatWindow";
import { useAppDispatch } from "@/store/store";
import { useEffect } from "react";
import { fetchContacts } from "../../store/slices/ContactSlice";
import { setActiveChatId } from "../../store/slices/ChatSlice";
import { useAppSelector } from "@/store/store";

export default function ChatLayout() {
  UseSocket(); // Initialize socket connection when ChatLayout is rendered

  const dispatch = useAppDispatch();
  const contacts = useAppSelector((state) => state.contacts.list);
  useEffect(() => {
    dispatch(fetchContacts());
  }, [dispatch]);

  useEffect(() => {
    if (contacts.length > 0) {
      dispatch(setActiveChatId(contacts[0].id)); // Set the first contact as active
    }
  }, [contacts, dispatch]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SideBar />
      <ChatWindow />
    </div>
  );
}