import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CompleteLessonResponse,
  CourseListResponse,
  CourseLevel,
  CourseProgressDetail,
  CourseResponse,
  CourseSort,
  EnrollResponse,
  Enrollment,
  LessonListResponse,
} from '@/types'

export interface CatalogFilters {
  page: number
  search: string
  category: string
  level: CourseLevel | ''
  sort: CourseSort
}

export const PAGE_SIZE = 9

export function useCourses(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['courses', 'list', filters],
    queryFn: ({ signal }) =>
      api.get<CourseListResponse>(
        '/courses',
        {
          page: filters.page,
          limit: PAGE_SIZE,
          search: filters.search || undefined,
          category: filters.category || undefined,
          level: filters.level || undefined,
          sort: filters.sort,
        },
        signal,
      ),
    // Keep the old grid on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  })
}

/** The server has no categories endpoint, so derive them from the published courses. */
export function useCategories() {
  return useQuery({
    queryKey: ['courses', 'categories'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const data = await api.get<CourseListResponse>('/courses', { limit: 100 }, signal)
      return [...new Set(data.courses.map((c) => c.category))].sort((a, b) => a.localeCompare(b))
    },
  })
}

export function useCourse(courseId: string | undefined, lang?: string) {
  return useQuery({
    queryKey: ['courses', 'detail', courseId, lang ?? null],
    enabled: Boolean(courseId),
    queryFn: ({ signal }) => api.get<CourseResponse>(`/courses/${courseId}`, { lang }, signal).then((d) => d.course),
  })
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: ['enrollments', 'mine'],
    queryFn: () => api.get<{ enrollments: Enrollment[] }>('/enrollments/my-enrollments').then((d) => d.enrollments),
  })
}

export function useCourseLessons(courseId: string | undefined, enabled: boolean, lang?: string) {
  return useQuery({
    queryKey: ['lessons', courseId, lang ?? null],
    enabled: Boolean(courseId) && enabled,
    queryFn: ({ signal }) =>
      api.get<LessonListResponse>(`/lessons/course/${courseId}`, { lang }, signal).then((d) => d.lessons),
  })
}

export function useCourseProgress(courseId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['progress', courseId],
    enabled: Boolean(courseId) && enabled,
    queryFn: () => api.get<CourseProgressDetail>(`/progress/${courseId}`),
  })
}

export function useEnroll(courseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<EnrollResponse>(`/enrollments/${courseId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['student'] }),
        queryClient.invalidateQueries({ queryKey: ['lessons', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['progress', courseId] }),
      ])
    },
  })
}

export function useCompleteLesson(courseId: string, lessonId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<CompleteLessonResponse>(`/progress/${courseId}/lessons/${lessonId}/complete`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progress', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['student'] }),
      ])
    },
  })
}
