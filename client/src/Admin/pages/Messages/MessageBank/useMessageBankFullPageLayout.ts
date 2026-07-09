import { useEffect, useState } from 'react'
import { useMediaQuery } from '../Inbox/useMediaQuery'

function readIosStandalone(): boolean {
  if (typeof navigator === 'undefined') return false
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

/** Full-page template use UI on mobile breakpoints and installed PWA (standalone). */
export function useMessageBankFullPageLayout(): boolean {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isStandalonePwa = useMediaQuery(
    '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)',
  )
  const [iosStandalone, setIosStandalone] = useState(readIosStandalone)

  useEffect(() => {
    setIosStandalone(readIosStandalone())
  }, [])

  return !isDesktop || isStandalonePwa || iosStandalone
}
