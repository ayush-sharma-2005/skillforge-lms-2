import type { ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card } from './Card'

export interface FilterChip {
  key: string
  label: string
  onRemove: () => void
}

interface FilterBarProps {
  /** SearchInput and Select controls. They are laid out in a responsive grid. */
  children: ReactNode
  /** One chip per active filter. Clicking a chip removes that filter. */
  chips?: FilterChip[]
  onClear?: () => void
  className?: string
}

/** Card that groups the filter controls, shows a count of active filters and a clear-all action. */
export function FilterBar({ children, chips = [], onClear, className }: FilterBarProps) {
  const activeCount = chips.length
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-semibold text-on-primary" aria-label={`${activeCount} active`}>
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" /> Clear all
          </button>
        )}
      </div>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1fr_1fr_1fr]"
      >
        {children}
      </form>

      {activeCount > 0 && (
        <ul className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter: ${chip.label}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-danger/60 hover:text-danger"
              >
                {chip.label}
                <X className="size-3.5 text-muted group-hover:text-danger" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
