import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Course image, or a brand-gradient placeholder when the course has none. */
export function CourseThumb({ src, className }: { src?: string; className?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={cn('object-cover', className)} />
  ) : (
    <div className={cn('flex items-center justify-center bg-brand-gradient text-on-primary', className)} aria-hidden="true">
      <GraduationCap className="size-8" />
    </div>
  )
}
