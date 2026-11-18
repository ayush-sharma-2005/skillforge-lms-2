import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Lock, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime, formatDuration } from '@/lib/format'
import type { Lesson } from '@/types'
import { lessonHref } from './links'

interface LessonListProps {
  courseId: string
  lessons: Lesson[]
  completedIds: ReadonlySet<string>
  activeLessonId?: string
  lang?: string | null
  compact?: boolean
}

/** Ordered lesson list with completed / locked / current states. Locked lessons are not links. */
export function LessonList({ courseId, lessons, completedIds, activeLessonId, lang, compact = false }: LessonListProps) {
  return (
    <ol className={cn('divide-y divide-border', !compact && 'overflow-hidden rounded-2xl border border-border bg-surface')}>
      {lessons.map((lesson, index) => {
        const done = completedIds.has(lesson._id)
        const active = lesson._id === activeLessonId
        const Icon = lesson.isLocked ? Lock : done ? CheckCircle2 : active ? PlayCircle : Circle
        const status = lesson.isLocked ? 'locked' : done ? 'completed' : null

        const body = (
          <>
            <Icon
              className={cn('mt-0.5 size-5 shrink-0', lesson.isLocked ? 'text-muted' : done ? 'text-success' : active ? 'text-primary' : 'text-border-strong')}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[0.95rem] font-medium leading-snug', lesson.isLocked ? 'text-muted' : 'text-foreground', active && 'font-semibold')}>
                <span className="mr-1.5 text-muted">{index + 1}.</span>
                {lesson.title}
                {status && <span className="sr-only"> ({status})</span>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {lesson.isLocked && lesson.availableAt ? `Unlocks ${formatDateTime(lesson.availableAt)}` : formatDuration(lesson.duration)}
              </span>
            </span>
          </>
        )

        const rowClass = cn('flex items-start gap-3 px-4 py-3.5 transition-colors', active && 'bg-tan/20')

        return (
          <li key={lesson._id}>
            {lesson.isLocked ? (
              <div className={cn(rowClass, 'cursor-not-allowed')} aria-disabled="true">
                {body}
              </div>
            ) : (
              <Link to={lessonHref(courseId, lesson._id, lang)} aria-current={active ? 'page' : undefined} className={cn(rowClass, 'hover:bg-surface-muted')}>
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ol>
  )
}
