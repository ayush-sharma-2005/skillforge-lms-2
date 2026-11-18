// Shapes mirror the server responses (server/src/modules/*).

export type UserRole = 'student' | 'instructor' | 'admin' | 'org_admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isEmailVerified?: boolean
  createdAt?: string
}

export interface AuthResponse {
  user: User
}

/** GET /api/students/dashboard and /api/students/my-courses */
export interface CourseProgress {
  completedLessons: number
  totalLessons: number
  percentage: number
  lastAccessedAt: string | null
}

export interface EnrolledCourse {
  courseId: string
  title: string
  shortDescription?: string
  description: string
  thumbnail?: string
  price: number
  category: string
  level: string
  enrolledAt: string | null
  progress: CourseProgress
}

export interface DashboardSummary {
  totalEnrolledCourses: number
  completedCourses: number
  inProgressCourses: number
  overallProgress: number
}

export interface StudentDashboard {
  summary: DashboardSummary
  courses: EnrolledCourse[]
  recentLearning: EnrolledCourse[]
}

/** GET /api/learning-time/student/summary */
export interface TimeSummary {
  totalAllTimeSeconds: number
  totalAllTimeHours: number
  past7DaysHours: number
  past30DaysHours: number
  dailyAverageMinutes: number
}

export interface DailyTime {
  date: string
  seconds: number
  minutes: number
  hours: number
}

export interface CourseTime {
  courseId: string
  title?: string
  thumbnail?: string
  totalSeconds: number
  totalHours: number
  activeDaysCount: number
  percentageShare: number
}

export interface StudentTimeAnalytics {
  summary: TimeSummary
  dailyBreakdown: DailyTime[]
  courseBreakdown: CourseTime[]
}

/* ---------------- Courses, lessons, progress, discussions (phase 2) ---------------- */

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface InstructorRef {
  _id: string
  name: string
}

export interface PrerequisiteRef {
  _id: string
  title: string
  level?: CourseLevel
  thumbnail?: string
  isPublished?: boolean
}

/** GET /api/courses and GET /api/courses/:id */
export interface Course {
  _id: string
  title: string
  description: string
  shortDescription: string
  thumbnail?: string
  price: number
  category: string
  level: CourseLevel
  language: string
  supportedLanguages: string[]
  instructor: InstructorRef
  requirements: string[]
  learningOutcomes: string[]
  prerequisites: PrerequisiteRef[]
  createdAt: string
  activeLanguage?: string
}

export interface CourseListResponse {
  courses: Course[]
  pagination: Pagination
}

export interface CourseResponse {
  course: Course
}

export type CourseSort = 'newest' | 'oldest' | 'price-low' | 'price-high'

/** GET /api/enrollments/my-enrollments (active only) */
export interface Enrollment {
  _id: string
  status: string
  paymentStatus?: string
  enrolledAt?: string
  course: { _id: string; title: string } | null
}

export interface EnrollResponse {
  enrollment: { _id: string; status: string; paymentStatus: string }
}

export interface LessonCaption {
  language: string
  label: string
  url: string
  isDefault?: boolean
}

/** GET /api/lessons/course/:courseId */
export interface Lesson {
  _id: string
  course: string
  title: string
  description: string
  videoUrl: string | null
  duration: number
  order: number
  transcript: string | null
  audioDescriptionUrl: string | null
  captions: LessonCaption[]
  isLocked: boolean
  availableAt: string | null
  activeLanguage?: string
}

export interface LessonListResponse {
  lessons: Lesson[]
  requestedLanguage: string
}

/** GET /api/progress/:courseId */
export interface CourseProgressDetail {
  courseId: string
  completedLessons: number
  totalLessons: number
  percentage: number
  completedLessonIds: string[]
  lastAccessedAt: string | null
}

export interface CompleteLessonResponse {
  courseId: string
  lessonId: string
  completedLessons: number
  totalLessons: number
  percentage: number
}

export interface DiscussionUser {
  _id: string
  name: string
  role: UserRole
}

export interface DiscussionPost {
  _id: string
  user: DiscussionUser | null
  content: string
  isPinned: boolean
  isInstructorReply: boolean
  status: 'active' | 'flagged' | 'hidden'
  createdAt: string
}

export interface DiscussionThread extends DiscussionPost {
  replyCount: number
  replies: DiscussionPost[]
}

export interface DiscussionListResponse {
  lessonId: string
  discussions: DiscussionThread[]
  pagination: Pagination
}
