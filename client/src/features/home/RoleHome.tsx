import { lazy, Suspense } from 'react'
import { Hammer } from 'lucide-react'
import { EmptyState, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/context/AuthContext'
import { roleLabels } from '@/lib/format'

// Loaded on demand so the login page does not pay for the chart library.
const StudentDashboardPage = lazy(() =>
  import('@/features/student/DashboardPage').then((m) => ({ default: m.StudentDashboardPage })),
)

function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/** /dashboard shows the right home for the signed-in role. */
export function RoleHome() {
  const { user } = useAuth()
  if (!user) return null

  if (user.role === 'student') {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <StudentDashboardPage />
      </Suspense>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-muted">Signed in as {roleLabels[user.role] ?? user.role}.</p>
      </div>
      <EmptyState
        icon={<Hammer className="size-7" />}
        title="Your workspace is being built"
        description="The student experience is ready first. The dashboard for your role comes in a later step."
      />
    </div>
  )
}
