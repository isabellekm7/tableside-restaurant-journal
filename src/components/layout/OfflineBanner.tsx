import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../lib/hooks'

/**
 * One calm, global notice when the connection drops. The app keeps working offline
 * (saved lists, the sample restaurants, feedback saved on the device), so it says what
 * still works as well as what doesn't.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <p role="status" className="flex items-start justify-center gap-2 bg-fit-mixed-bg px-4 py-2 text-center text-small font-medium text-fit-mixed-fg print:hidden">
      <WifiOff size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>You’re offline. Your saved lists and the sample restaurants still work; the map and signing in need a connection.</span>
    </p>
  )
}
