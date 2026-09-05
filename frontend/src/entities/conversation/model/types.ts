export type Conversation = {
  id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};
export type Message = {
  id: string;
  conversation_id: string;
  sender_username: string;
  content: string;
  created_at: string;
  read_at: string | null;
};
export type CommunityMessage = {
  id: string;
  sender_username: string;
  content: string;
  created_at: string;
};
