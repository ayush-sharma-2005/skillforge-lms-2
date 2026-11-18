import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { api, getErrorMessage } from '@/lib/api'
import type { EnrolledCourse } from '@/types'
import { CourseTile } from './CourseTile'

export function MyCoursesPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['student', 'my-courses'],
    queryFn: () => api.get<{ courses: EnrolledCourse[] }>('/students/my-courses').then((d) => d.courses),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My courses</h1>
        <p className="mt-1 text-muted">Everything you are enrolled in, with your progress.</p>
      </div>

      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading your courses">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-7" />}
          title="You are not enrolled in any courses yet"
          description="Find something that fits your goals in the course catalog."
          action={
            <Link to="/courses" className={buttonClasses()}>
              Browse the catalog
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((course) => (
            <CourseTile key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
