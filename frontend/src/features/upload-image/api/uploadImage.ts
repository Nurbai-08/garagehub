import { api } from '@/shared/api'

export async function uploadImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return (await api.post<{ url: string }>('/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.url
}
