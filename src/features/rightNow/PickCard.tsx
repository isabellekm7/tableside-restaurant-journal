import { Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FitBadge } from '../../components/ui/FitBadge'
import { SampleDataTag } from '../../components/ui/SampleDataTag'
import { WaitBadge } from '../../components/ui/WaitBadge'
import { cx } from '../../lib/cx'
import { PRICE_LABELS } from '../../lib/discovery/filters'
import { FIT_LEVEL_LABEL } from '../../lib/fit'
import { formatTravel } from '../../lib/geo/format'
import type { RightNowPick, Shortfall } from '../../lib/rightNow/recommend'
import { formatClock } from '../../lib/time/localTime'
import { directionsUrl } from '../detail/directions'

const SHORTFALL_TEXT: Record<Shortfall, string> = {
  fit: 'Not a great fit for your kids',
  wait: 'The wait is longer than we’d like',
  travel: 'It’s a longer trip than we’d like',
  closingSoon: 'It closes soon',
}

export interface PickCardProps {
  pick: RightNowPick
  rank: number
  onChoose: () => void
  onDirections: () => void
}

/** One recommendation: the facts a hungry parent needs at a glance, and one tap to commit. */
export function PickCard({ pick, rank, onChoose, onDirections }: PickCardProps) {
  const { item, wait } = pick.candidate
  const { restaurant, fit } = item
  const titleId = `pick-${restaurant.id}`
  const best = rank === 0

  return (
    <Card as="article" aria-labelledby={titleId} className={cx(best && 'border-primary ring-2 ring-primary')}>
      {best && <p className="mb-2 text-small font-semibold tracking-wide text-primary uppercase">Best right now</p>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-title">
            <Link to={`/restaurant/${restaurant.id}`} className="rounded-sm">
              {restaurant.name}
            </Link>
          </h2>
          <p className="text-small text-text-muted">
            {restaurant.cuisine} · <span aria-hidden="true">{PRICE_LABELS[restaurant.priceLevel]}</span>
            <span className="sr-only">price level {restaurant.priceLevel} of 4</span> · {restaurant.neighborhood}
          </p>
        </div>
        <FitBadge size="sm" level={fit.level} score={fit.level === 'unknown' ? undefined : fit.score} label={FIT_LEVEL_LABEL[fit.level]} className="shrink-0" />
      </div>

      <p className="mt-3 text-small">{fit.summary}</p>

      <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Right-now details">
        {wait ? <li><WaitBadge estimate={wait} /></li> : <li className="text-small text-text-muted">Wait unknown</li>}
        <li className="inline-flex items-center gap-1 text-small font-semibold">{formatTravel(item.travel)}</li>
        <li className="inline-flex items-center gap-1 text-small text-text-muted">
          <Clock size={14} aria-hidden="true" />
          {item.closesAt ? `Open until ${formatClock(item.closesAt)}` : 'Open now'}
        </li>
      </ul>

      {pick.shortfalls.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-small font-medium text-fit-mixed-fg">
          {pick.shortfalls.map((s) => (
            <li key={s}>{SHORTFALL_TEXT[s]}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="lg" className="flex-1 px-4 text-body whitespace-nowrap" onClick={onChoose}>
          We’re going here
        </Button>
        <a
          href={directionsUrl(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDirections}
          className="inline-flex min-h-(--size-touch-lg) items-center justify-center gap-2 rounded-pill border-2 border-primary px-4 text-body font-semibold text-primary hover:bg-primary-soft"
        >
          <ExternalLink size={18} aria-hidden="true" />
          Directions
        </a>
      </div>
      <p className="mt-3">
        <SampleDataTag />
      </p>
    </Card>
  )
}
