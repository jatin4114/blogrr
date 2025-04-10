import UseSocket from "../hooks/UseSocket";
import SideBar from "./SideBar";
import ChatWindow from "./ChatWindow";

export default function ChatLayout() {
  UseSocket(); // Initialize socket connection when ChatLayout is rendered
  return (
    <div className="flex h-full w-full overflow-hidden">
      <SideBar />
      <ChatWindow />
    </div>
  );
}