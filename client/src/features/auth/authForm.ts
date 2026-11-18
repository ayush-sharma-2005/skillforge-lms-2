import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api'

/**
 * Copies server-side Zod errors onto the matching form fields.
 * Returns a banner message for anything that is not field specific.
 */
export function applyServerError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, knownFields: readonly string[]): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.'

  let handled = false
  for (const item of error.fieldErrors) {
    if (knownFields.includes(item.field)) {
      setError(item.field as Path<T>, { type: 'server', message: item.message })
      handled = true
    }
  }
  return handled ? null : error.message
}

export const LAST_EMAIL_KEY = 'sf-last-email'
