import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  /** Renders a show/hide toggle for password inputs. */
  revealable?: boolean
  icon?: ReactNode
}

/** Labelled text input with inline error, used by every form. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, revealable = false, icon, className, id, type = 'text', ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const [revealed, setRevealed] = useState(false)
  const effectiveType = revealable && revealed ? 'text' : type

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            'h-14 w-full rounded-xl border bg-surface px-4 text-[0.95rem] text-foreground transition-colors',
            'placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/20',
            error ? 'border-danger' : 'border-border-strong',
            icon && 'pl-12',
            revealable && 'pr-12',
            className,
          )}
          {...props}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-3 my-auto flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {revealed ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={messageId} role={error ? 'alert' : undefined} className={cn('mt-1.5 text-sm', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})
