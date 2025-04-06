// Group chat type definitions
import { MemberRole } from './chatTypes';

export interface GroupMessage {
  id: string;
  groupId: number;
  senderId: number;
  message: string;
  timestamp: string;
  delivered: boolean;
  read?: boolean;
}

export interface GroupMember {
  userId: number; // Ensure `userId` is included
  username: string;
  role: MemberRole;
  joinedAt?: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  members: GroupMember[];
  lastMessage: {
    content: string;
    timestamp: string;
    senderName: string;
  } | null;
  unreadCount: number;
}

export interface GroupChatResponse {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  created_by_id: number;
}

export interface NewGroupData {
  name: string;
  description?: string;
}

export interface AddMembersData {
  groupId: number;
  userIds: number[];
}
