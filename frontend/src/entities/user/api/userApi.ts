import { api } from '@/shared/api'
import type { PublicProfile, User } from '../model/types'

export async function getProfile(username: string) { return (await api.get<PublicProfile>(`/users/${username}`)).data }
export async function updateProfile(input: { display_name: string | null; bio: string | null; city: string | null }) { return (await api.patch<User>('/users/me', input)).data }
