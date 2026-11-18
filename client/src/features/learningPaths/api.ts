import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api'
import type { LearningPath, LearningPathListResponse, LearningPathProgress, MyLearningPath } from '@/types'

const PAGE_SIZE = 9

// ── Queries ───────────────────────────────────────────────────────────────────

export function useLearningPaths(params: {
  search?: string
  category?: string
  level?: string
  sort?: string
  page?: number
}) {
  const { search, category, level, sort, page = 1 } = params
  return useQuery({
    queryKey: ['learning-paths', search, category, level, sort, page],
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) })
      if (search) q.set('search', search)
      if (category) q.set('category', category)
      if (level) q.set('level', level)
      if (sort) q.set('sort', sort)
      return request<LearningPathListResponse>(`/api/learning-paths?${q}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function useLearningPath(id: string | undefined) {
  return useQuery({
    queryKey: ['learning-path', id],
    queryFn: () => request<{ learningPath: LearningPath }>(`/api/learning-paths/${id!}`),
    enabled: Boolean(id),
  })
}

export function useMyLearningPaths() {
  return useQuery({
    queryKey: ['my-learning-paths'],
    queryFn: () => request<{ learningPaths: MyLearningPath[] }>('/api/learning-paths/student/my-paths'),
  })
}

export function usePathProgress(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['learning-path-progress', id],
    queryFn: () => request<LearningPathProgress>(`/api/learning-paths/${id!}/progress`),
    enabled: Boolean(id) && enabled,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useEnrollInPath(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      request<{ learningPathId: string; autoEnrolledCourses: string[] }>(`/api/learning-paths/${id}/enroll`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-learning-paths'] })
      void qc.invalidateQueries({ queryKey: ['learning-path-progress', id] })
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}
