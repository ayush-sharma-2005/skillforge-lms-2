import { Link } from 'react-router-dom'
import { Badge, Progress } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { levelLabels } from '@/lib/format'
import type { EnrolledCourse } from '@/types'

/** Enrolled-course card with progress. The whole card opens the course. */
export function CourseTile({ course }: { course: EnrolledCourse }) {
  return (
    <Link to={`/courses/${course.courseId}`} className="group block h-full rounded-2xl focus-visible:outline-offset-4" aria-label={`${course.title}, ${course.progress.percentage}% complete`}>
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-float">
        <CourseThumb src={course.thumbnail} className="h-32 w-full" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{course.category}</Badge>
            <Badge>{levelLabels[course.level] ?? course.level}</Badge>
          </div>
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{course.title}</h3>
          <div className="mt-auto">
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>
                {course.progress.completedLessons}/{course.progress.totalLessons} lessons
              </span>
              <span className="font-semibold text-foreground">{course.progress.percentage}%</span>
            </div>
            <Progress value={course.progress.percentage} label={`${course.title} progress`} />
          </div>
        </div>
      </Card>
    </Link>
  )
}
