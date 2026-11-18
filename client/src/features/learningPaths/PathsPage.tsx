import { useEffect, useId, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { Badge, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { useDebouncedValue } from '@/hooks'
import { levelLabels } from '@/lib/format'
import type { LearningPath } from '@/types'
import { useLearningPaths } from './api'

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
const SORTS = [
  { value: '', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
]

function PathCard({ path }: { path: LearningPath }) {
  return (
    <Link
      to={`/learning-paths/${path._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow hover:shadow-float focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={path.title}
    >
      <CourseThumb src={path.thumbnail} className="h-44 w-full" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{path.category}</Badge>
          <Badge>{levelLabels[path.level] ?? path.level}</Badge>
        </div>
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-primary">{path.title}</h2>
        <p className="line-clamp-2 flex-1 text-sm text-muted">{path.description}</p>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4 shrink-0" aria-hidden="true" />
            {path.courses.length} course{path.courses.length === 1 ? '' : 's'}
          </span>
          <span className="truncate font-medium text-foreground">{path.instructor?.name}</span>
        </div>
      </div>
    </Link>
  )
}

function PathSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Skeleton className="h-44 rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export function PathsPage() {
  const searchId = useId()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const level = params.get('level') ?? ''
  const sort = params.get('sort') ?? ''
  const page = Number(params.get('page') ?? '1')
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQ = useDebouncedValue(q, 400)
  const { data, isPending, isError, error, refetch } = useLearningPaths({ search: debouncedQ, category, level, sort, page })

  // Reset to page 1 on filter change
  useEffect(() => {
    setParams((prev) => { const n = new URLSearchParams(prev); n.delete('page'); return n }, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, category, level, sort])

  const setParam = (key: string, value: string) =>
    setParams((prev) => { const n = new URLSearchParams(prev); if (value) { n.set(key, value) } else { n.delete(key) } return n }, { replace: true })

  const clearAll = () => {
    setParams({}, { replace: true })
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const hasFilters = Boolean(q || category || level || sort)
  const paths = data?.learningPaths ?? []
  const pagination = data?.pagination

  // Derive categories from results (use static fallback list)
  const CATEGORIES = ['Web Development', 'Computer Science', 'Design', 'Data Science', 'Business', 'Marketing']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Learning Paths</h1>
        <p className="mt-1 text-muted">Structured journeys — master a skill from start to finish.</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">Search learning paths</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              id={searchId}
              type="search"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search by title or topic"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted focus:outline focus:outline-2 focus:outline-primary"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setParam('q', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select label="Category" value={category} onChange={(e) => setParam('category', e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Level" value={level} onChange={(e) => setParam('level', e.target.value)}>
            <option value="">All levels</option>
            {LEVELS.map((l) => <option key={l} value={l}>{levelLabels[l]}</option>)}
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>

      {/* Results */}
      {isError ? (
        <ErrorState message={String(error)} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <PathSkeleton key={i} />)}
        </div>
      ) : paths.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-tan/20 text-primary">
            <BookOpen className="size-8" aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold text-foreground">No learning paths match your filters</p>
          {hasFilters && <Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
        </div>
      ) : (
        <>
          <p role="status" className="text-sm text-muted">
            {pagination?.total ?? paths.length} learning path{(pagination?.total ?? paths.length) === 1 ? '' : 's'} found
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((lp) => <PathCard key={lp._id} path={lp} />)}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={(p) => setParam('page', String(p))}
            />
          )}
        </>
      )}
    </div>
  )
}
