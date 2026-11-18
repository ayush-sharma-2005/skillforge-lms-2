import { useId, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, MessageCircle, Pin, Reply, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/context/AuthContext'
import { api, ApiError, getErrorMessage } from '@/lib/api'
import { formatRelative, initials } from '@/lib/format'
import type { DiscussionListResponse, DiscussionPost, DiscussionThread } from '@/types'

const PAGE_SIZE = 10
// Same limits as server/src/modules/discussions/discussion.validation.ts
const POST_MIN = 2
const POST_MAX = 2000
const REASON_MIN = 3
const REASON_MAX = 300

interface ComposerProps {
  label: string
  placeholder: string
  submitLabel: string
  min: number
  max: number
  rows?: number
  autoFocus?: boolean
  onSubmit: (text: string) => Promise<void>
  onCancel?: () => void
}

/** Small textarea form with length validation and a server-error line. */
function Composer({ label, placeholder, submitLabel, min, max, rows = 3, autoFocus, onSubmit, onCancel }: ComposerProps) {
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < min) {
      setError(`Write at least ${min} characters.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setText('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2" noValidate>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(null)
        }}
        maxLength={max}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full resize-y rounded-xl border border-border-strong bg-surface px-4 py-3 text-[0.95rem] text-foreground placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/20"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={`${id}-error`} role={error ? 'alert' : undefined} className="min-h-5 text-sm text-danger">
          {error}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted" aria-hidden="true">
            {text.length}/{max}
          </span>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

interface PostProps {
  post: DiscussionPost
  isReply?: boolean
  onReply?: () => void
  replying?: boolean
  canModerate: boolean
  onDelete: (post: DiscussionPost) => Promise<void>
  onReport: (post: DiscussionPost, reason: string) => Promise<void>
}

function Post({ post, isReply = false, onReply, replying, canModerate, onDelete, onReport }: PostProps) {
  const { user } = useAuth()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const author = post.user
  const isOwn = Boolean(user && author && author._id === user.id)
  const isInstructor = post.isInstructorReply || author?.role === 'instructor'
  const canDelete = isOwn || canModerate

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(post)
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <article aria-label={`${isReply ? 'Reply' : 'Question'} by ${author?.name ?? 'a deleted user'}`} className="flex gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-on-primary"
        aria-hidden="true"
      >
        {author ? initials(author.name) : '?'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-foreground">{author?.name ?? 'Deleted user'}</span>
          {isInstructor && <Badge tone="brand">Instructor</Badge>}
          {author?.role === 'admin' && <Badge tone="neutral">Admin</Badge>}
          {post.isPinned && (
            <Badge tone="warning" className="gap-1">
              <Pin className="size-3" aria-hidden="true" /> Pinned
            </Badge>
          )}
          {post.status === 'flagged' && <Badge tone="danger">Under review</Badge>}
          {post.status === 'hidden' && <Badge tone="neutral">Hidden</Badge>}
          <span className="text-xs text-muted">{formatRelative(post.createdAt)}</span>
        </div>

        <p className="mt-1.5 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-foreground/90">{post.content}</p>

        <div className="-ml-2 mt-2 flex flex-wrap items-center gap-1 text-sm">
          {onReply && (
            <Button variant="ghost" size="sm" onClick={onReply} aria-expanded={replying}>
              <Reply className="size-4" aria-hidden="true" /> Reply
            </Button>
          )}
          {!isOwn && (
            <Button variant="ghost" size="sm" onClick={() => setReporting((v) => !v)} aria-expanded={reporting}>
              <Flag className="size-4" aria-hidden="true" /> Report
            </Button>
          )}
          {canDelete && !confirmingDelete && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" aria-hidden="true" /> Delete
            </Button>
          )}
          {confirmingDelete && (
            <span className="flex items-center gap-2" role="group" aria-label="Confirm delete">
              <span className="text-sm text-muted">{isReply ? 'Delete this reply?' : 'Delete this question and its replies?'}</span>
              <Button variant="danger" size="sm" loading={deleting} onClick={() => void confirmDelete()}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </span>
          )}
        </div>

        {reporting && (
          <div className="mt-2 rounded-xl border border-border bg-surface-muted p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Why are you reporting this?</p>
            <Composer
              label="Reason for reporting"
              placeholder="Briefly describe the problem"
              submitLabel="Send report"
              min={REASON_MIN}
              max={REASON_MAX}
              rows={2}
              autoFocus
              onCancel={() => setReporting(false)}
              onSubmit={async (reason) => {
                await onReport(post, reason)
                setReporting(false)
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

interface DiscussionProps {
  lessonId: string
  /** Course instructor or admin: may delete anyone's posts. */
  canModerate: boolean
}

export function Discussion({ lessonId, canModerate }: DiscussionProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const key = ['discussions', lessonId] as const
  const list = useQuery({
    queryKey: [...key, page],
    queryFn: ({ signal }) => api.get<DiscussionListResponse>(`/discussions/lessons/${lessonId}`, { page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const ask = useMutation({
    mutationFn: (content: string) => api.post(`/discussions/lessons/${lessonId}`, { content }),
    onSuccess: async () => {
      setPage(1)
      await refresh()
      toast.success('Question posted')
    },
  })

  const reply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.post(`/discussions/${id}/reply`, { content }),
    onSuccess: async () => {
      setReplyingTo(null)
      await refresh()
      toast.success('Reply posted')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/discussions/${id}`),
    onSuccess: async () => {
      await refresh()
      toast.success('Deleted')
    },
  })

  const report = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/discussions/${id}/report`, { reason }),
    onSuccess: () => toast.success('Thanks. An instructor will review this.'),
  })

  const handleDelete = async (post: DiscussionPost) => {
    try {
      await remove.mutateAsync(post._id)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleReport = async (post: DiscussionPost, reason: string) => {
    try {
      await report.mutateAsync({ id: post._id, reason })
    } catch (error) {
      // Reporting the same post twice is a 409; say so plainly rather than as a failure to type.
      if (error instanceof ApiError && error.status === 409) toast.info('You have already reported this post.')
      else throw error
    }
  }

  const postProps = { canModerate, onDelete: handleDelete, onReport: handleReport }

  return (
    <section aria-labelledby="discussion-heading" className="space-y-8">
      <div className="space-y-3">
        <h2 id="discussion-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Ask a question
        </h2>
        <Composer
          label="Your question"
          placeholder="What would you like to ask about this lesson?"
          submitLabel="Post question"
          min={POST_MIN}
          max={POST_MAX}
          onSubmit={async (content) => {
            await ask.mutateAsync(content)
          }}
        />
      </div>

      {list.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading discussion">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={getErrorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.discussions.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-7" />}
          title="No questions yet"
          description="Be the first to start the conversation. Your instructor and classmates can reply."
        />
      ) : (
        <>
          <ul className={`space-y-6 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            {list.data.discussions.map((thread: DiscussionThread) => (
              <li key={thread._id} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <Post
                  post={thread}
                  replying={replyingTo === thread._id}
                  onReply={() => setReplyingTo((current) => (current === thread._id ? null : thread._id))}
                  {...postProps}
                />

                {thread.replies.length > 0 && (
                  <ul className="mt-4 space-y-5 border-l-2 border-border pl-4 sm:ml-5" aria-label={`${thread.replyCount} replies`}>
                    {thread.replies.map((r) => (
                      <li key={r._id}>
                        <Post post={r} isReply {...postProps} />
                      </li>
                    ))}
                  </ul>
                )}

                {replyingTo === thread._id && (
                  <div className="mt-4 sm:ml-5">
                    <Composer
                      label={`Reply to ${thread.user?.name ?? 'this question'}`}
                      placeholder="Write your reply"
                      submitLabel="Post reply"
                      min={POST_MIN}
                      max={POST_MAX}
                      rows={2}
                      autoFocus
                      onCancel={() => setReplyingTo(null)}
                      onSubmit={async (content) => {
                        await reply.mutateAsync({ id: thread._id, content })
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  )
}
