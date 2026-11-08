import { SearchX, TriangleAlert, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export type StateKind = 'empty' | 'error' | 'offline'

const icons: Record<StateKind, ReactNode> = {
  empty: <SearchX size={24} aria-hidden="true" />,
  error: <TriangleAlert size={24} aria-hidden="true" />,
  offline: <WifiOff size={24} aria-hidden="true" />,
}

const tones: Record<StateKind, string> = {
  empty: 'bg-primary-soft text-primary',
  error: 'bg-danger-bg text-danger',
  offline: 'bg-fit-mixed-bg text-fit-mixed-fg',
}

export interface StateMessageProps {
  kind: StateKind
  title: string
  children?: ReactNode
  /** Usually a Button: every dead end should offer a next step. */
  action?: ReactNode
  className?: string
  /** Heading level: 1 when this state IS the whole page (error, not found), 2 inside a page that already has an h1. */
  level?: 1 | 2
}

/** Empty, error and offline states: icon + plain words + a next step. */
export function StateMessage({ kind, title, children, action, className, level = 2 }: StateMessageProps) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx('mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-10 text-center', className)}
    >
      <span className={cx('flex size-14 items-center justify-center rounded-pill', tones[kind])}>{icons[kind]}</span>
      <Heading className="text-title">{title}</Heading>
      {children && <p className="text-text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
