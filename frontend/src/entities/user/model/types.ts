export type User = {
  id: string
  email: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export type PublicProfile = {
  username: string
  display_name: string | null
  bio: string | null
  city: string | null
  avatar_url: string | null
  created_at: string
  cars_count: number
  posts_count: number
}
