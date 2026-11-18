import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler } from '@/lib/api'
import type { AuthResponse, User } from '@/types'

interface AuthContextValue {
  user: User | null
  /** True only while we are checking for an existing session on first load. */
  loading: boolean
  login: (input: { email: string; password: string }) => Promise<User>
  register: (input: { name: string; email: string; password: string }) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the httpOnly cookie. We use /users/profile because
  // /auth/me on the server currently returns only { userId, role }.
  useEffect(() => {
    const controller = new AbortController()
    api
      .get<AuthResponse>('/users/profile', undefined, controller.signal)
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  // If any request comes back 401 later, drop the local session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      queryClient.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  const login = useCallback<AuthContextValue['login']>(async (input) => {
    const data = await api.post<AuthResponse>('/auth/login', input)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback<AuthContextValue['register']>(async (input) => {
    const data = await api.post<AuthResponse>('/auth/register', input)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
      queryClient.clear()
    }
  }, [queryClient])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
