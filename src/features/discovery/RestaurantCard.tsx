import { Clock, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FitBadge } from '../../components/ui/FitBadge'
import { SampleDataTag } from '../../components/ui/SampleDataTag'
import { DIETARY_DISCLAIMER, DIETARY_LABELS, type DietaryTag } from '../../data'
import { cx } from '../../lib/cx'
import { PRICE_LABELS } from '../../lib/discovery/filters'
import type { RankedRestaurant } from '../../lib/discovery/rank'
import { FIT_LEVEL_LABEL } from '../../lib/fit'
import { formatDistance, formatTravel } from '../../lib/geo/format'
import { formatClock } from '../../lib/time/localTime'
import { SaveButton } from '../saved/SaveButton'

export interface RestaurantCardProps {
  item: RankedRestaurant
  selected?: boolean
  /** Dietary filters currently on: shown on the card, with the verify-with-restaurant note. */
  dietaryTags?: readonly DietaryTag[]
  /** Hide secondary details (used in the map's pop-up preview). */
  compact?: boolean
  /** Shows a "Show on map" button when provided. */
  onShowOnMap?: () => void
  /** Replaces the save button, e.g. a "Remove" button inside a trip list. */
  footerAction?: ReactNode
}

function OpenStatus({ item }: { item: RankedRestaurant }) {
  if (!item.open) return <span className="text-text-muted">Closed now</span>
  const closingSoon = item.minutesUntilClose !== null && item.minutesUntilClose <= 60
  return (
    <span className={closingSoon ? 'font-semibold text-fit-mixed-fg' : 'font-semibold text-fit-great-fg'}>
      {closingSoon ? `Closes in ${item.minutesUntilClose} min` : `Open until ${item.closesAt ? formatClock(item.closesAt) : 'later'}`}
    </span>
  )
}

/** One restaurant in the results: age-specific fit, the reason in a sentence, and what it takes to get there. */
export function RestaurantCard({ item, selected = false, dietaryTags = [], compact = false, onShowOnMap, footerAction }: RestaurantCardProps) {
  const { restaurant, fit } = item
  const titleId = `restaurant-${restaurant.id}`
  const known = fit.level !== 'unknown'
  const reportedDietary = dietaryTags.filter((tag) => restaurant.dietary[tag]?.value === true)

  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      aria-current={selected ? 'true' : undefined}
      data-restaurant-id={restaurant.id}
      selected={selected}
      interactive
      className="relative scroll-mt-40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-title">
            {/* Stretched link: the whole card opens the detail page. */}
            <Link to={`/restaurant/${restaurant.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
              {restaurant.name}
            </Link>
          </h3>
          <p className="text-small text-text-muted">
            {restaurant.cuisine} ·{' '}
            <span aria-hidden="true">{PRICE_LABELS[restaurant.priceLevel]}</span>
            <span className="sr-only">price level {restaurant.priceLevel} of 4</span> · {restaurant.neighborhood}
          </p>
        </div>
        <FitBadge size="sm" level={fit.level} score={known ? fit.score : undefined} className="shrink-0" />
      </div>

      <p className="mt-3 text-small">{fit.summary}</p>

      {!compact && fit.perChild.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fit for each child">
          {fit.perChild.map((c) => (
            <li key={c.childId}>
              <FitBadge size="sm" level={c.level} label={`${c.description} · ${FIT_LEVEL_LABEL[c.level]}`} />
            </li>
          ))}
        </ul>
      )}

      {reportedDietary.length > 0 && (
        <p className="mt-3 text-small">
          <span className="font-semibold">Parents report: </span>
          {reportedDietary.map((tag) => DIETARY_LABELS[tag].toLowerCase()).join(', ')}.{' '}
          <span className="text-text-muted">{DIETARY_DISCLAIMER}</span>
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={16} aria-hidden="true" className="text-text-muted" />
          <OpenStatus item={item} />
        </span>
        <span className="text-text-muted">
          {formatDistance(item.distanceKm)} · {formatTravel(item.travel)}
        </span>
      </p>

      {!compact && fit.level !== 'unknown' && fit.confidence !== 'high' && (
        <p className="mt-1 text-caption text-text-subtle">Based on fewer parent reports</p>
      )}

      <div className={cx('mt-3 flex flex-wrap items-center justify-between gap-2')}>
        <SampleDataTag />
        <span className="relative z-10 flex items-center gap-1 print:hidden">
          {footerAction ?? <SaveButton restaurantId={restaurant.id} restaurantName={restaurant.name} />}
        </span>
        {onShowOnMap && (
          <Button
            variant="ghost"
            className="relative z-10 -mr-2"
            leadingIcon={<MapPin size={18} aria-hidden="true" />}
            onClick={onShowOnMap}
            aria-label={`Show on map: ${restaurant.name}`}
          >
            Show on map
          </Button>
        )}
      </div>
    </Card>
  )
}
