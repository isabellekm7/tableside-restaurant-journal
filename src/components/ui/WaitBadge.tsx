import { Timer } from 'lucide-react'
import { cx } from '../../lib/cx'
import type { FitLevel } from '../../lib/fit'
import type { WaitEstimate, WaitLevel } from '../../data'
import { fitBadgeClass } from './fitStyles'

const WORDS: Record<WaitLevel, string> = { short: 'Short wait', moderate: 'Moderate wait', long: 'Long wait' }
// Reuse the fit palette so "good / so-so / bad" reads the same everywhere.
const TONE: Record<WaitLevel, FitLevel> = { short: 'great', moderate: 'mixed', long: 'poor' }

/** Estimated wait, in words and minutes, honestly labelled when it isn't live data. */
export function WaitBadge({ estimate, className }: { estimate: WaitEstimate; className?: string }) {
  const simulated = estimate.source === 'simulated'
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold whitespace-nowrap', fitBadgeClass[TONE[estimate.level]], className)}
      title={simulated ? 'Simulated: this prototype estimates waits; it does not use live data.' : 'Live wait estimate'}
    >
      <Timer size={14} aria-hidden="true" />
      <span>
        {WORDS[estimate.level]} · {estimate.minutes === 0 ? 'no wait' : `~${estimate.minutes} min`}
      </span>
      {simulated && <span className="font-medium opacity-80">(simulated)</span>}
    </span>
  )
}
