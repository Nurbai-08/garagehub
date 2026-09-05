export type Post = { id: string; author_username: string; car_id: string; car_name: string; car_cover_url: string; content: string; created_at: string; likes_count: number; is_liked?: boolean; comments_count: number }
export type Comment = { id: string; author_username: string; content: string; created_at: string }
export type PaginatedPosts = { items: Post[]; page: number; page_size: number; total: number; total_pages: number }
