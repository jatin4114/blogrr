import React from "react";
import ChatHeader from "../chat/ChatHeader";
import MessagesContainer from "../chat/MessagesContainer";
import MessageInput from "../chat/MessageInput";
import TypingIndicator from "../chat/TypingIndicator";

const ChatWindow = () => {  
  return (
    <div className="flex flex-col flex-1 h-full">
      <ChatHeader />
      <MessagesContainer />
      <TypingIndicator/>
      <MessageInput />
    </div>
  );
}
export default ChatWindow;