const ID = /^[\w-]{6,}$/

/** Turns a YouTube or Vimeo page URL into an embeddable one. Anything else returns null. */
export function toEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1)
      return ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') ?? ''
        return ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
      }
      const embed = /^\/embed\/([\w-]{6,})$/.exec(url.pathname)
      return embed ? `https://www.youtube-nocookie.com/embed/${embed[1]}` : null
    }
    if (host === 'vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
    if (host === 'player.vimeo.com' && /^\/video\/\d+$/.test(url.pathname)) return `https://player.vimeo.com${url.pathname}`
  } catch {
    /* not a valid URL */
  }
  return null
}

export function isHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function isEmbeddedVideo(videoUrl: string | null): boolean {
  return Boolean(videoUrl && toEmbedUrl(videoUrl))
}
