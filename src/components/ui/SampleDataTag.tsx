import { FlaskConical } from 'lucide-react'
import { cx } from '../../lib/cx'

/** Always visible so test participants know the restaurants are fictional. */
export function SampleDataTag({ className }: { className?: string }) {
  return (
    <span
      title="All restaurants in this prototype are fictional sample data."
      className={cx(
        'inline-flex items-center gap-1 rounded-pill border border-line-strong px-2.5 py-1',
        'text-caption font-medium whitespace-nowrap text-text-muted',
        className,
      )}
    >
      <FlaskConical size={12} aria-hidden="true" />
      Sample data
    </span>
  )
}
