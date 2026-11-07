import { Info, TriangleAlert, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export type NoticeTone = 'info' | 'warning' | 'offline'

const tones: Record<NoticeTone, string> = {
  info: 'bg-primary-soft text-fit-great-fg',
  warning: 'bg-fit-mixed-bg text-fit-mixed-fg',
  offline: 'bg-fit-mixed-bg text-fit-mixed-fg',
}

const icons: Record<NoticeTone, ReactNode> = {
  info: <Info size={18} aria-hidden="true" />,
  warning: <TriangleAlert size={18} aria-hidden="true" />,
  offline: <WifiOff size={18} aria-hidden="true" />,
}

/** An inline banner: short message with an icon and an optional action. */
export function Notice({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: NoticeTone
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div role="status" className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3 text-small', tones[tone], className)}>
      <span className="mt-0.5 shrink-0 self-start">{icons[tone]}</span>
      <p className="min-w-0 flex-1 font-medium">{children}</p>
      {action}
    </div>
  )
}
