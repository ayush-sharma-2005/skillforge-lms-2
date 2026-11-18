import { useId } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { filterActiveClass, filterControlClass, filterLabelClass } from './filterStyles'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  id?: string
  className?: string
}

export function SearchInput({ value, onChange, label = 'Search', placeholder = 'Search…', id, className }: SearchInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={inputId} className={filterLabelClass}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            filterControlClass,
            'pl-11 pr-10 placeholder:text-muted/70 [&::-webkit-search-cancel-button]:appearance-none',
            value && filterActiveClass,
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
