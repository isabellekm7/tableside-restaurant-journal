import { LocateFixed } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Notice'
import { StateMessage } from '../../components/ui/StateMessage'
import { track } from '../../lib/analytics/logger'
import { rankRestaurants } from '../../lib/discovery/rank'
import { chipLabel } from '../../lib/profile/summary'
import { useNow } from '../../lib/hooks'
import { recommendRightNow } from '../../lib/rightNow/recommend'
import { usePageTitle } from '../../lib/usePageTitle'
import { useDiscoveryStore } from '../../store/discoveryStore'
import { useProfileStore } from '../../store/profileStore'
import { RestaurantCardSkeletons } from '../discovery/RestaurantCardSkeleton'
import { locationMessage } from '../discovery/locationMessage'
import { useUserLocation } from '../discovery/useUserLocation'
import { useOrigin } from '../shared/useOrigin'
import { PickCard } from './PickCard'
import { useRightNowData } from './useRightNowData'

/**
 * "We need to eat soon": open, close by, a short wait, and a good fit for the kids' ages,
 * ranked by fit minus waiting and travelling. Waits are simulated in this prototype.
 */
export function RightNowPage() {
  usePageTitle('Eat soon')
  const navigate = useNavigate()
  const children = useProfileStore((s) => s.children)
  const cityId = useDiscoveryStore((s) => s.cityId)
  const setOrigin = useDiscoveryStore((s) => s.setOrigin)
  const origin = useDiscoveryStore((s) => s.origin)
  const now = useNow()
  const { data, retry } = useRightNowData(cityId, now)
  const cities = useMemo(() => (data.status === 'ready' ? data.cities : []), [data])
  const city = cities.find((c) => c.id === cityId)
  const { point, label } = useOrigin(city)
  const location = useUserLocation(cities)

  useEffect(() => {
    track({ type: 'right_now_used' })
  }, [])

  const result = useMemo(() => {
    if (data.status !== 'ready' || !city || !point) return null
    const ranked = rankRestaurants({ restaurants: data.restaurants, children, origin: point, cities: data.cities, now, maxDistanceKm: null, sort: 'fit' })
    return recommendRightNow(ranked.map((item) => ({ item, wait: data.waits.get(item.restaurant.id) ?? null })))
  }, [data, city, point, children, now])

  if (data.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-8">
        <StateMessage kind="error" title="We couldn’t check what’s open" action={<Button onClick={retry}>Try again</Button>}>
          Something went wrong on our side.
        </StateMessage>
      </div>
    )
  }

  const choose = (id: string) => {
    track({ type: 'restaurant_selected', restaurantId: id, via: 'going_here' })
    navigate(`/restaurant/${id}`, { state: { chosen: true } })
  }

  const message = city ? locationMessage(location.status, city) : null

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-display">Let’s eat soon</h1>
        <p className="mt-2 text-lead text-text-muted">
          Open now, close by, short waits, and a good fit for {children.length > 0 ? `your ${chipLabel(children).replace(/^\d+ kids?: /, '')}` : 'families'}.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-small text-text-muted">
          Distances from {label}.{' '}
          {origin.kind === 'city' && (
            <Button
              variant="ghost"
              leadingIcon={<LocateFixed size={16} aria-hidden="true" />}
              onClick={location.request}
              disabled={location.status.kind === 'locating'}
              className="-my-2 inline-flex px-2"
            >
              Use my location
            </Button>
          )}
          {origin.kind === 'geo' && (
            <Button variant="ghost" onClick={() => { setOrigin({ kind: 'city' }); location.reset() }} className="-my-2 inline-flex px-2">
              Use city centre
            </Button>
          )}
        </p>
        {message && <p role="status" className="text-small text-text-muted">{message}</p>}
      </div>

      {(data.status === 'loading' || !result) && <RestaurantCardSkeletons count={2} />}

      {result && result.picks.length === 0 && (
        <StateMessage
          kind="empty"
          title={result.openCount === 0 ? 'Nothing is open right now' : 'No good option right now'}
          action={<ButtonLink to="/">See all restaurants</ButtonLink>}
        >
          {result.openCount === 0
            ? 'Nothing in this city is open at the moment. Browse everything to plan for later.'
            : 'The places that are open aren’t a good fit for your kids. Browse everything for the closest compromise.'}
        </StateMessage>
      )}

      {result && result.picks.length > 0 && (
        <>
          {result.relaxed && (
            <Notice tone="warning">
              No great fit with a short wait nearby right now. These are the closest compromises, and each says where it falls short.
            </Notice>
          )}
          <ol className="flex flex-col gap-4" aria-label="Where to eat right now, best first">
            {result.picks.map((pick, i) => (
              <li key={pick.candidate.item.restaurant.id}>
                <PickCard
                  pick={pick}
                  rank={i}
                  onChoose={() => choose(pick.candidate.item.restaurant.id)}
                  onDirections={() => track({ type: 'restaurant_selected', restaurantId: pick.candidate.item.restaurant.id, via: 'directions' })}
                />
              </li>
            ))}
          </ol>
          <p className="text-small text-text-muted">Wait times are simulated in this prototype; a real source can replace them. Updated every minute.</p>
          <ButtonLink to="/" variant="ghost">
            See all restaurants
          </ButtonLink>
        </>
      )}
    </div>
  )
}
