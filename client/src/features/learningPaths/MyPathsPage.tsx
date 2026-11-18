import { Link } from 'react-router-dom'
import { BookOpen, ArrowRight } from 'lucide-react'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card, CardContent } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { Badge, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { levelLabels } from '@/lib/format'
import type { MyLearningPath } from '@/types'
import { useMyLearningPaths } from './api'

function PathTile({ path }: { path: MyLearningPath }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-0 sm:flex-row flex-col">
        <CourseThumb src={path.thumbnail} className="h-36 sm:h-auto sm:w-40 shrink-0" />
        <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{path.category}</Badge>
              <Badge>{levelLabels[path.level] ?? path.level}</Badge>
            </div>
            <h2 className="text-lg font-semibold leading-snug text-foreground">{path.title}</h2>
            <p className="line-clamp-2 text-sm text-muted">{path.description}</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <BookOpen className="size-4" aria-hidden="true" />
              {path.courses.length} course{path.courses.length === 1 ? '' : 's'}
            </span>
            <Link
              to={`/learning-paths/${path._id}`}
              className={buttonClasses({ variant: 'primary', size: 'sm' })}
            >
              Continue <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

function TileSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex gap-0 sm:flex-row flex-col">
        <Skeleton className="h-36 sm:h-auto sm:w-40 shrink-0 rounded-none" />
        <div className="flex-1 space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  )
}

export function MyPathsPage() {
  const { data, isPending, isError, error, refetch } = useMyLearningPaths()
  const paths = data?.learningPaths ?? []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Learning Paths</h1>
          <p className="mt-1 text-muted">Your enrolled structured journeys.</p>
        </div>
        <Link to="/learning-paths" className={buttonClasses({ variant: 'secondary' })}>
          Browse paths
        </Link>
      </div>

      {isError ? (
        <ErrorState message={String(error)} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => <TileSkeleton key={i} />)}
        </div>
      ) : paths.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-tan/20 text-primary">
            <BookOpen className="size-8" aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold text-foreground">No learning paths yet</p>
          <p className="max-w-sm text-muted">Enroll in a learning path to follow a structured journey through multiple courses.</p>
          <Link to="/learning-paths" className={buttonClasses()}>Browse learning paths</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {paths.map((mp) => <PathTile key={mp._id} path={mp} />)}
        </div>
      )}
    </div>
  )
}
