import { api } from '@/shared/api'
import type { Comment, PaginatedPosts, Post } from '../model/types'

export async function getPosts(page = 1) { return (await api.get<PaginatedPosts>('/posts', { params: { page } })).data }
export async function getPost(id: string) { return (await api.get<Post>(`/posts/${id}`)).data }
export async function createPost(input: { car_id: string; content: string }) { return (await api.post<Post>('/posts', input)).data }
export async function likePost(id: string) { await api.put(`/posts/${id}/like`) }
export async function unlikePost(id: string) { await api.delete(`/posts/${id}/like`) }
export async function getComments(id: string) { return (await api.get<Comment[]>(`/posts/${id}/comments`)).data }
export async function createComment(id: string, content: string) { return (await api.post<Comment>(`/posts/${id}/comments`, { content })).data }
export async function deleteComment(id: string) { await api.delete(`/comments/${id}`) }
