import { useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

const PING_EVERY_MS = 30_000
// Server caps one ping at 120s so idle tabs cannot inflate study time; we are stricter.
const IDLE_AFTER_MS = 90_000
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const

/**
 * Reports study time while the lesson is open, visible and the student is active.
 * Embedded videos (YouTube/Vimeo) swallow input events, so for those pass
 * `assumeActive` and only tab visibility is checked.
 * Failures are silent: study-time tracking must never get in the way of learning.
 */
export function useLearningHeartbeat(courseId: string | undefined, lessonId: string | undefined, enabled: boolean, assumeActive = false) {
  const lastActive = useRef(0)

  const markActive = useCallback(() => {
    lastActive.current = Date.now()
  }, [])

  useEffect(() => {
    if (!enabled || !courseId || !lessonId) return
    lastActive.current = Date.now()

    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, markActive, { passive: true })

    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!assumeActive && Date.now() - lastActive.current > IDLE_AFTER_MS) return
      api.post('/learning-time/heartbeat', { courseId, lessonId, durationSeconds: PING_EVERY_MS / 1000 }).catch(() => undefined)
    }, PING_EVERY_MS)

    return () => {
      window.clearInterval(id)
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, markActive)
    }
  }, [courseId, lessonId, enabled, assumeActive, markActive])

  return markActive
}
