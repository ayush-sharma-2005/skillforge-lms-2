import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NetworkIllustration } from './NetworkIllustration'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/** Split-screen auth shell: brown illustration panel on the left, cream page + floating card on the right. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[55fr_45fr]">
      {/* Illustration panel (desktop only) */}
      <aside className="bg-auth-panel relative hidden overflow-hidden lg:block" aria-label="SkillForge introduction">
        <NetworkIllustration />
        {/* Soft fade so the tagline stays readable over the network lines */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#4E3B2E] via-[#4E3B2E]/80 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Link to="/" aria-label="SkillForge home" className="w-fit">
            <Logo light />
          </Link>
          <div className="max-w-md">
            <p className="text-3xl font-bold leading-tight tracking-tight text-[#FDF8EE] xl:text-4xl">
              Learn together. Build real skills. Get certified.
            </p>
            <p className="mt-3 text-base text-[#E8D5BD]">
              Learning paths, code reviews and live analytics, all in one calm workspace.
            </p>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <main id="main" className="relative flex flex-col">
        {/* Compact brand header on small screens */}
        <header className="bg-auth-panel flex items-center justify-between px-5 py-4 lg:hidden">
          <Link to="/" aria-label="SkillForge home">
            <Logo light />
          </Link>
        </header>

        <div className="absolute right-5 top-5 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[480px] rounded-3xl border border-border bg-surface p-7 shadow-float sm:p-10">
            <h1 className="text-3xl font-bold tracking-tight text-primary-dark sm:text-[2.1rem]">{title}</h1>
            <p className="mt-2 text-base text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 text-center text-[0.95rem] text-muted">{footer}</div>}
          </div>
        </div>

        <div className="flex justify-center pb-6 lg:hidden">
          <ThemeToggle />
        </div>
      </main>
    </div>
  )
}
