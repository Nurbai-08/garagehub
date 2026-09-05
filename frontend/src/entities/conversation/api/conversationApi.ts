import { api } from "@/shared/api";
import type { CommunityMessage, Conversation, Message } from "../model/types";

export async function startConversation(carId: string) {
  return (await api.post<Conversation>(`/cars/${carId}/conversation`)).data;
}
export async function getConversations() {
  return (await api.get<Conversation[]>("/conversations")).data;
}
export async function getConversation(id: string) {
  return (await api.get<Conversation>(`/conversations/${id}`)).data;
}
export async function getMessages(id: string) {
  return (await api.get<Message[]>(`/conversations/${id}/messages`)).data;
}
export async function sendMessage(id: string, content: string) {
  return (await api.post<Message>(`/conversations/${id}/messages`, { content }))
    .data;
}
export async function getCommunityMessages() {
  return (await api.get<CommunityMessage[]>("/community/messages")).data;
}
export async function sendCommunityMessage(content: string) {
  return (await api.post<CommunityMessage>("/community/messages", { content }))
    .data;
}
