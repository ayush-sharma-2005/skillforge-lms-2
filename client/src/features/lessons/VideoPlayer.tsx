import { useState } from 'react'
import { Headphones, VideoOff } from 'lucide-react'
import type { Lesson } from '@/types'
import { isHttpUrl, toEmbedUrl } from './video'

interface VideoPlayerProps {
  lesson: Lesson
  onActivity: () => void
}

export function VideoPlayer({ lesson, onActivity }: VideoPlayerProps) {
  // Caption tracks need CORS. If the video host does not allow it, retry once without captions.
  const [withoutCaptions, setWithoutCaptions] = useState(false)
  const { videoUrl, captions } = lesson
  const embed = videoUrl ? toEmbedUrl(videoUrl) : null
  const useCaptions = captions.length > 0 && !withoutCaptions

  let player
  if (embed) {
    player = (
      <iframe
        title={`Video: ${lesson.title}`}
        src={embed}
        className="size-full"
        allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    )
  } else if (videoUrl && isHttpUrl(videoUrl)) {
    player = (
      <video
        // Remount when we drop captions so the browser re-requests the file.
        key={useCaptions ? 'with-captions' : 'plain'}
        src={videoUrl}
        controls
        preload="metadata"
        playsInline
        crossOrigin={useCaptions ? 'anonymous' : undefined}
        onPlay={onActivity}
        onTimeUpdate={onActivity}
        onError={() => {
          if (captions.length > 0 && !withoutCaptions) setWithoutCaptions(true)
        }}
        className="size-full bg-black"
      >
        {useCaptions &&
          captions.map((track) => (
            <track key={`${track.language}-${track.url}`} kind="captions" src={track.url} srcLang={track.language} label={track.label} default={track.isDefault} />
          ))}
        Your browser cannot play this video.
      </video>
    )
  } else {
    player = (
      <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface-muted p-6 text-center text-muted">
        <VideoOff className="size-10" aria-hidden="true" />
        <p className="text-sm">This lesson has no video. Read the overview and transcript below.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-soft">{player}</div>
      {lesson.audioDescriptionUrl && isHttpUrl(lesson.audioDescriptionUrl) && (
        <a
          href={lesson.audioDescriptionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <Headphones className="size-4" aria-hidden="true" /> Audio-described version
        </a>
      )}
    </div>
  )
}
