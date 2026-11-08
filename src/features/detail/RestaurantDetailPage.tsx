import { ChevronLeft, ExternalLink, LifeBuoy, MapPin, MessageSquarePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../components/ui/Button'
import { FitBadge } from '../../components/ui/FitBadge'
import { Notice } from '../../components/ui/Notice'
import { SampleDataTag } from '../../components/ui/SampleDataTag'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateMessage } from '../../components/ui/StateMessage'
import { WaitBadge } from '../../components/ui/WaitBadge'
import type { City, Restaurant, WaitEstimate } from '../../data'
import { track } from '../../lib/analytics/logger'
import { blendSignals } from '../../lib/feedback/blend'
import { PRICE_LABELS } from '../../lib/discovery/filters'
import { rankRestaurants } from '../../lib/discovery/rank'
import { FIT_LEVEL_LABEL } from '../../lib/fit'
import { formatDistance, formatTravel } from '../../lib/geo/format'
import { useNow } from '../../lib/hooks'
import { formatClock } from '../../lib/time/localTime'
import { usePageTitle } from '../../lib/usePageTitle'
import { useProfileStore } from '../../store/profileStore'
import { FeedbackSheet } from '../feedback/FeedbackSheet'
import { SaveButton } from '../saved/SaveButton'
import { useOwnFeedback } from '../feedback/useOwnFeedback'
import { useOrigin } from '../shared/useOrigin'
import { BailOutSheet } from './BailOutSheet'
import { ConfirmedFacts, FitBreakdown, HoursAndWaits, MenuAndDietary, OwnReports, ParentReports, PhotoPlaceholders, Section, WatchOuts } from './DetailSections'
import { directionsUrl } from './directions'
import { useRestaurantDetail } from './useRestaurantDetail'

/** Router state set when someone arrives having already chosen this place (Right now, or the bail-out). */
function wasChosen(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'chosen' in state && (state as { chosen: unknown }).chosen === true
}

function DetailView({ restaurant, city, wait }: { restaurant: Restaurant; city: City; wait: WaitEstimate | null }) {
  const children = useProfileStore((s) => s.children)
  const now = useNow()
  const { point, label: originLabel } = useOrigin(city)
  const navigate = useNavigate()
  const location = useLocation()
  const [chosen, setChosen] = useState(() => wasChosen(location.state))
  const [bailOpen, setBailOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { own, add: addOwn } = useOwnFeedback(restaurant.id)
  const blended = useMemo(() => blendSignals(restaurant.parentSignals, own), [restaurant.parentSignals, own])

  useEffect(() => {
    track({ type: 'restaurant_viewed', restaurantId: restaurant.id })
  }, [restaurant.id])

  const item = useMemo(
    () => rankRestaurants({ restaurants: [restaurant], children, origin: point ?? city.center, cities: [city], now, maxDistanceKm: null, sort: 'fit' })[0],
    [restaurant, children, point, city, now],
  )
  if (!item) return null
  const { fit } = item
  const known = fit.level !== 'unknown'

  const choose = (via: 'going_here' | 'directions') => {
    track({ type: 'restaurant_selected', restaurantId: restaurant.id, via })
    setChosen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pt-4 pb-6">
      <header className="flex flex-col gap-3">
        <Link to="/" className="inline-flex min-h-(--size-touch) w-fit items-center gap-1 rounded-md text-small font-semibold text-primary">
          <ChevronLeft size={18} aria-hidden="true" />
          Explore
        </Link>

        <div>
          <h1 className="text-display">{restaurant.name}</h1>
          <p className="mt-1 text-text-muted">
            {restaurant.cuisine} · <span aria-hidden="true">{PRICE_LABELS[restaurant.priceLevel]}</span>
            <span className="sr-only">price level {restaurant.priceLevel} of 4</span> · {restaurant.neighborhood}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FitBadge level={fit.level} score={known ? fit.score : undefined} label={known ? FIT_LEVEL_LABEL[fit.level] : undefined} />
          {wait && <WaitBadge estimate={wait} />}
        </div>
        <p>{fit.summary}</p>
        {fit.perChild.length > 1 && (
          <ul className="flex flex-wrap gap-2" aria-label="Fit for each child">
            {fit.perChild.map((c) => (
              <li key={c.childId}>
                <FitBadge size="sm" level={c.level} label={`${c.description} · ${FIT_LEVEL_LABEL[c.level]}`} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-small text-text-muted">
          {item.open ? (
            <strong className="text-fit-great-fg">{item.closesAt ? `Open until ${formatClock(item.closesAt)}` : 'Open now'}</strong>
          ) : (
            <strong>Closed now</strong>
          )}{' '}
          · {formatDistance(item.distanceKm)} · {formatTravel(item.travel)} from {originLabel}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton restaurantId={restaurant.id} restaurantName={restaurant.name} variant="button" />
          <SampleDataTag />
        </div>
      </header>

      {chosen && (
        <Notice>
          You’re heading to {restaurant.name}. Directions are below, and if it isn’t working out, the bail-out button is right here.
        </Notice>
      )}

      {/* The bail-out lives near the top so it's one tap away at the table. */}
      <div>
        <Button
          variant="accent"
          size="lg"
          fullWidth
          leadingIcon={<LifeBuoy size={22} aria-hidden="true" />}
          onClick={() => {
            track({ type: 'bail_out_used', fromRestaurantId: restaurant.id, toRestaurantId: null })
            setBailOpen(true)
          }}
          className="h-auto flex-col gap-0 py-3"
        >
          <span>This isn’t working</span>
          <span className="text-small font-medium opacity-95">Show the nearest quick alternative</span>
        </Button>
      </div>

      <Section id="breakdown" title="Will it work for your kids?">
        <FitBreakdown restaurant={restaurant} fit={fit} />
      </Section>

      <Section id="watch" title="Watch out for">
        <WatchOuts items={restaurant.watchOuts} forFamily={fit.warnings} />
      </Section>

      <Section id="times" title="Quiet times and hours">
        <HoursAndWaits restaurant={restaurant} city={city} wait={wait} now={now} />
      </Section>

      <Section id="confirmed" title="What parents have confirmed" note="Each fact shows how many parents back it up and when it was last confirmed. In this prototype those numbers are sample data.">
        <ConfirmedFacts attributes={restaurant.attributes} now={now} />
      </Section>

      <Section id="menu" title="Menu highlights for kids">
        <MenuAndDietary restaurant={restaurant} />
      </Section>

      <Section id="reports" title="What parents say">
        <ParentReports signals={blended.signals} includesYours={blended.includesYours} />
        <OwnReports reports={own} now={now} />
        <Button variant="secondary" leadingIcon={<MessageSquarePlus size={18} aria-hidden="true" />} onClick={() => setFeedbackOpen(true)} className="w-fit">
          Been here? Share how it went
        </Button>
      </Section>

      <Section id="photos" title="Photos">
        <PhotoPlaceholders name={restaurant.name} />
      </Section>

      <Section id="where" title="Where">
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2">
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" />
            <span>
              {restaurant.neighborhood}, {city.name}
              <span className="block text-small text-text-muted">{restaurant.addressNote}</span>
            </span>
          </p>
          <p className="text-small text-text-muted">This restaurant is fictional, so directions point to its sample location in the neighbourhood.</p>
        </div>
      </Section>

      {/* Primary actions stay reachable with one thumb while scrolling. */}
      <div className="sticky bottom-[calc(var(--size-touch-lg)+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t border-line bg-surface p-3 md:bottom-0">
        {chosen ? (
          <a
            href={directionsUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track({ type: 'restaurant_selected', restaurantId: restaurant.id, via: 'directions' })}
            className="inline-flex min-h-(--size-touch-lg) flex-1 items-center justify-center gap-2 rounded-pill bg-primary px-6 text-lead font-semibold text-on-primary transition-colors duration-(--duration-fast) hover:bg-primary-hover"
          >
            <ExternalLink size={20} aria-hidden="true" />
            Directions
          </a>
        ) : (
          <>
            <Button size="lg" className="flex-1 px-4 text-body whitespace-nowrap" onClick={() => choose('going_here')}>
              We’re going here
            </Button>
            <a
              href={directionsUrl(restaurant)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => choose('directions')}
              className="inline-flex min-h-(--size-touch-lg) items-center justify-center gap-2 rounded-pill border-2 border-primary px-4 text-body font-semibold text-primary hover:bg-primary-soft"
            >
              <ExternalLink size={18} aria-hidden="true" />
              Directions
            </a>
          </>
        )}
      </div>

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        onSubmitted={addOwn}
      />

      <BailOutSheet
        open={bailOpen}
        onClose={() => setBailOpen(false)}
        restaurant={restaurant}
        city={city}
        children_={children}
        onTake={(pick) => {
          const to = pick.candidate.item.restaurant.id
          track({ type: 'restaurant_selected', restaurantId: to, via: 'going_here' })
          setBailOpen(false)
          navigate(`/restaurant/${to}`, { state: { chosen: true } })
        }}
      />
    </div>
  )
}

/** /restaurant/:id: everything a parent needs to trust the answer, plus the bail-out. */
export function RestaurantDetailPage() {
  const { id = '' } = useParams()
  const { data, retry } = useRestaurantDetail(id)
  usePageTitle(data.status === 'ready' ? data.restaurant.name : 'Restaurant')

  if (data.status === 'loading') {
    return (
      <div role="status" aria-label="Loading restaurant" className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-14" />
      </div>
    )
  }
  if (data.status === 'error') {
    return (
      <StateMessage kind="error" title="We couldn’t load this restaurant" action={<Button onClick={retry}>Try again</Button>}>
        Something went wrong on our side.
      </StateMessage>
    )
  }
  if (data.status === 'notFound') {
    return (
      <StateMessage kind="empty" title="We can’t find that restaurant" action={<ButtonLink to="/">Back to Explore</ButtonLink>}>
        The link may be old. Sample restaurants can change between versions.
      </StateMessage>
    )
  }
  return <DetailView key={data.restaurant.id} restaurant={data.restaurant} city={data.city} wait={data.wait} />
}
