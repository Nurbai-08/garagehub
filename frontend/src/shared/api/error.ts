import axios from 'axios'

export function apiMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return 'Произошла непредвиденная ошибка'
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message as string
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg as string
  return error.code === 'ECONNABORTED' ? 'Сервер не ответил вовремя' : 'Не удалось связаться с сервером'
}

export function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401
}
