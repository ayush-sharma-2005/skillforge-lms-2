import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { NotFoundPage } from '@/features/home/NotFoundPage'
import { RoleHome } from '@/features/home/RoleHome'
import { Skeleton } from '@/components/ui/Feedback'
import { ProtectedRoute, SessionGate } from '@/routes/ProtectedRoute'

// Pages load on demand so the login screen stays light.
const CatalogPage = lazy(() => import('@/features/courses/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const CourseDetailPage = lazy(() => import('@/features/courses/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })))
const LessonPage = lazy(() => import('@/features/lessons/LessonPage').then((m) => ({ default: m.LessonPage })))
const MyCoursesPage = lazy(() => import('@/features/student/MyCoursesPage').then((m) => ({ default: m.MyCoursesPage })))

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <SessionGate>
            <LoginPage />
          </SessionGate>
        }
      />
      <Route
        path="/register"
        element={
          <SessionGate>
            <RegisterPage />
          </SessionGate>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Signed in */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<RoleHome />} />
          <Route
            path="/my-courses"
            element={
              <Suspense fallback={<PageFallback />}>
                <MyCoursesPage />
              </Suspense>
            }
          />
          <Route
            path="/courses"
            element={
              <Suspense fallback={<PageFallback />}>
                <CatalogPage />
              </Suspense>
            }
          />
          <Route
            path="/courses/:courseId"
            element={
              <Suspense fallback={<PageFallback />}>
                <CourseDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/courses/:courseId/lessons/:lessonId"
            element={
              <Suspense fallback={<PageFallback />}>
                <LessonPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
