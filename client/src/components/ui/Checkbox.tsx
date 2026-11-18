import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-center gap-3 text-[0.95rem] text-foreground', className)}>
      <span className="relative flex size-5 items-center justify-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-md border border-border-strong bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:ring-4 focus-visible:ring-ring/25"
          {...props}
        />
        <Check
          className="pointer-events-none absolute size-3.5 text-on-primary opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      {label}
    </label>
  )
})
