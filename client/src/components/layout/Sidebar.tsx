import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { cn } from '@/lib/cn'
import type { UserRole } from '@/types'
import { navByRole } from './nav'

interface SidebarProps {
  role: UserRole
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Present only in the mobile drawer. */
  onClose?: () => void
}

export function Sidebar({ role, collapsed = false, onToggleCollapsed, onClose }: SidebarProps) {
  const items = navByRole[role]
  const isDrawer = Boolean(onClose)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-16 items-center border-b border-white/10 px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {collapsed ? <LogoMark /> : <Logo light />}
        {isDrawer && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-10 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-white/10"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ label, to, icon: Icon, soon }) => {
          const base = cn(
            'group flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors',
            collapsed && 'justify-center px-0',
          )

          if (soon) {
            return (
              <span
                key={to}
                aria-disabled="true"
                title={collapsed ? `${label} (coming soon)` : undefined}
                className={cn(base, 'cursor-not-allowed text-sidebar-muted/80')}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">Soon</span>
                  </>
                )}
                {collapsed && <span className="sr-only">{label} (coming soon)</span>}
              </span>
            )
          }

          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(base, isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-foreground hover:bg-white/10')
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {collapsed ? <span className="sr-only">{label}</span> : label}
            </NavLink>
          )
        })}
      </nav>

      {onToggleCollapsed && (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <ChevronsRight className="size-5" aria-hidden="true" /> : <ChevronsLeft className="size-5" aria-hidden="true" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </div>
  )
}
