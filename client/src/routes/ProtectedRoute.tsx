import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
      <Logo />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-gradient" />
      </div>
      <span className="sr-only">Loading your session</span>
    </div>
  )
}

/** Requires a signed-in user. Pass `roles` to also restrict by role. */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

/** Public-only wrapper that waits for session restore so the login page does not flash. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth()
  if (loading) return <FullPageLoader />
  return <>{children}</>
}
