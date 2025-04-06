import { UserBasic } from './userTypes';

export enum ChatType {
  SINGLE = 'single',
  GROUP = 'group'
}

export enum MemberRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

export interface Message {
  id: string;
  senderId: number;
  receiverId?: number;
  groupId?: number;
  message: string;
  timestamp: string;
  delivered: boolean;
  read?: boolean;
}

export interface LastMessage {
  content: string;
  timestamp: string;
  senderName?: string;
}

export interface Contact {
  id: number;
  username: string;
  isOnline: boolean;
  lastMessage: LastMessage | null;
  unreadCount: number;
}

export interface ChatContact {
  id: number;
  username: string;
  isOnline: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface GroupMember {
  id: number;
  userId: number;
  username: string;
  role: MemberRole;
  joinedAt: string;
}

export interface GroupChat {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  createdById: number;
  members: GroupMember[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface ActiveChatState {
  type: ChatType;
  contactId?: number;
  groupId?: number;
  messages: Message[];
  isLoading: boolean;
}

export interface ActiveChat {
  type: ChatType;
  contactId?: number;
  groupId?: number;
  messages: Message[];
  isLoading: boolean;
}

export interface SearchResults {
  users: User[];
  groups: any[];
  isLoading: boolean;
}

export interface User {
  id: number;
  username: string;
  isOnline?: boolean;
}

export interface UnreadCounts {
  total: number;
  bySender: Record<string, number>;
}

export interface ChatState {
  contacts: Contact[];
  groups: Group[];
  activeChat: ActiveChat | null;
  isLoading: boolean;
  isContactsLoading?: boolean;
  isGroupsLoading?: boolean;
  error: string | null;
  searchResults: {
    users: UserBasic[];
    total: number;
    page: number;
    size: number;
  };
  isSearching: boolean;
  searchError: string | null;
  unreadCounts: UnreadCounts;
}

// Reexporting GroupChat from groupTypes to avoid circular dependencies
export interface Group {
  id: number;
  name: string;
  description?: string;
  members: {
    id: number;
    username: string;
    role: string;
  }[];
  lastMessage: {
    content: string;
    timestamp: string;
    senderName: string;
  } | null;
  unreadCount: number;
}