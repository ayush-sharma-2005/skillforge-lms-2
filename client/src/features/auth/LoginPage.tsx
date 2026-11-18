import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { applyServerError, LAST_EMAIL_KEY } from './authForm'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function readSavedEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const [banner, setBanner] = useState<string | null>(null)

  const savedEmail = readSavedEmail()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: savedEmail, password: '', remember: savedEmail !== '' },
  })

  if (user) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await login({ email: values.email, password: values.password })
      try {
        if (values.remember) localStorage.setItem(LAST_EMAIL_KEY, values.email)
        else localStorage.removeItem(LAST_EMAIL_KEY)
      } catch {
        /* storage unavailable */
      }
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (error) {
      setBanner(applyServerError(error, setError, ['email', 'password']))
    }
  })

  const comingSoon = (provider: string) => () => toast.info(`${provider} sign-in is not set up yet. Use your email and password for now.`)

  return (
    <AuthLayout
      title="Welcome to SkillForge"
      subtitle="Sign in to access your learning journey"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-bold text-foreground underline-offset-4 hover:underline">
            Create a New Account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {banner && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{banner}</span>
          </div>
        )}

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          icon={<Mail className="size-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Field
          label="Password"
          type="password"
          revealable
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox label="Remember me" {...register('remember')} />
          <Link to="/forgot-password" className="text-[0.95rem] font-medium text-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4 text-sm text-muted" role="separator" aria-label="or continue with">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={comingSoon('Google')}>
          <GoogleIcon /> Google
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={comingSoon('GitHub')}>
          <GitHubIcon /> GitHub
        </Button>
      </div>
    </AuthLayout>
  )
}
