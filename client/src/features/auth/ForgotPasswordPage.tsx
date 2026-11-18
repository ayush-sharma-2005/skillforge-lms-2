import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { api, getErrorMessage } from '@/lib/api'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address')),
})
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await api.post('/auth/forgot-password', values)
      setSent(true)
    } catch (error) {
      setBanner(getErrorMessage(error))
    }
  })

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we will send reset instructions"
      footer={
        <Link to="/login" className="inline-flex items-center gap-2 font-bold text-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Sign In
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
          <p className="text-foreground">If an account exists for that email, reset instructions are on their way.</p>
          <Link to="/reset-password" className="inline-block font-semibold text-primary underline-offset-4 hover:underline">
            I already have a reset token
          </Link>
        </div>
      ) : (
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
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Send reset instructions
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
