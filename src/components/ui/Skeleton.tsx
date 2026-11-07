import { cx } from '../../lib/cx'

/** Placeholder block. Decorative: put a labelled status region around groups of them. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'rounded-md bg-surface-sunken',
        'bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.65),transparent)] bg-size-[200%_100%]',
        'motion-safe:animate-shimmer',
        className,
      )}
    />
  )
}
