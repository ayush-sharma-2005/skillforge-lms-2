import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-on-primary font-semibold shadow-soft hover:-translate-y-0.5 hover:shadow-float active:translate-y-0',
  secondary:
    'border border-border-strong bg-surface text-foreground font-medium hover:bg-surface-muted',
  ghost: 'text-foreground font-medium hover:bg-surface-muted',
  danger: 'bg-danger text-white font-semibold hover:opacity-90',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-[0.95rem] rounded-xl',
  lg: 'h-14 px-6 text-base rounded-xl',
}

const base =
  'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'

interface ButtonClassOptions {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  className?: string
}

/** Button look for non-button elements, e.g. a router <Link> that should look like a button. */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false, className }: ButtonClassOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)
}
