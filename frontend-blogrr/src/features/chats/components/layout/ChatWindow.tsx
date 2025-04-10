import React from "react";
import ChatHeader from "../chat/ChatHeader";
import MessagesContainer from "../chat/MessagesContainer";
import MessageInput from "../chat/MessageInput";

const ChatWindow = () => {  
  return (
    <div className="flex flex-col flex-1 h-full">
      <ChatHeader name="John Doe" />
      <MessagesContainer />
      <MessageInput />
    </div>
  );
}
export default ChatWindow;