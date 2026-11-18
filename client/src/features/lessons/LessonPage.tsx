import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card, CardContent } from '@/components/ui/Card'
import { ErrorState, Progress, Skeleton } from '@/components/ui/Feedback'
import { Select } from '@/components/ui/Select'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { useAuth } from '@/context/AuthContext'
import { useCompleteLesson, useCourse, useCourseLessons, useCourseProgress } from '@/features/courses/api'
import { getErrorMessage } from '@/lib/api'
import { formatDateTime, formatDuration, languageName } from '@/lib/format'
import { Discussion } from './Discussion'
import { LessonList } from './LessonList'
import { lessonHref } from './links'
import { useLearningHeartbeat } from './useHeartbeat'
import { VideoPlayer } from './VideoPlayer'
import { isEmbeddedVideo } from './video'

function LessonSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]" aria-busy="true" aria-label="Loading lesson">
      <div className="space-y-4">
        <Skeleton className="aspect-video rounded-2xl" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

export function LessonPage() {
  const { courseId, lessonId } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const lang = params.get('lang')

  const course = useCourse(courseId, lang ?? undefined)
  const lessons = useCourseLessons(courseId, true, lang ?? undefined)

  const isOwner = Boolean(user && course.data && course.data.instructor?._id === user.id)
  const isAdmin = user?.role === 'admin'
  // Owners and admins preview lessons; only learners have progress and study time.
  const isLearner = Boolean(course.data) && !isOwner && !isAdmin

  const progress = useCourseProgress(courseId, isLearner)
  const complete = useCompleteLesson(courseId ?? '', lessonId ?? '')

  const completedIds = useMemo(() => new Set(progress.data?.completedLessonIds ?? []), [progress.data])
  const list = lessons.data ?? []
  const index = list.findIndex((l) => l._id === lessonId)
  const lesson = index >= 0 ? list[index] : undefined
  const prev = index > 0 ? list[index - 1] : undefined
  const next = index >= 0 ? list[index + 1] : undefined

  const embedded = isEmbeddedVideo(lesson?.videoUrl ?? null)
  const markActive = useLearningHeartbeat(courseId, lessonId, isLearner && Boolean(lesson) && !lesson?.isLocked, embedded)

  if (course.isPending || lessons.isPending) return <LessonSkeleton />

  if (course.isError || lessons.isError) {
    const error = course.error ?? lessons.error
    return (
      <div className="space-y-6">
        <Link to={courseId ? `/courses/${courseId}` : '/courses'} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
        </Link>
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void course.refetch()
            void lessons.refetch()
          }}
        />
      </div>
    )
  }

  if (!lesson || !courseId) {
    return (
      <div className="space-y-6">
        <Link to={`/courses/${courseId ?? ''}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
        </Link>
        <ErrorState message="This lesson does not exist or is not published." />
      </div>
    )
  }

  const c = course.data
  const done = completedIds.has(lesson._id)
  const languages = c.supportedLanguages?.length ? c.supportedLanguages : [c.language]

  const onComplete = async () => {
    try {
      const result = await complete.mutateAsync()
      toast.success(result.percentage === 100 ? 'Course complete. Great work!' : 'Lesson marked as complete')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: <p className="whitespace-pre-line leading-relaxed text-foreground/90">{lesson.description}</p>,
    },
    ...(lesson.transcript
      ? [
          {
            id: 'transcript',
            label: 'Transcript',
            content: <p className="whitespace-pre-line leading-relaxed text-foreground/90">{lesson.transcript}</p>,
          },
        ]
      : []),
    {
      id: 'discussion',
      label: 'Discussion',
      content: <Discussion lessonId={lesson._id} canModerate={isOwner || isAdmin} />,
    },
  ]

  const navButton = (target: typeof next, direction: 'prev' | 'next') => {
    const label = direction === 'prev' ? 'Previous lesson' : 'Next lesson'
    if (!target) return null
    if (target.isLocked) {
      return (
        <Button variant="secondary" disabled title={target.availableAt ? `Unlocks ${formatDateTime(target.availableAt)}` : 'Locked'}>
          {direction === 'prev' && <ArrowLeft className="size-4" aria-hidden="true" />}
          {label} (locked)
          {direction === 'next' && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      )
    }
    return (
      <Link to={lessonHref(courseId, target._id, lang)} className={buttonClasses({ variant: direction === 'next' && done ? 'primary' : 'secondary' })}>
        {direction === 'prev' && <ArrowLeft className="size-4" aria-hidden="true" />}
        {label}
        {direction === 'next' && <ArrowRight className="size-4" aria-hidden="true" />}
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <Link to={`/courses/${courseId}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`} className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{c.title}</span>
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {lesson.isLocked ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-tan/25 text-primary" aria-hidden="true">
                  <Lock className="size-7" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{lesson.title}</h1>
                <p className="max-w-md text-muted">
                  {lesson.availableAt ? `This lesson unlocks on ${formatDateTime(lesson.availableAt)}.` : 'This lesson is not available yet.'} Come back then, or keep going with the lessons that are open.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <VideoPlayer key={`${lesson._id}-video`} lesson={lesson} onActivity={markActive} />

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    Lesson {index + 1} of {list.length} · {formatDuration(lesson.duration)}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{lesson.title}</h1>
                </div>

                {isLearner &&
                  (done ? (
                    <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-success/15 px-4 font-semibold text-success" role="status">
                      <CheckCircle2 className="size-5" aria-hidden="true" /> Completed
                    </span>
                  ) : (
                    <Button loading={complete.isPending} onClick={() => void onComplete()}>
                      <CheckCircle2 className="size-5" aria-hidden="true" /> Mark as complete
                    </Button>
                  ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {navButton(prev, 'prev') ?? <span />}
                {navButton(next, 'next')}
              </div>

              <Tabs key={`${lesson._id}-tabs`} label="Lesson sections" items={tabs} />
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Course content">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="font-semibold text-foreground">Course content</h2>
              {isLearner && progress.data && (
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted">
                      {progress.data.completedLessons} of {progress.data.totalLessons} complete
                    </span>
                    <span className="font-semibold text-foreground">{progress.data.percentage}%</span>
                  </div>
                  <Progress value={progress.data.percentage} label="Course progress" />
                </div>
              )}
              {languages.length > 1 && (
                <Select
                  label="Language"
                  value={lang ?? lesson.activeLanguage ?? c.language}
                  onChange={(e) =>
                    setParams(
                      (prev) => {
                        const nextParams = new URLSearchParams(prev)
                        nextParams.set('lang', e.target.value)
                        return nextParams
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
              )}
            </CardContent>
            <div className="max-h-[60vh] overflow-y-auto border-t border-border">
              <LessonList courseId={courseId} lessons={list} completedIds={completedIds} activeLessonId={lesson._id} lang={lang} compact />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
