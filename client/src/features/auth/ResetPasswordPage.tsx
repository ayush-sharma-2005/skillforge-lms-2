import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { api, getErrorMessage } from '@/lib/api'

const schema = z
  .object({
    token: z.string().trim().min(1, 'Paste your reset token'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: params.get('token') ?? '', newPassword: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ token, newPassword }) => {
    setBanner(null)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      toast.success('Password updated. Please sign in.')
      navigate('/login', { replace: true })
    } catch (error) {
      setBanner(getErrorMessage(error))
    }
  })

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Paste the reset token and choose a new password"
      footer={
        <Link to="/login" className="inline-flex items-center gap-2 font-bold text-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Sign In
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {banner && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{banner}</span>
          </div>
        )}
        <Field label="Reset token" autoComplete="off" placeholder="Paste your token" icon={<KeyRound className="size-5" />} error={errors.token?.message} {...register('token')} />
        <Field label="New password" type="password" revealable autoComplete="new-password" placeholder="At least 8 characters" error={errors.newPassword?.message} {...register('newPassword')} />
        <Field label="Confirm password" type="password" revealable autoComplete="new-password" placeholder="Repeat your password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
