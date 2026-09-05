import { api } from '@/shared/api'

export async function uploadImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return (await api.post<{ url: string }>('/uploads/images', form, { timeout: 60_000 })).data.url
}
