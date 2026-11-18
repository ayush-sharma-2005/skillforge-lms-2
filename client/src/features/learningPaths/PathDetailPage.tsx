import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Lock, PlayCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card, CardContent } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { Badge, ErrorState, Progress, Skeleton } from '@/components/ui/Feedback'
import { ApiError, getErrorMessage } from '@/lib/api'
import { formatPrice, levelLabels } from '@/lib/format'
import type { PathCourseStatus } from '@/types'
import { useEnrollInPath, useLearningPath, useMyLearningPaths, usePathProgress } from './api'

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading learning path">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

function CourseRow({ item }: { item: PathCourseStatus }) {
  const statusIcon = {
    completed: <CheckCircle2 className="size-5 text-success" aria-label="Completed" />,
    in_progress: <PlayCircle className="size-5 text-primary" aria-label="In progress" />,
    available: <PlayCircle className="size-5 text-muted" aria-label="Available" />,
    locked: <Lock className="size-5 text-muted" aria-label="Locked" />,
  }[item.status]

  const inner = (
    <div className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
      item.isUnlocked
        ? 'border-border bg-surface hover:bg-surface-muted'
        : 'border-border/50 bg-surface/50 opacity-70'
    }`}>
      <CourseThumb src={item.thumbnail} className="size-14 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{item.title}</span>
          <Badge>{levelLabels[item.level] ?? item.level}</Badge>
          {item.status === 'completed' && <Badge tone="success">Completed</Badge>}
          {item.price > 0 && <Badge>{formatPrice(item.price)}</Badge>}
        </div>
        {item.isUnlocked && item.progress.totalLessons > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <Progress value={item.progress.percentage} label={`${item.title} progress`} className="h-1.5 flex-1" />
            <span className="shrink-0 text-xs text-muted">{item.progress.percentage}%</span>
          </div>
        )}
        {!item.isUnlocked && item.unmetPrerequisites.length > 0 && (
          <p className="mt-1 text-xs text-muted">
            Complete first: {item.unmetPrerequisites.map((p) => p.title).join(', ')}
          </p>
        )}
      </div>
      <span className="shrink-0" aria-hidden="true">{statusIcon}</span>
    </div>
  )

  if (!item.isUnlocked) return <li>{inner}</li>

  return (
    <li>
      <Link to={`/courses/${item.courseId}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-xl">
        {inner}
      </Link>
    </li>
  )
}

export function PathDetailPage() {
  const { pathId } = useParams()
  const path = useLearningPath(pathId)
  const myPaths = useMyLearningPaths()
  const enroll = useEnrollInPath(pathId ?? '')
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const isEnrolled = (myPaths.data?.learningPaths ?? []).some((mp) => mp._id === pathId)
  const progress = usePathProgress(pathId, isEnrolled)

  if (path.isPending) return <DetailSkeleton />

  if (path.isError) {
    const notFound = path.error instanceof ApiError && (path.error.status === 404 || path.error.status === 400)
    return (
      <div className="space-y-6">
        <Link to="/learning-paths" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to paths
        </Link>
        {notFound ? <ErrorState message="This learning path does not exist." /> : <ErrorState message={getErrorMessage(path.error)} onRetry={() => void path.refetch()} />}
      </div>
    )
  }

  const lp = path.data.learningPath
  const summary = progress.data?.summary
  const courseStatuses = progress.data?.courses ?? []

  // For non-enrolled: show static course list from path detail
  const staticCourses = [...lp.courses].sort((a, b) => a.order - b.order)

  const onEnroll = async () => {
    setEnrollError(null)
    try {
      const result = await enroll.mutateAsync()
      const count = (result as { autoEnrolledCourses: string[] }).autoEnrolledCourses.length
      toast.success(count > 0 ? `Enrolled! ${count} free course${count > 1 ? 's' : ''} added to your library.` : 'Enrolled in learning path!')
    } catch (err) {
      setEnrollError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/learning-paths" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to paths
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          <Card className="overflow-hidden">
            <CourseThumb src={lp.thumbnail} className="h-56 w-full sm:h-72" />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{lp.category}</Badge>
                <Badge>{levelLabels[lp.level] ?? lp.level}</Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{lp.title}</h1>
              <p className="text-lg text-muted">{lp.description}</p>
              <p className="flex items-center gap-2 text-sm text-muted">
                <User className="size-4" aria-hidden="true" /> Created by{' '}
                <span className="font-semibold text-foreground">{lp.instructor?.name ?? 'Instructor'}</span>
              </p>
            </CardContent>
          </Card>

          {/* Course list */}
          <section aria-labelledby="path-courses-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="path-courses-heading" className="text-xl font-semibold tracking-tight text-foreground">
                Courses in this path
              </h2>
              <span className="text-sm text-muted">
                {lp.courses.length} course{lp.courses.length === 1 ? '' : 's'}
              </span>
            </div>

            {isEnrolled && progress.isPending ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : isEnrolled && courseStatuses.length > 0 ? (
              <ol className="space-y-3">
                {courseStatuses.map((item) => (
                  <CourseRow key={item.courseId} item={item} />
                ))}
              </ol>
            ) : (
              <ol className="space-y-3">
                {staticCourses.map((item) => (
                  <li key={item.course._id}>
                    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tan/20 text-sm font-bold text-primary">
                        {item.order}
                      </span>
                      <CourseThumb src={item.course.thumbnail} className="size-14 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{item.course.title}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge>{levelLabels[item.course.level] ?? item.course.level}</Badge>
                          {item.course.price > 0
                            ? <Badge>{formatPrice(item.course.price)}</Badge>
                            : <Badge tone="success">Free</Badge>}
                        </div>
                        {item.prerequisites.length > 0 && (
                          <p className="mt-1 text-xs text-muted">
                            After: {item.prerequisites.map((pr) => pr.title).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Sticky enroll panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Enrollment">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl bg-tan/20 text-primary">
                  <BookOpen className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{lp.courses.length} courses</p>
                  <p className="text-sm text-muted">{lp.level} level</p>
                </div>
              </div>

              {isEnrolled && summary && (
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {summary.completedCourses} of {summary.totalCourses} courses done
                    </span>
                    <span className="font-semibold text-foreground">{summary.overallPathPercentage}%</span>
                  </div>
                  <Progress value={summary.overallPathPercentage} label="Your progress in this learning path" />
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-success/10 p-2">
                      <p className="font-semibold text-success">{summary.completedCourses}</p>
                      <p className="text-muted">Done</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2">
                      <p className="font-semibold text-primary">{summary.unlockedCourses - summary.completedCourses}</p>
                      <p className="text-muted">In progress</p>
                    </div>
                    <div className="rounded-lg bg-tan/20 p-2">
                      <p className="font-semibold text-muted">{summary.lockedCourses}</p>
                      <p className="text-muted">Locked</p>
                    </div>
                  </div>
                </div>
              )}

              {isEnrolled ? (
                // Find first available/in_progress course
                (() => {
                  const next = courseStatuses.find((cs) => cs.status === 'in_progress') ?? courseStatuses.find((cs) => cs.status === 'available')
                  return next ? (
                    <Link to={`/courses/${next.courseId}`} className={buttonClasses({ size: 'lg', fullWidth: true })}>
                      <PlayCircle className="size-5" aria-hidden="true" />
                      {summary && summary.completedCourses > 0 ? 'Continue path' : 'Start path'}
                    </Link>
                  ) : summary?.overallPathPercentage === 100 ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-success/15 p-4 font-semibold text-success">
                      <CheckCircle2 className="size-5" /> Path completed!
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-tan/20 p-4 text-sm text-muted">
                      <Clock className="size-4 shrink-0" /> Complete prerequisite courses to unlock the next one.
                    </div>
                  )
                })()
              ) : (
                <button
                  type="button"
                  disabled={enroll.isPending}
                  onClick={() => void onEnroll()}
                  className={buttonClasses({ size: 'lg', fullWidth: true })}
                >
                  {enroll.isPending ? 'Enrolling…' : 'Start this path'}
                </button>
              )}

              {enrollError && (
                <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{enrollError}</p>
              )}

              <dl className="space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Level</dt>
                  <dd className="font-medium text-foreground">{levelLabels[lp.level] ?? lp.level}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Category</dt>
                  <dd className="font-medium text-foreground">{lp.category}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Instructor</dt>
                  <dd className="font-medium text-foreground">{lp.instructor?.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Courses</dt>
                  <dd className="font-medium text-foreground">{lp.courses.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
