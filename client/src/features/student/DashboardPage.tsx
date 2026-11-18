import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, CheckCircle2, Clock, Compass, Flame, PlayCircle } from 'lucide-react'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Badge, EmptyState, ErrorState, Progress, Skeleton } from '@/components/ui/Feedback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { CourseTile } from './CourseTile'
import { useAuth } from '@/context/AuthContext'
import { api, getErrorMessage } from '@/lib/api'
import { formatHours, formatRelative, greeting, levelLabels } from '@/lib/format'
import type { EnrolledCourse, StudentDashboard, StudentTimeAnalytics } from '@/types'

const CHART_DAYS = 14

function useDashboard() {
  return useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => api.get<StudentDashboard>('/students/dashboard'),
  })
}

function useStudyTime() {
  return useQuery({
    queryKey: ['student', 'study-time', CHART_DAYS],
    queryFn: () => api.get<StudentTimeAnalytics>('/learning-time/student/summary', { days: CHART_DAYS }),
  })
}

interface StatProps {
  label: string
  value: string | number
  icon: ReactNode
}

function Stat({ label, value, icon }: StatProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-xl bg-tan/25 text-primary" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
    </Card>
  )
}

function ContinueCard({ course }: { course: EnrolledCourse }) {
  const { progress } = course
  return (
    <Link to={`/courses/${course.courseId}`} className="group block rounded-2xl focus-visible:outline-offset-4" aria-label={`Continue ${course.title}`}>
    <Card className="overflow-hidden transition-shadow group-hover:shadow-float">
      <div className="flex flex-col sm:flex-row">
        <CourseThumb src={course.thumbnail} className="h-40 w-full sm:h-auto sm:w-56" />
        <div className="flex flex-1 flex-col justify-between gap-4 p-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{course.category}</Badge>
              <Badge>{levelLabels[course.level] ?? course.level}</Badge>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">{course.title}</h3>
            {course.shortDescription && <p className="mt-1 line-clamp-2 text-sm text-muted">{course.shortDescription}</p>}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {progress.completedLessons} of {progress.totalLessons} lessons
              </span>
              <span className="text-muted">Last studied {formatRelative(progress.lastAccessedAt)}</span>
            </div>
            <Progress value={progress.percentage} label={`${course.title} progress`} />
          </div>
        </div>
      </div>
    </Card>
    </Link>
  )
}

function StudyTimeCard() {
  const { data, isPending, isError, error, refetch } = useStudyTime()
  // Fixed once per mount so the chart window does not shift between renders.
  const [now] = useState(() => Date.now())

  // Fill every day in the window so quiet days show as zero instead of disappearing.
  // The server stores session dates as UTC YYYY-MM-DD strings.
  const points = useMemo(() => {
    const byDate = new Map((data?.dailyBreakdown ?? []).map((d) => [d.date, d.minutes]))
    return Array.from({ length: CHART_DAYS }, (_, index) => {
      const day = new Date(now)
      day.setUTCDate(day.getUTCDate() - (CHART_DAYS - 1 - index))
      const key = day.toISOString().slice(0, 10)
      return {
        key,
        label: day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        minutes: byDate.get(key) ?? 0,
      }
    })
  }, [data, now])

  const hasActivity = points.some((p) => p.minutes > 0)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Study time</CardTitle>
          <p className="mt-1 text-sm text-muted">Minutes learned per day, last {CHART_DAYS} days</p>
        </div>
        {data && (
          <div className="hidden text-right sm:block">
            <p className="text-2xl font-bold text-foreground">{formatHours(data.summary.past7DaysHours)}</p>
            <p className="text-xs text-muted">past 7 days</p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : !hasActivity ? (
          <EmptyState icon={<Clock className="size-7" />} title="No study time yet" description="Your daily learning minutes will show up here once you start a lesson." />
        ) : (
          <div className="h-64 w-full" role="img" aria-label={`Area chart of minutes studied per day over the last ${CHART_DAYS} days`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="sf-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: 'var(--border-strong)' }}
                  formatter={(value) => [`${Number(value)} min`, 'Studied']}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--foreground)',
                  }}
                />
                <Area type="monotone" dataKey="minutes" stroke="var(--primary)" strokeWidth={2.5} fill="url(#sf-area)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export function StudentDashboardPage() {
  const { user } = useAuth()
  const { data, isPending, isError, error, refetch } = useDashboard()
  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-muted">Here is where your learning stands today.</p>
      </div>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Enrolled courses" value={data.summary.totalEnrolledCourses} icon={<BookOpen className="size-5" />} />
            <Stat label="In progress" value={data.summary.inProgressCourses} icon={<Flame className="size-5" />} />
            <Stat label="Completed" value={data.summary.completedCourses} icon={<CheckCircle2 className="size-5" />} />
            <Card className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium text-muted">Overall progress</p>
                <p className="mt-3 text-sm text-muted">Average across all courses</p>
              </div>
              <ProgressRing value={data.summary.overallProgress} label="Overall progress" />
            </Card>
          </section>

          {data.courses.length === 0 ? (
            <EmptyState
              icon={<Compass className="size-7" />}
              title="You are not enrolled in any courses yet"
              description="Once you enroll in a course, your progress, recent lessons and study time will appear here."
              action={<Link to="/courses" className={buttonClasses()}>Browse the catalog</Link>}
            />
          ) : (
            <>
              <section aria-labelledby="continue-heading" className="space-y-4">
                <h2 id="continue-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
                  <PlayCircle className="size-5 text-primary" aria-hidden="true" /> Continue learning
                </h2>
                {data.recentLearning.length > 0 ? (
                  <div className="space-y-4">
                    {data.recentLearning.slice(0, 2).map((course) => (
                      <ContinueCard key={course.courseId} course={course} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Start any lesson and it will show up here so you can pick up where you left off.</p>
                )}
              </section>

              <StudyTimeCard />

              <section aria-labelledby="courses-heading" className="space-y-4">
                <h2 id="courses-heading" className="text-xl font-semibold tracking-tight text-foreground">
                  My courses
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {data.courses.map((course) => (
                    <CourseTile key={course.courseId} course={course} />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
