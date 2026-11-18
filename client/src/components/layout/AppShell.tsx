import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Feedback'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { initials, roleLabels } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'sf-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        /* storage unavailable */
      }
      return !value
    })
  }, [])

  // Drawer: Esc closes, focus moves in, then returns to the menu button.
  useEffect(() => {
    if (!drawerOpen) return
    const trigger = menuButtonRef.current
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      trigger?.focus()
    }
  }, [drawerOpen])

  if (!user) return null

  const onLogout = async () => {
    try {
      await logout()
      toast.success('Signed out')
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-surface px-4 py-2 font-semibold text-foreground shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <div className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block', collapsed ? 'w-[76px]' : 'w-64')}>
        <Sidebar role={user.role} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-float">
            <Sidebar role={user.role} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className="flex-1" />

          <ThemeToggle />

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface py-1.5 pl-1.5 pr-3">
            <span
              className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-on-primary"
              aria-hidden="true"
            >
              {initials(user.name)}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-40 truncate text-sm font-semibold leading-tight text-foreground">{user.name}</span>
              <Badge tone="brand" className="mt-0.5 px-1.5 py-0 text-[0.65rem]">
                {roleLabels[user.role] ?? user.role}
              </Badge>
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted"
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-8 focus:outline-none sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
