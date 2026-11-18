import { Toaster } from 'sonner'
import { useTheme } from '@/context/ThemeContext'

export function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />
}
