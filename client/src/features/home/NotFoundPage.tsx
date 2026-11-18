import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Logo } from '@/components/ui/Logo'

export function NotFoundPage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo />
      <p className="text-7xl font-extrabold tracking-tight text-primary-dark">404</p>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-1 text-muted">The page you are looking for does not exist or has moved.</p>
      </div>
      <Link to="/dashboard" className={buttonClasses({ size: 'lg' })}>
        Back to dashboard
      </Link>
    </main>
  )
}
