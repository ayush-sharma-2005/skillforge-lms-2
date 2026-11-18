import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} aria-hidden="true">
      <defs>
        <linearGradient id="sf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7A5C45" />
          <stop offset="1" stopColor="#D4B08C" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#sf-logo)" />
      <path
        d="M20 40c0 4 4 7 12 7s12-3 12-8c0-11-24-6-24-16 0-5 5-8 12-8s11 3 11 7"
        fill="none"
        stroke="#FDF8EE"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-xl font-bold tracking-tight', light ? 'text-[#FDF8EE]' : 'text-foreground')}>SkillForge</span>
    </span>
  )
}
