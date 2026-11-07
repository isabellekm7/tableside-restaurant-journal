import { cx } from '../../lib/cx'

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cx('shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--color-cream-50)" strokeWidth="2" />
      <circle cx="16" cy="16" r="3.5" fill="var(--color-cream-50)" />
    </svg>
  )
}

/** `collapseOnPhone` shows only the mark below the sm breakpoint (the name stays available to screen readers). */
export function Wordmark({ className, collapseOnPhone = false }: { className?: string; collapseOnPhone?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-display text-title font-semibold text-primary', className)}>
      <LogoMark />
      <span className={collapseOnPhone ? 'max-sm:sr-only' : undefined}>Tableside</span>
    </span>
  )
}
