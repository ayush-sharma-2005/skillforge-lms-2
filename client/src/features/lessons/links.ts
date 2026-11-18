export function lessonHref(courseId: string, lessonId: string, lang?: string | null): string {
  return `/courses/${courseId}/lessons/${lessonId}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`
}
