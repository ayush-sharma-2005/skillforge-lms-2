import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Globe, Info, Lock, PlayCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card, CardContent } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { Badge, ErrorState, Progress, Skeleton } from '@/components/ui/Feedback'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import { LessonList } from '@/features/lessons/LessonList'
import { lessonHref } from '@/features/lessons/links'
import { ApiError, getErrorMessage } from '@/lib/api'
import { formatDuration, formatPrice, languageName, levelLabels } from '@/lib/format'
import type { Lesson } from '@/types'
import { useCourse, useCourseLessons, useCourseProgress, useEnroll, useMyEnrollments } from './api'

/** First lesson that is open and not finished, else the first open lesson. */
function pickNextLesson(lessons: Lesson[], completed: ReadonlySet<string>): Lesson | undefined {
  const open = lessons.filter((l) => !l.isLocked)
  return open.find((l) => !completed.has(l._id)) ?? open[0]
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading course">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}

export function CourseDetailPage() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const lang = params.get('lang')

  const course = useCourse(courseId, lang ?? undefined)
  const enrollments = useMyEnrollments()

  const isOwner = Boolean(user && course.data && course.data.instructor?._id === user.id)
  const isEnrolled = (enrollments.data ?? []).some((e) => e.course?._id === courseId)
  const canViewLessons = isEnrolled || isOwner || user?.role === 'admin'

  const lessons = useCourseLessons(courseId, canViewLessons, lang ?? undefined)
  const progress = useCourseProgress(courseId, isEnrolled)
  const enroll = useEnroll(courseId ?? '')

  // Paid courses create a pending enrollment; remember it so we can explain what is happening.
  const [awaitingPayment, setAwaitingPayment] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const completedIds = useMemo(() => new Set(progress.data?.completedLessonIds ?? []), [progress.data])
  const nextLesson = useMemo(() => pickNextLesson(lessons.data ?? [], completedIds), [lessons.data, completedIds])
  const totalSeconds = useMemo(() => (lessons.data ?? []).reduce((sum, l) => sum + l.duration, 0), [lessons.data])

  if (course.isPending) return <DetailSkeleton />

  if (course.isError) {
    const notFound = course.error instanceof ApiError && (course.error.status === 404 || course.error.status === 400)
    return (
      <div className="space-y-6">
        <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to catalog
        </Link>
        {notFound ? (
          <ErrorState message="This course does not exist or is not published." />
        ) : (
          <ErrorState message={getErrorMessage(course.error)} onRetry={() => void course.refetch()} />
        )}
      </div>
    )
  }

  const c = course.data

  const onEnroll = async () => {
    setEnrollError(null)
    try {
      const result = await enroll.mutateAsync()
      if (result.enrollment.status === 'active') {
        toast.success('You are enrolled. Happy learning!')
      } else {
        setAwaitingPayment(true)
        toast.info('Enrollment created. Payment is required before you can start.')
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAwaitingPayment(true)
        setEnrollError('You already have an enrollment record for this course. If it is waiting for payment, it will unlock once payment is complete.')
      } else {
        setEnrollError(getErrorMessage(error))
      }
    }
  }

  const continueHref = courseId && nextLesson ? lessonHref(courseId, nextLesson._id, lang) : null
  const languages = c.supportedLanguages?.length ? c.supportedLanguages : [c.language]

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to catalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          <Card className="overflow-hidden">
            <CourseThumb src={c.thumbnail} className="h-56 w-full sm:h-72" />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{c.category}</Badge>
                <Badge>{levelLabels[c.level] ?? c.level}</Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{c.title}</h1>
              <p className="text-lg text-muted">{c.shortDescription}</p>
              <p className="flex items-center gap-2 text-sm text-muted">
                <User className="size-4" aria-hidden="true" /> Taught by <span className="font-semibold text-foreground">{c.instructor?.name ?? 'Instructor'}</span>
              </p>
            </CardContent>
          </Card>

          <section aria-labelledby="about-heading" className="space-y-3">
            <h2 id="about-heading" className="text-xl font-semibold tracking-tight text-foreground">
              About this course
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">{c.description}</p>
          </section>

          {c.learningOutcomes.length > 0 && (
            <section aria-labelledby="outcomes-heading" className="space-y-3">
              <h2 id="outcomes-heading" className="text-xl font-semibold tracking-tight text-foreground">
                What you will learn
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.learningOutcomes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[0.95rem] text-foreground/90">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.requirements.length > 0 && (
            <section aria-labelledby="req-heading" className="space-y-3">
              <h2 id="req-heading" className="text-xl font-semibold tracking-tight text-foreground">
                Requirements
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[0.95rem] text-foreground/90 marker:text-primary-light">
                {c.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {c.prerequisites.length > 0 && (
            <section aria-labelledby="prereq-heading" className="space-y-3">
              <h2 id="prereq-heading" className="text-xl font-semibold tracking-tight text-foreground">
                Prerequisite courses
              </h2>
              <p className="text-sm text-muted">Complete these courses first to unlock enrollment.</p>
              <ul className="space-y-2">
                {c.prerequisites.map((p) => (
                  <li key={p._id}>
                    <Link
                      to={`/courses/${p._id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
                    >
                      <CourseThumb src={p.thumbnail} className="size-12 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.title}</span>
                      {p.level && <Badge>{levelLabels[p.level] ?? p.level}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="curriculum-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="curriculum-heading" className="text-xl font-semibold tracking-tight text-foreground">
                Curriculum
              </h2>
              {lessons.data && lessons.data.length > 0 && (
                <p className="text-sm text-muted">
                  {lessons.data.length} lesson{lessons.data.length === 1 ? '' : 's'} · {formatDuration(totalSeconds)}
                </p>
              )}
            </div>

            {!canViewLessons ? (
              <Card className="flex items-center gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-tan/25 text-primary" aria-hidden="true">
                  <Lock className="size-5" />
                </span>
                <p className="text-sm text-muted">
                  The full lesson list is available once you are enrolled. Enroll to see every lesson and start learning.
                </p>
              </Card>
            ) : lessons.isPending ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : lessons.isError ? (
              <ErrorState message={getErrorMessage(lessons.error)} onRetry={() => void lessons.refetch()} />
            ) : lessons.data.length === 0 ? (
              <Card className="p-5 text-sm text-muted">No lessons have been published for this course yet.</Card>
            ) : (
              <LessonList courseId={c._id} lessons={lessons.data} completedIds={completedIds} lang={lang} />
            )}
          </section>
        </div>

        {/* Sticky enroll panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Enrollment">
          <Card>
            <CardContent className="space-y-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">{formatPrice(c.price)}</p>

              {isEnrolled && progress.data && (
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {progress.data.completedLessons} of {progress.data.totalLessons} lessons
                    </span>
                    <span className="font-semibold text-foreground">{progress.data.percentage}%</span>
                  </div>
                  <Progress value={progress.data.percentage} label="Your progress in this course" />
                </div>
              )}

              {isOwner ? (
                <p className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-sm text-muted">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> This is your course. You can preview every lesson below.
                </p>
              ) : null}

              {canViewLessons ? (
                continueHref ? (
                  <Link to={continueHref} className={buttonClasses({ size: 'lg', fullWidth: true })}>
                    <PlayCircle className="size-5" aria-hidden="true" />
                    {progress.data && progress.data.completedLessons > 0 ? 'Continue learning' : 'Start learning'}
                  </Link>
                ) : (
                  <Button size="lg" fullWidth disabled>
                    No lessons yet
                  </Button>
                )
              ) : awaitingPayment ? (
                <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="status">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Your enrollment is waiting for payment. Online payment is not available in the app yet.
                </p>
              ) : (
                <Button size="lg" fullWidth loading={enroll.isPending} onClick={() => void onEnroll()}>
                  {c.price > 0 ? `Enroll for ${formatPrice(c.price)}` : 'Enroll for free'}
                </Button>
              )}

              {enrollError && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{enrollError}</span>
                </div>
              )}

              <dl className="space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Level</dt>
                  <dd className="font-medium text-foreground">{levelLabels[c.level] ?? c.level}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Category</dt>
                  <dd className="font-medium text-foreground">{c.category}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Original language</dt>
                  <dd className="font-medium text-foreground">{languageName(c.language)}</dd>
                </div>
              </dl>

              {languages.length > 1 && (
                <div className="border-t border-border pt-5">
                  <Select
                    label="Course language"
                    value={lang ?? c.activeLanguage ?? c.language}
                    onChange={(e) =>
                      setParams(
                        (prev) => {
                          const next = new URLSearchParams(prev)
                          next.set('lang', e.target.value)
                          return next
                        },
                        { replace: true },
                      )
                    }
                  >
                    {languages.map((code) => (
                      <option key={code} value={code}>
                        {languageName(code)}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <Globe className="size-3.5" aria-hidden="true" /> Titles and descriptions switch where a translation exists.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
