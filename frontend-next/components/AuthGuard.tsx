'use client'
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])
  if (loading) return <Spinner />
  if (!user) return null
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isAdmin()) router.replace('/')
    }
  }, [user, loading, router])
  if (loading) return <Spinner />
  if (!user || !isAdmin()) return null
  return <>{children}</>
}
