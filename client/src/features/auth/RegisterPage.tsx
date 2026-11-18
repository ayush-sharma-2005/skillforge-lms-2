import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Mail, User } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { applyServerError } from './authForm'

// Same limits as server/src/modules/auth/auth.validation.ts
const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
    email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const { user, register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [banner, setBanner] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  })

  if (user) return <Navigate to="/dashboard" replace />

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setBanner(null)
    try {
      await registerUser({ name, email, password })
      toast.success('Account created. Welcome to SkillForge!')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setBanner(applyServerError(error, setError, ['name', 'email', 'password']))
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your SkillForge learning journey"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-foreground underline-offset-4 hover:underline">
            Sign In
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

        <Field label="Full name" autoComplete="name" placeholder="Your name" icon={<User className="size-5" />} error={errors.name?.message} {...register('name')} />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />
        <Field
          label="Confirm password"
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
