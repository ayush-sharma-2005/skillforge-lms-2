import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { filterActiveClass, filterControlClass, filterLabelClass } from './filterStyles'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  /** Hide the visible label but keep it for screen readers. */
  hideLabel?: boolean
  /** Highlights the control when a non-default option is chosen. */
  active?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel = false, active = false, className, id, children, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="w-full">
      <label htmlFor={selectId} className={cn(filterLabelClass, hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(filterControlClass, 'cursor-pointer appearance-none pl-4 pr-10', active && filterActiveClass, className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn('pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2', active ? 'text-primary' : 'text-muted')}
          aria-hidden="true"
        />
      </div>
    </div>
  )
})
