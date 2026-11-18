import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-4" aria-hidden="true" /> Previous
      </Button>
      <span className="text-sm text-muted" aria-current="page">
        Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
      </span>
      <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        Next <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  )
}
