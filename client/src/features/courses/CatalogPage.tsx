import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Compass, SearchX } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CourseThumb } from '@/components/ui/CourseThumb'
import { FilterBar, type FilterChip } from '@/components/ui/FilterBar'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { useDebouncedValue } from '@/hooks'
import { getErrorMessage } from '@/lib/api'
import { formatPrice, levelLabels } from '@/lib/format'
import type { Course, CourseLevel, CourseSort } from '@/types'
import { useCategories, useCourses, useMyEnrollments, type CatalogFilters } from './api'

const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced']
const SORTS: Array<{ value: CourseSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
]

function parseFilters(params: URLSearchParams): CatalogFilters {
  const level = params.get('level')
  const sort = params.get('sort')
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    search: params.get('q') ?? '',
    category: params.get('category') ?? '',
    level: LEVELS.includes(level as CourseLevel) ? (level as CourseLevel) : '',
    sort: SORTS.some((s) => s.value === sort) ? (sort as CourseSort) : 'newest',
  }
}

function CatalogCard({ course, enrolled }: { course: Course; enrolled: boolean }) {
  return (
    <Link
      to={`/courses/${course._id}`}
      className="group block h-full rounded-2xl focus-visible:outline-offset-4"
      aria-label={`${course.title}${enrolled ? ' (enrolled)' : ''}`}
    >
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-float">
        <div className="relative">
          <CourseThumb src={course.thumbnail} className="h-40 w-full" />
          {enrolled && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-success shadow-soft">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Enrolled
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{course.category}</Badge>
            <Badge>{levelLabels[course.level] ?? course.level}</Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-foreground">{course.title}</h3>
          <p className="line-clamp-2 text-sm text-muted">{course.shortDescription}</p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="truncate text-sm text-muted">{course.instructor?.name ?? 'Instructor'}</span>
            <span className="text-base font-bold text-foreground">{formatPrice(course.price)}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function GridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading courses">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-80 rounded-2xl" />
      ))}
    </div>
  )
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  // The text box updates instantly; the URL (and the request) follow after a short pause.
  const [searchText, setSearchText] = useState(filters.search)
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350)

  const update = (changes: Partial<Record<'q' | 'category' | 'level' | 'sort' | 'page', string>>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        // Any filter change goes back to page 1.
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch !== filters.search) update({ q: debouncedSearch })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const courses = useCourses(filters)
  const categories = useCategories()
  const enrollments = useMyEnrollments()

  const enrolledIds = useMemo(
    () => new Set((enrollments.data ?? []).flatMap((e) => (e.course ? [e.course._id] : []))),
    [enrollments.data],
  )

  const chips: FilterChip[] = [
    ...(filters.search
      ? [{ key: 'q', label: `Search: “${filters.search}”`, onRemove: () => { setSearchText(''); update({ q: '' }) } }]
      : []),
    ...(filters.category ? [{ key: 'category', label: `Category: ${filters.category}`, onRemove: () => update({ category: '' }) }] : []),
    ...(filters.level ? [{ key: 'level', label: `Level: ${levelLabels[filters.level]}`, onRemove: () => update({ level: '' }) }] : []),
    ...(filters.sort !== 'newest'
      ? [{ key: 'sort', label: `Sort: ${SORTS.find((o) => o.value === filters.sort)?.label ?? filters.sort}`, onRemove: () => update({ sort: '' }) }]
      : []),
  ]
  const hasFilters = chips.length > 0
  const total = courses.data?.pagination.total

  const clearAll = () => {
    setSearchText('')
    setParams({}, { replace: true })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Course catalog</h1>
        <p className="mt-1 text-muted">Find your next skill. Search, filter and enroll in a few clicks.</p>
      </div>

      <FilterBar chips={chips} onClear={clearAll}>
        <SearchInput
          id="catalog-search"
          value={searchText}
          onChange={setSearchText}
          placeholder="Search by title or topic"
          className="sm:col-span-2 lg:col-span-1"
        />

        <Select label="Category" active={Boolean(filters.category)} value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {/* Keep a deep-linked category selectable even before the list loads */}
          {filters.category && !(categories.data ?? []).includes(filters.category) && (
            <option value={filters.category}>{filters.category}</option>
          )}
        </Select>

        <Select label="Level" active={Boolean(filters.level)} value={filters.level} onChange={(e) => update({ level: e.target.value })}>
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {levelLabels[l]}
            </option>
          ))}
        </Select>

        <Select
          label="Sort by"
          active={filters.sort !== 'newest'}
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </FilterBar>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {courses.isPending ? 'Loading courses…' : total !== undefined ? `${total} course${total === 1 ? '' : 's'} found` : ''}
        </p>
      </div>

      {courses.isPending ? (
        <GridSkeleton />
      ) : courses.isError ? (
        <ErrorState message={getErrorMessage(courses.error)} onRetry={() => void courses.refetch()} />
      ) : courses.data.courses.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<SearchX className="size-7" />}
            title="No courses match your filters"
            description="Try a different search word, or remove a filter to see more courses."
            action={<Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
          />
        ) : (
          <EmptyState icon={<Compass className="size-7" />} title="No courses published yet" description="Check back soon. New courses will appear here as soon as instructors publish them." />
        )
      ) : (
        <>
          <div
            className={`grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${courses.isPlaceholderData ? 'opacity-60' : ''}`}
            aria-busy={courses.isPlaceholderData}
          >
            {courses.data.courses.map((course) => (
              <CatalogCard key={course._id} course={course} enrolled={enrolledIds.has(course._id)} />
            ))}
          </div>
          <Pagination
            page={courses.data.pagination.page}
            totalPages={courses.data.pagination.totalPages}
            onChange={(page) => {
              update({ page: page > 1 ? String(page) : '' })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </div>
  )
}
