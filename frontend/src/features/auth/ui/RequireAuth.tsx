import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../model/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth()
  const location = useLocation()
  if (isRestoring) return <main className="inner-page"><div className="page-loader">Восстанавливаем сессию…</div></main>
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
